import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcCashback } from "./rules";

export async function markOrderPaid(orderId: string) {
  const { data } = await supabaseAdmin
    .from("orders")
    .update({ status: "received", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "awaiting_payment")
    .select("id")
    .maybeSingle();
  return !!data;
}

export async function refundCashbackIfNeeded(orderId: string) {
  const { data } = await supabaseAdmin
    .from("orders")
    .update({ cashback_refunded: true })
    .eq("id", orderId)
    .eq("cashback_refunded", false)
    .gt("cashback_used_cents", 0)
    .select("customer_id, cashback_used_cents")
    .maybeSingle();
  if (data?.customer_id) {
    await supabaseAdmin.rpc("adjust_cashback", { p_customer: data.customer_id, p_delta: data.cashback_used_cents });
  }
}

async function creditCashbackIfNeeded(orderId: string) {
  const { data: o } = await supabaseAdmin
    .from("orders")
    .select("customer_id, subtotal_cents, cashback_credited")
    .eq("id", orderId)
    .single();
  if (!o || o.cashback_credited || !o.customer_id) return;
  const earned = calcCashback(o.subtotal_cents);
  const { data } = await supabaseAdmin
    .from("orders")
    .update({ cashback_credited: true, cashback_earned_cents: earned })
    .eq("id", orderId)
    .eq("cashback_credited", false)
    .select("id")
    .maybeSingle();
  if (data && earned > 0) {
    await supabaseAdmin.rpc("adjust_cashback", { p_customer: o.customer_id, p_delta: earned });
  }
}

export type OrderStatus =
  | "awaiting_payment"
  | "received"
  | "preparing"
  | "out_for_delivery"
  | "ready_for_pickup"
  | "delivered"
  | "cancelled";

export async function transitionOrder(orderId: string, status: OrderStatus, courierId?: string | null) {
  const { data: o } = await supabaseAdmin.from("orders").select("status, fulfillment").eq("id", orderId).single();
  if (!o) throw new Error("Pedido não encontrado.");
  if (o.status === "cancelled") throw new Error("Pedido cancelado não pode ser alterado.");
  if (o.status === "delivered" && status !== "delivered") throw new Error("Pedido já entregue não pode ser alterado.");
  if (o.status === "awaiting_payment" && status !== "cancelled" && status !== "received")
    throw new Error("Aguardando confirmação do Pix.");

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now };
  if (status === "out_for_delivery") {
    if (o.fulfillment === "delivery" && !courierId) throw new Error("Selecione o motoboy.");
    patch.courier_id = courierId ?? null;
    patch.dispatched_at = now;
  }
  if (status === "delivered") patch.delivered_at = now;
  if (status === "cancelled") patch.cancelled_at = now;
  if (status === "received" && o.status === "awaiting_payment") patch.paid_at = now;

  const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", orderId);
  if (error) throw new Error("Não foi possível atualizar o pedido.");

  if (status === "delivered") await creditCashbackIfNeeded(orderId);
  if (status === "cancelled") await refundCashbackIfNeeded(orderId);
}
