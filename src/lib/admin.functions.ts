import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createAdminSession, endAdminSession, requireAdmin } from "./session.server";
import { ORDER_SELECT, type OrderDTO } from "./order-dto";
import { creditCashbackIfNeeded, transitionOrder } from "./orders.server";
import { calcChange, normalizePhone, summarizeSales } from "./rules";
import { lookupCep, geocode } from "./geo.server";
import type { Database } from "@/integrations/supabase/types";

const token = z.string().min(10).max(200);
const withToken = <T extends z.ZodRawShape>(shape: T) => z.object({ token, ...shape });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    // A senha inicial publicada no código nunca é aceita.
    if (data.password === "adega2026") return { ok: false as const, message: "Senha incorreta." };
    const { data: r, error } = await supabaseAdmin.rpc("admin_verify_password", { p_password: data.password });
    if (error) throw new Error("Não foi possível entrar agora.");
    const res = r as { status: string; locked_until?: string };
    if (res.status === "locked") return { ok: false as const, message: "Muitas tentativas. Aguarde 15 minutos." };
    if (res.status !== "ok") return { ok: false as const, message: "Senha incorreta." };
    return { ok: true as const, token: await createAdminSession() };
  });

export const adminLogout = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({}).parse(d))
  .handler(async ({ data }) => {
    await endAdminSession(data.token);
    return { ok: true };
  });

export const adminCheck = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({}).parse(d))
  .handler(async ({ data }) => {
    try {
      await requireAdmin(data.token);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export const adminChangePassword = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ newPassword: z.string().min(8).max(100).refine((v) => v !== "adega2026", "Escolha uma senha diferente da inicial.") }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { error } = await supabaseAdmin.rpc("admin_set_password", { p_password: data.newPassword });
    if (error) throw new Error("Não foi possível alterar a senha.");
    return { ok: true };
  });

// ---------------- ORDERS ----------------
export const adminOrders = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ scope: z.enum(["active", "history"]) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    let q = supabaseAdmin.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false });
    if (data.scope === "active") {
      q = q.in("status", ["awaiting_payment", "received", "preparing", "out_for_delivery", "ready_for_pickup"]).limit(200);
    } else {
      q = q.in("status", ["delivered", "cancelled"]).limit(100);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error("Erro ao carregar pedidos.");
    return (rows ?? []) as unknown as OrderDTO[];
  });

export const adminSetOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    withToken({
      orderId: z.string().uuid(),
      status: z.enum(["received", "preparing", "out_for_delivery", "ready_for_pickup", "delivered", "cancelled"]),
      courierId: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    await transitionOrder(data.orderId, data.status, data.courierId);
    return { ok: true };
  });

// ---------------- CATALOG ----------------
export const adminCatalog = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({}).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const [c, p] = await Promise.all([
      supabaseAdmin.from("categories").select("*").order("position"),
      supabaseAdmin.from("products").select("*").order("position"),
    ]);
    return { categories: c.data ?? [], products: p.data ?? [] };
  });

export const adminSaveCategory = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    withToken({ id: z.string().uuid().optional().nullable(), name: z.string().trim().min(1).max(60), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    if (data.id) {
      await supabaseAdmin.from("categories").update({ name: data.name, active: data.active }).eq("id", data.id);
    } else {
      const { data: last } = await supabaseAdmin.from("categories").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
      await supabaseAdmin.from("categories").insert({ name: data.name, active: data.active, position: (last?.position ?? 0) + 1 });
    }
    return { ok: true };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    await supabaseAdmin.from("categories").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminMoveCategory = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { data: cats } = await supabaseAdmin.from("categories").select("id,position").order("position");
    const list = cats ?? [];
    const i = list.findIndex((c) => c.id === data.id);
    const j = data.direction === "up" ? i - 1 : i + 1;
    const a = list[i];
    const b = list[j];
    if (i < 0 || !a || !b) return { ok: true };
    list[i] = b;
    list[j] = a;
    await Promise.all(list.map((c, idx) => supabaseAdmin.from("categories").update({ position: idx + 1 }).eq("id", c.id)));
    return { ok: true };
  });

const productShape = {
  id: z.string().uuid().optional().nullable(),
  category_id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable(),
  price_cents: z.number().int().min(0).max(10_000_000),
  image_url: z.string().max(500).nullable(),
  featured: z.boolean(),
  available: z.boolean(),
  stock: z.number().int().min(0).max(1_000_000).nullable(),
  barcode: z.string().trim().max(32).nullable().optional(),
};

