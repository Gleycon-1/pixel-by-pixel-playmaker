import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { transitionOrder } from "./orders.server";
import { deliveryPin, maskPhoneTail } from "./rules";
import type { OrderAddress } from "./order-dto";

const token = z.string().min(20).max(100);

async function requireCourier(t: string) {
  const { data } = await supabaseAdmin.from("couriers").select("id,name,active").eq("access_token", t).maybeSingle();
  if (!data || !data.active) throw new Error("Link inválido ou desativado. Peça um novo link à loja.");
  return data;
}

function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("55") ? d : `55${d}`;
}

export const courierPanel = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token }).parse(d))
  .handler(async ({ data }) => {
    const c = await requireCourier(data.token);
    const [{ data: rows }, { data: s }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id,code,customer_name,customer_phone,address,total_cents,payment_method,change_due_cents,cash_change_for_cents,paid_at,notes,gps_tracking,dispatched_at,order_items(name,quantity)")
        .eq("courier_id", c.id)
        .eq("status", "out_for_delivery")
        .order("dispatched_at"),
      supabaseAdmin.from("store_settings").select("require_delivery_pin,store_name").eq("id", 1).single(),
    ]);
    return {
      courier: { name: c.name },
      storeName: s?.store_name ?? null,
      requirePin: !!s?.require_delivery_pin,
      orders: (rows ?? []).map((o) => {
        const tel = waNumber(o.customer_phone);
        // número completo só vai nos links; a tela mostra a versão mascarada
        return {
          id: o.id,
          code: o.code,
          customer_name: o.customer_name,
          phone_masked: maskPhoneTail(o.customer_phone),
          call_href: `tel:+${tel}`,
          whatsapp_href: `https://wa.me/${tel}`,
          address: o.address as OrderAddress | null,
          total_cents: o.total_cents,
          payment_method: o.payment_method,
          change_due_cents: o.change_due_cents,
          paid: !!o.paid_at,
          notes: o.notes,
          gps_tracking: o.gps_tracking,
          items: (o.order_items ?? []) as { name: string; quantity: number }[],
        };
      }),
    };
  });

export const courierUpdateLocation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, orderIds: z.array(z.string().uuid()).min(1).max(20), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(d))
  .handler(async ({ data }) => {
    const c = await requireCourier(data.token);
    await supabaseAdmin
      .from("orders")
      .update({ courier_lat: data.lat, courier_lng: data.lng, courier_location_at: new Date().toISOString() })
      .in("id", data.orderIds)
      .eq("courier_id", c.id)
      .eq("status", "out_for_delivery")
      .eq("gps_tracking", true);
    return { ok: true };
  });

export const courierDeliver = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token, orderId: z.string().uuid(), pin: z.string().max(4).optional().nullable() }).parse(d))
  .handler(async ({ data }) => {
    const c = await requireCourier(data.token);
    const [{ data: o }, { data: s }] = await Promise.all([
      supabaseAdmin.from("orders").select("courier_id,status,customer_phone").eq("id", data.orderId).maybeSingle(),
      supabaseAdmin.from("store_settings").select("require_delivery_pin").eq("id", 1).single(),
    ]);
    if (!o || o.courier_id !== c.id || o.status !== "out_for_delivery") throw new Error("Entrega não encontrada.");
    if (s?.require_delivery_pin && data.pin !== deliveryPin(o.customer_phone)) {
      return { ok: false as const, message: "Código incorreto. Peça ao cliente os 4 últimos dígitos do celular." };
    }
    await transitionOrder(data.orderId, "delivered");
    return { ok: true as const };
  });
