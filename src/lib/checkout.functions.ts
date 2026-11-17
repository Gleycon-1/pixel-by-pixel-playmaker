import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCustomer } from "./session.server";
import { quoteDelivery } from "./geo.server";
import { applyFreeDelivery, calcChange, isStoreOpenNow, usableCashback } from "./rules";
import { createPixOrder, fetchMpOrder } from "./mercadopago.server";
import { markOrderPaid, refundCashbackIfNeeded } from "./orders.server";
import { addressSchema } from "./schemas";
import { addressForStorage, decodeAddressLabel } from "./address";
import type { Json } from "@/integrations/supabase/types";

const tokenSchema = z.string().min(10).max(200);

async function loadSettings() {
  const { data, error } = await supabaseAdmin.from("store_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("Configurações da loja indisponíveis.");
  return {
    ...data,
    raio_maximo_km: Number(data.raio_maximo_km),
    limite_km_taxa_fixa: Number(data.limite_km_taxa_fixa),
  };
}

export const quoteFreight = createServerFn({ method: "POST" })
  .inputValidator((d) => addressSchema.parse(d))
  .handler(async ({ data }) => {
    const s = await loadSettings();
    const q = await quoteDelivery(data, s);
    return q.ok
      ? { ok: true as const, distanceKm: q.distanceKm, billedKm: q.billedKm, feeCents: q.feeCents, maxKm: s.raio_maximo_km }
      : { ok: false as const, distanceKm: q.distanceKm, billedKm: q.billedKm, feeCents: 0, maxKm: q.maxKm };
  });

const placeOrderSchema = z.object({
  token: tokenSchema,
  items: z.array(z.object({ productId: z.string().uuid(), qty: z.number().int().min(1).max(99) })).min(1).max(60),
  fulfillment: z.enum(["delivery", "pickup"]),
  addressId: z.string().uuid().optional().nullable(),
  newAddress: addressSchema.optional().nullable(),
  saveAddress: z.boolean().optional(),
  paymentMethod: z.enum(["pix", "card", "cash"]),
  cardType: z.enum(["debit", "credit"]).optional().nullable(),
  needsChange: z.boolean().optional(),
  cashChangeForCents: z.number().int().min(0).max(10_000_000).optional().nullable(),
  useCashback: z.boolean().optional(),
  notes: z.string().trim().max(300).optional().nullable(),
});

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => placeOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const customer = await requireCustomer(data.token);
    const s = await loadSettings();
    if (!isStoreOpenNow(s.store_mode, s.open_time, s.close_time)) throw new Error("A loja está fechada no momento.");
    if (data.paymentMethod === "pix" && !s.accept_pix) throw new Error("Pix indisponível no momento.");
    if (data.paymentMethod === "card" && !s.accept_card) throw new Error("Maquininha indisponível no momento.");
    if (data.paymentMethod === "cash" && !s.accept_cash) throw new Error("Dinheiro indisponível no momento.");
    if (data.fulfillment === "pickup" && !s.allow_pickup) throw new Error("Retirada na loja indisponível.");
    if (data.paymentMethod === "card" && !data.cardType) throw new Error("Escolha débito ou crédito.");

    // Itens: preço sempre do banco
    const ids = [...new Set(data.items.map((i) => i.productId))];
    const { data: prods } = await supabaseAdmin.from("products").select("id,name,price_cents,available,stock").in("id", ids);
    const byId = new Map((prods ?? []).map((p) => [p.id, p]));
    const lines = data.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new Error("Um item do carrinho não existe mais.");
      if (!p.available) throw new Error(`"${p.name}" está esgotado.`);
      if (p.stock != null && p.stock < i.qty) throw new Error(`Só temos ${p.stock} un. de "${p.name}" em estoque.`);
      return { product_id: p.id, name: p.name, unit_price_cents: p.price_cents, quantity: i.qty };
    });
    const subtotal = lines.reduce((a, l) => a + l.unit_price_cents * l.quantity, 0);

    // Endereço + frete
    let address: (z.infer<typeof addressSchema> & { lat: number; lng: number }) | null = null;
    let fee = 0;
    let distanceKm: number | null = null;
    let billedKm: number | null = null;
    if (data.fulfillment === "delivery") {
      let addr: z.infer<typeof addressSchema>;
      if (data.addressId) {
        const { data: a } = await supabaseAdmin
          .from("addresses")
          .select("label,cep,street,number,complement,neighborhood,city,state,reference")
          .eq("id", data.addressId)
          .eq("customer_id", customer.id)
          .maybeSingle();
        if (!a) throw new Error("Endereço não encontrado.");
        addr = { ...a, ...decodeAddressLabel(a.label) };
      } else if (data.newAddress) {
        addr = data.newAddress;
      } else throw new Error("Informe o endereço de entrega.");

      const q = await quoteDelivery(addr, s);
      if (!q.ok) {
        throw new Error(
          `Seu endereço fica a ${q.distanceKm.toFixed(1).replace(".", ",")} km — acima do nosso raio de ${q.maxKm} km. Escolha "Retirar na loja".`,
        );
      }
      fee = applyFreeDelivery(q.feeCents, subtotal, s.free_delivery_min_cents);
      distanceKm = q.distanceKm;
      billedKm = q.billedKm;
      address = { ...addr, lat: q.lat, lng: q.lng };
      if (!data.addressId && data.newAddress && data.saveAddress) {
        await supabaseAdmin.from("addresses").insert({ ...addressForStorage(data.newAddress), customer_id: customer.id, lat: q.lat, lng: q.lng });
      }
    }

    // Cashback
    const cashbackUsed = data.useCashback ? usableCashback(customer.cashback_cents, subtotal) : 0;
    const total = subtotal + fee - cashbackUsed;

    // Dinheiro / troco
    let changeFor: number | null = null;
    let changeDue = 0;
    if (data.paymentMethod === "cash" && data.needsChange) {
      const c = calcChange(total, data.cashChangeForCents ?? 0);
      if (c === null) throw new Error("O valor para troco precisa ser maior que o total do pedido.");
      changeFor = data.cashChangeForCents ?? null;
      changeDue = c;
    }

    if (cashbackUsed > 0) {
      const { error } = await supabaseAdmin.rpc("adjust_cashback", { p_customer: customer.id, p_delta: -cashbackUsed });
      if (error) throw new Error("Saldo de cashback insuficiente.");
    }

    const isPix = data.paymentMethod === "pix" && total > 0;
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: customer.id,
        customer_name: customer.name,
        customer_phone: customer.phone,
        status: isPix ? "awaiting_payment" : "received",
        fulfillment: data.fulfillment,
        address: address as Json,
        distance_km: distanceKm,
        billed_km: billedKm,
        subtotal_cents: subtotal,
        delivery_fee_cents: fee,
        cashback_used_cents: cashbackUsed,
        total_cents: total,
        payment_method: data.paymentMethod,
        card_type: data.paymentMethod === "card" ? (data.cardType ?? null) : null,
        cash_change_for_cents: changeFor,
        change_due_cents: changeDue,
        notes: data.notes || null,
        eta_minutes: s.eta_minutes,
        paid_at: !isPix && data.paymentMethod === "pix" ? new Date().toISOString() : null,
      })
      .select("id, code")
      .single();
    if (error || !order) {
      if (cashbackUsed > 0) await supabaseAdmin.rpc("adjust_cashback", { p_customer: customer.id, p_delta: cashbackUsed });
      console.error(error);
      throw new Error("Não foi possível registrar o pedido.");
    }
    await supabaseAdmin.from("order_items").insert(lines.map((l) => ({ ...l, order_id: order.id })));
    await Promise.all(lines.map((l) => supabaseAdmin.rpc("decrement_stock", { p_product: l.product_id, p_qty: l.quantity })));

    if (isPix) {
      try {
        let qr: string;
        let mpId: string | null = null;
        if (s.pix_test_mode) {
          qr = `00020126580014BR.GOV.BCB.PIX0136TESTE-${order.id}5204000053039865406${(total / 100).toFixed(2)}5802BR5913ADEGA TESTE6009SAO PAULO62070503***6304TEST`;
        } else {
          const mp = await createPixOrder({
            orderId: order.id,
            amountCents: total,
            payerEmail: `cliente${customer.phone}@pedidos-adega.com`,
          });
          qr = mp.qrCode;
          mpId = mp.mpOrderId;
        }
        await supabaseAdmin.from("orders").update({ pix_qr_code: qr, mp_order_id: mpId }).eq("id", order.id);
      } catch (e) {
        await supabaseAdmin
          .from("orders")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", order.id);
        await refundCashbackIfNeeded(order.id);
        throw e;
      }
    }
    return { orderId: order.id, code: order.code };
  });

/** Consulta status do Pix (e confirma direto no Mercado Pago como reforço ao webhook). */
export const refreshPixStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const c = await requireCustomer(data.token);
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id,status,mp_order_id")
      .eq("id", data.id)
      .eq("customer_id", c.id)
      .maybeSingle();
    if (!o) throw new Error("Pedido não encontrado.");
    if (o.status === "awaiting_payment" && o.mp_order_id) {
      const mp = await fetchMpOrder(o.mp_order_id);
      if (mp?.paid && mp.externalReference === o.id) {
        await markOrderPaid(o.id);
        return { status: "received" };
      }
    }
    return { status: o.status };
  });

/** Apenas em modo teste: simula a confirmação do Pix. */
export const simulatePixApproval = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const c = await requireCustomer(data.token);
    const s = await loadSettings();
    if (!s.pix_test_mode) throw new Error("Simulação disponível apenas no modo teste.");
    const { data: o } = await supabaseAdmin.from("orders").select("id").eq("id", data.id).eq("customer_id", c.id).maybeSingle();
    if (!o) throw new Error("Pedido não encontrado.");
    await markOrderPaid(o.id);
    return { ok: true };
  });