export const adminSaveProduct = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken(productShape).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { token: _t, id, ...rest } = data;
    const row = { ...rest, barcode: rest.barcode?.replace(/\s/g, "") || null };
    if (row.barcode) {
      const { data: dup } = await supabaseAdmin.from("products").select("id,name").eq("barcode", row.barcode).maybeSingle();
      if (dup && dup.id !== id) throw new Error(`Código de barras já usado em "${dup.name}".`);
    }
    if (id) {
      const { error } = await supabaseAdmin.from("products").update(row).eq("id", id);
      if (error) throw new Error("Erro ao salvar produto.");
    } else {
      const { error } = await supabaseAdmin.from("products").insert({ ...row, position: Date.now() % 1_000_000 });
      if (error) throw new Error("Erro ao criar produto.");
    }
    return { ok: true };
  });

export const adminAddStock = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ id: z.string().uuid(), qty: z.number().int().min(1).max(1_000_000) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { data: stock, error } = await supabaseAdmin.rpc("add_stock", { p_product: data.id, p_qty: data.qty });
    if (error) throw new Error("Erro ao lançar entrada de estoque.");
    return { stock: stock as number | null };
  });

export const adminToggleProduct = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ id: z.string().uuid(), field: z.enum(["featured", "available"]), value: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const patch = data.field === "featured" ? { featured: data.value } : { available: data.value };
    await supabaseAdmin.from("products").update(patch).eq("id", data.id);
    return { ok: true };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    await supabaseAdmin.from("products").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminCreateUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ filename: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const ext = (data.filename.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const path = `products/${crypto.randomUUID()}.${ext}`;
    const { data: signed, error } = await supabaseAdmin.storage.from("product-images").createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Não foi possível preparar o envio da foto.");
    return { path, uploadToken: signed.token, publicUrl: `/media/${path}` };
  });

// ---------------- COURIERS ----------------
export const adminCouriers = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({}).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { data: rows } = await supabaseAdmin.from("couriers").select("*").order("name");
    return rows ?? [];
  });

export const adminSaveCourier = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    withToken({
      id: z.string().uuid().optional().nullable(),
      name: z.string().trim().min(2).max(80),
      plate: z.string().trim().max(12).nullable(),
      whatsapp: z.string().trim().min(10).max(20),
      active: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { token: _t, id, ...row } = data;
    row.whatsapp = row.whatsapp.replace(/\D/g, "");
    if (!row.whatsapp.startsWith("55")) row.whatsapp = "55" + row.whatsapp;
    if (id) await supabaseAdmin.from("couriers").update(row).eq("id", id);
    else await supabaseAdmin.from("couriers").insert(row);
    return { ok: true };
  });

export const adminDeleteCourier = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    await supabaseAdmin.from("couriers").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminCourierReport = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const [{ data: couriers }, { data: rides }] = await Promise.all([
      supabaseAdmin.from("couriers").select("id,name,plate,whatsapp"),
      supabaseAdmin
        .from("orders")
        .select("id,code,courier_id,customer_name,delivery_fee_cents,distance_km,total_cents,payment_method,change_due_cents,delivered_at")
        .eq("status", "delivered")
        .eq("fulfillment", "delivery")
        .not("courier_id", "is", null)
        .gte("delivered_at", data.from)
        .lte("delivered_at", data.to)
        .order("delivered_at"),
    ]);
    const report = (couriers ?? []).map((c) => {
      const mine = (rides ?? []).filter((r) => r.courier_id === c.id);
      return {
        courier: c,
        rides: mine.map((r) => ({ ...r, distance_km: r.distance_km == null ? null : Number(r.distance_km) })),
        count: mine.length,
        feesCents: mine.reduce((a, r) => a + r.delivery_fee_cents, 0),
        cashCollectedCents: mine.filter((r) => r.payment_method === "cash").reduce((a, r) => a + r.total_cents, 0),
        distanceKm: mine.reduce((a, r) => a + Number(r.distance_km ?? 0), 0),
      };
    });
    return report.filter((r) => r.count > 0 || true);
  });

// ---------------- SETTINGS ----------------
export const adminGetSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({}).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { data: s } = await supabaseAdmin.from("store_settings").select("*").eq("id", 1).single();
    if (!s) throw new Error("Configurações não encontradas.");
    return {
      ...s,
      raio_maximo_km: Number(s.raio_maximo_km),
      limite_km_taxa_fixa: Number(s.limite_km_taxa_fixa),
      cashback_percent: Number(s.cashback_percent),
      mp_configured: !!process.env["MERCADO_PAGO_ACCESS_TOKEN"],
    };
  });

