import { supabaseAdmin } from "@/integrations/supabase/client.server";

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256(input: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)));
}

export function newToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return toHex(b.buffer);
}

const CUSTOMER_SESSION_DAYS = 90;
const ADMIN_SESSION_HOURS = 16;

export async function createCustomerSession(customerId: string) {
  const token = newToken();
  const expires = new Date(Date.now() + CUSTOMER_SESSION_DAYS * 864e5).toISOString();
  const { error } = await supabaseAdmin
    .from("customer_sessions")
    .insert({ customer_id: customerId, token_hash: await sha256(token), expires_at: expires });
  if (error) throw new Error("Não foi possível iniciar a sessão.");
  return token;
}

export async function requireCustomer(token: string | null | undefined) {
  if (!token) throw new Error("Faça login para continuar.");
  const { data } = await supabaseAdmin
    .from("customer_sessions")
    .select("customer_id, expires_at, customers(*)")
    .eq("token_hash", await sha256(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  const customer = data?.customers as
    | { id: string; name: string; phone: string; cashback_cents: number }
    | null
    | undefined;
  if (!customer) throw new Error("Sessão expirada. Entre novamente.");
  return customer;
}

export async function endCustomerSession(token: string) {
  await supabaseAdmin.from("customer_sessions").delete().eq("token_hash", await sha256(token));
}

export async function createAdminSession() {
  const token = newToken();
  const expires = new Date(Date.now() + ADMIN_SESSION_HOURS * 36e5).toISOString();
  const { error } = await supabaseAdmin
    .from("admin_sessions")
    .insert({ token_hash: await sha256(token), expires_at: expires });
  if (error) throw new Error("Não foi possível iniciar a sessão.");
  return token;
}

export async function requireAdmin(token: string | null | undefined) {
  if (!token) throw new Error("ADMIN_UNAUTHORIZED");
  const { data } = await supabaseAdmin
    .from("admin_sessions")
    .select("id")
    .eq("token_hash", await sha256(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) throw new Error("ADMIN_UNAUTHORIZED");
}

export async function endAdminSession(token: string) {
  await supabaseAdmin.from("admin_sessions").delete().eq("token_hash", await sha256(token));
}
