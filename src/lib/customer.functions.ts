import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createCustomerSession, endCustomerSession, requireCustomer } from "./session.server";
import { normalizePhone } from "./rules";
import { ORDER_SELECT, type OrderDTO } from "./order-dto";
import { lookupCep } from "./geo.server";
import { addressSchema } from "./schemas";
import { addressForStorage, decodeAddressLabel, type ResidenceType } from "./address";

const phoneSchema = z.string().min(8).max(25);
const pinSchema = z.string().regex(/^\d{4}$/, "O PIN deve ter 4 números.");
const tokenSchema = z.string().min(10).max(200);

function phoneOrThrow(raw: string) {
  const p = normalizePhone(raw);
  if (!p) throw new Error("Número de WhatsApp inválido. Use DDD + número.");
  return p;
}

export const checkPhone = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data }) => {
    const phone = phoneOrThrow(data.phone);
    const { data: c } = await supabaseAdmin.from("customers").select("id").eq("phone", phone).maybeSingle();
    return { exists: !!c, phone };
  });

export const registerCustomer = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ phone: phoneSchema, name: z.string().trim().min(2).max(80), pin: pinSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const phone = phoneOrThrow(data.phone);
    const { data: id, error } = await supabaseAdmin.rpc("customer_register", {
      p_phone: phone,
      p_name: data.name,
      p_pin: data.pin,
    });
    if (error || !id) {
      if (error?.code === "23505") throw new Error("Esse WhatsApp já tem cadastro. Entre com seu PIN.");
      throw new Error("Não foi possível criar seu cadastro.");
    }
    return { token: await createCustomerSession(id as string) };
  });

export const loginCustomer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: phoneSchema, pin: pinSchema }).parse(d))
  .handler(async ({ data }) => {
    const phone = phoneOrThrow(data.phone);
    const { data: r, error } = await supabaseAdmin.rpc("customer_verify_pin", { p_phone: phone, p_pin: data.pin });
    if (error) throw new Error("Não foi possível entrar agora.");
    const res = r as { status: string; customer_id?: string; attempts_left?: number; locked_until?: string };
    if (res.status === "ok" && res.customer_id) {
      return { ok: true as const, token: await createCustomerSession(res.customer_id) };
    }
    if (res.status === "locked") {
      return { ok: false as const, locked: true, lockedUntil: res.locked_until ?? null, attemptsLeft: 0 };
    }
    if (res.status === "not_found") return { ok: false as const, locked: false, lockedUntil: null, attemptsLeft: -1 };
    return { ok: false as const, locked: false, lockedUntil: null, attemptsLeft: res.attempts_left ?? 0 };
  });

export const logoutCustomer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    await endCustomerSession(data.token);
    return { ok: true };
  });

export type AddressDTO = {
  id: string;
  label: string | null;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  reference: string | null;
  residence_type: ResidenceType;
};

export const getMe = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const c = await requireCustomer(data.token);
    const [{ data: addresses }, { data: last }] = await Promise.all([
      supabaseAdmin
        .from("addresses")
        .select("id,label,cep,street,number,complement,neighborhood,city,state,reference")
        .eq("customer_id", c.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("orders")
        .select(ORDER_SELECT)
        .eq("customer_id", c.id)
        .eq("status", "delivered")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      customer: { id: c.id, name: c.name, phone: c.phone, cashback_cents: c.cashback_cents },
      addresses: (addresses ?? []) as AddressDTO[],
      lastDelivered: (last ?? null) as unknown as OrderDTO | null,
    };
  });



export const saveAddress = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, address: addressSchema }).parse(d))
  .handler(async ({ data }) => {
    const c = await requireCustomer(data.token);
    const { data: row, error } = await supabaseAdmin
      .from("addresses")
      .insert({ ...data.address, customer_id: c.id })
      .select("id")
      .single();
    if (error) throw new Error("Não foi possível salvar o endereço.");
    return { id: row.id };
  });

export const deleteAddress = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const c = await requireCustomer(data.token);
    await supabaseAdmin.from("addresses").delete().eq("id", data.id).eq("customer_id", c.id);
    return { ok: true };
  });

export const myOrders = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const c = await requireCustomer(data.token);
    const { data: rows } = await supabaseAdmin
      .from("orders")
      .select(ORDER_SELECT)
      .eq("customer_id", c.id)
      .order("created_at", { ascending: false })
      .limit(50);
    return (rows ?? []) as unknown as OrderDTO[];
  });

export const getMyOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const c = await requireCustomer(data.token);
    const { data: row } = await supabaseAdmin
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", data.id)
      .eq("customer_id", c.id)
      .maybeSingle();
    if (!row) throw new Error("Pedido não encontrado.");
    return row as unknown as OrderDTO;
  });

export const cepLookup = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ cep: z.string().min(8).max(9) }).parse(d))
  .handler(async ({ data }) => lookupCep(data.cep));