const opt = (max: number) => z.string().trim().max(max).nullable();
export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    withToken({
      store_name: opt(80),
      tagline: opt(160),
      whatsapp_number: opt(20),
      whatsapp_display: opt(30),
      instagram_user: opt(60),
      instagram_url: opt(200),
      address_text: opt(200),
      google_maps_url: opt(500),
      origin_cep: z.string().regex(/^\d{5}-?\d{3}$/),
      raio_maximo_km: z.number().min(0.5).max(200),
      limite_km_taxa_fixa: z.number().min(0).max(200),
      valor_taxa_fixa_cents: z.number().int().min(0).max(100_000),
      valor_por_km_adicional_cents: z.number().int().min(0).max(100_000),
      accept_pix: z.boolean(),
      accept_card: z.boolean(),
      accept_cash: z.boolean(),
      allow_pickup: z.boolean(),
      pix_test_mode: z.boolean(),
      featured_enabled: z.boolean(),
      require_delivery_pin: z.boolean(),
      store_mode: z.enum(["open", "closed", "auto"]),
      open_time: z.string().regex(/^\d{2}:\d{2}$/),
      close_time: z.string().regex(/^\d{2}:\d{2}$/),
      eta_minutes: z.number().int().min(5).max(300),
      cashback_percent: z.number().min(0).max(50),
      free_delivery_min_cents: z.number().int().min(0).max(10_000_000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { token: _t, ...row } = data;
    const empty = (v: string | null) => (v && v.length ? v : null);
    const { data: current } = await supabaseAdmin.from("store_settings").select("origin_cep").eq("id", 1).single();
    const patch: Database["public"]["Tables"]["store_settings"]["Update"] = {
      ...row,
      store_name: empty(row.store_name),
      tagline: empty(row.tagline),
      whatsapp_number: row.whatsapp_number ? row.whatsapp_number.replace(/\D/g, "") || null : null,
      whatsapp_display: empty(row.whatsapp_display),
      instagram_user: empty(row.instagram_user),
      instagram_url: empty(row.instagram_url),
      address_text: empty(row.address_text),
      google_maps_url: empty(row.google_maps_url),
      updated_at: new Date().toISOString(),
    };
    const newCep = row.origin_cep.replace(/\D/g, "");
    if (current?.origin_cep?.replace(/\D/g, "") !== newCep) {
      const addr = await lookupCep(newCep);
      const pos = await geocode({ ...addr, number: "" });
      if (!pos) throw new Error("Não foi possível localizar o novo CEP base.");
      patch.origin_cep = addr.cep;
      patch.origin_lat = pos.lat;
      patch.origin_lng = pos.lng;
    }
    const { error } = await supabaseAdmin.from("store_settings").update(patch).eq("id", 1);
    if (error) throw new Error("Erro ao salvar configurações.");
    return { ok: true };
  });

export const adminSetFeaturedEnabled = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ value: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    await supabaseAdmin.from("store_settings").update({ featured_enabled: data.value }).eq("id", 1);
    return { ok: true };
  });

// ---------------- CONTROLES RÁPIDOS ----------------
export const adminQuickSettings = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    withToken({
      store_mode: z.enum(["open", "closed", "auto"]).optional(),
      eta_minutes: z.number().int().min(5).max(300).optional(),
      accept_pix: z.boolean().optional(),
      accept_card: z.boolean().optional(),
      accept_cash: z.boolean().optional(),
      require_delivery_pin: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { token: _t, ...rest } = data;
    const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Database["public"]["Tables"]["store_settings"]["Update"];
    const { error } = await supabaseAdmin.from("store_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) throw new Error("Não foi possível salvar.");
    return { ok: true };
  });

export const adminSetOrderGps = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ orderId: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const patch = data.enabled
      ? { gps_tracking: true }
      : { gps_tracking: false, courier_lat: null, courier_lng: null, courier_location_at: null };
    await supabaseAdmin.from("orders").update(patch).eq("id", data.orderId);
    return { ok: true };
  });

export const adminRegenerateCourierLink = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const t = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await supabaseAdmin.from("couriers").update({ access_token: t }).eq("id", data.id);
    return { ok: true };
  });

export const adminSalesReport = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { data: rows } = await supabaseAdmin
      .from("orders")
      .select("source,payment_method,card_type,total_cents,delivery_fee_cents")
      .neq("status", "cancelled")
      .neq("status", "awaiting_payment")
      .gte("created_at", data.from)
      .lte("created_at", data.to)
      .limit(20000);
    return summarizeSales(rows ?? []);
  });

export const adminSetOrderEta = createServerFn({ method: "POST" })
  .inputValidator((d) => withToken({ orderId: z.string().uuid(), minutes: z.number().int().min(5).max(300) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    await supabaseAdmin.from("orders").update({ eta_minutes: data.minutes, updated_at: new Date().toISOString() }).eq("id", data.orderId);
    return { ok: true };
  });

// ---------------- PDV (BALCÃO / WHATSAPP) ----------------
export const adminPdvSale = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    withToken({
      source: z.enum(["counter", "whatsapp"]),
      items: z.array(z.object({ productId: z.string().uuid(), qty: z.number().int().min(1).max(999) })).min(1).max(80),
      paymentMethod: z.enum(["pix", "card", "cash"]),
      cardType: z.enum(["debit", "credit"]).nullable().optional(),
      cashGivenCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
      customerName: z.string().trim().max(80).nullable().optional(),
      customerPhone: z.string().trim().max(20).nullable().optional(),
      deliveryFeeCents: z.number().int().min(0).max(100_000).optional(),
      addressLine: z.string().trim().max(240).nullable().optional(),
      notes: z.string().trim().max(300).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const ids = [...new Set(data.items.map((i) => i.productId))];
    const { data: prods } = await supabaseAdmin.from("products").select("id,name,price_cents,stock").in("id", ids);
    const byId = new Map((prods ?? []).map((p) => [p.id, p]));
    const lines = data.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new Error("Produto não encontrado.");
      if (p.stock != null && p.stock < i.qty) throw new Error(`Estoque insuficiente de "${p.name}" (${p.stock} un.).`);
      return { product_id: p.id, name: p.name, unit_price_cents: p.price_cents, quantity: i.qty };
    });
    const subtotal = lines.reduce((a, l) => a + l.unit_price_cents * l.quantity, 0);
    const fee = data.source === "whatsapp" ? (data.deliveryFeeCents ?? 0) : 0;
    const total = subtotal + fee;

    let changeFor: number | null = null;
    let changeDue = 0;
    if (data.paymentMethod === "cash" && data.cashGivenCents) {
      const c = calcChange(total, data.cashGivenCents);
      if (c === null) throw new Error("Valor recebido menor que o total.");
      changeFor = data.cashGivenCents;
      changeDue = c;
    }

    // Cliente opcional (para cashback)
    let customerId: string | null = null;
    let name = data.customerName || (data.source === "counter" ? "Cliente balcão" : "Cliente WhatsApp");
    let phone = "";
    let createdPin: string | null = null;
    if (data.customerPhone) {
      const norm = normalizePhone(data.customerPhone);
      if (!norm) throw new Error("Telefone do cliente inválido.");
      phone = norm;
      const { data: existing } = await supabaseAdmin.from("customers").select("id,name").eq("phone", norm).maybeSingle();
      if (existing) {
        customerId = existing.id;
        if (!data.customerName) name = existing.name;
      } else {
        if (!data.customerName) throw new Error("Informe o nome para cadastrar o cliente.");
        createdPin = norm.slice(-4);
        const { data: id, error } = await supabaseAdmin.rpc("customer_register", { p_phone: norm, p_name: data.customerName, p_pin: createdPin });
        if (error) throw new Error("Não foi possível cadastrar o cliente.");
        customerId = id as string;
      }
    }

    const now = new Date().toISOString();
    const done = data.source === "counter";
    const { data: st } = await supabaseAdmin.from("store_settings").select("eta_minutes").eq("id", 1).single();
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: customerId,
        customer_name: name,
        customer_phone: phone,
        status: done ? "delivered" : "received",
        fulfillment: !done && data.addressLine ? "delivery" : "pickup",
        address: !done && data.addressLine ? { cep: "", street: data.addressLine, number: "", city: "", state: "" } : null,
        source: data.source,
        subtotal_cents: subtotal,
        delivery_fee_cents: fee,
        total_cents: total,
        payment_method: data.paymentMethod,
        card_type: data.paymentMethod === "card" ? (data.cardType ?? "debit") : null,
        cash_change_for_cents: changeFor,
        change_due_cents: changeDue,
        notes: data.notes || null,
        eta_minutes: done ? null : (st?.eta_minutes ?? null),
        paid_at: data.paymentMethod === "pix" || done ? now : null,
        delivered_at: done ? now : null,
      })
      .select("id, code")
      .single();
    if (error || !order) {
      console.error(error);
      throw new Error("Não foi possível registrar a venda.");
    }
    await supabaseAdmin.from("order_items").insert(lines.map((l) => ({ ...l, order_id: order.id })));
    await Promise.all(lines.map((l) => supabaseAdmin.rpc("decrement_stock", { p_product: l.product_id, p_qty: l.quantity })));
    if (done) await creditCashbackIfNeeded(order.id);
    const { data: o2 } = await supabaseAdmin.from("orders").select("cashback_earned_cents").eq("id", order.id).single();
    return { orderId: order.id, code: order.code, totalCents: total, changeDueCents: changeDue, cashbackCents: o2?.cashback_earned_cents ?? 0, createdPin };
  });
