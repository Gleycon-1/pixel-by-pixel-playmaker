import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook do Mercado Pago (API Orders).
 * Nunca confiamos no corpo recebido: buscamos a ordem diretamente na API do Mercado Pago
 * com o token secreto da loja e só marcamos como pago se a própria API confirmar.
 */
export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        let id = url.searchParams.get("data.id") || url.searchParams.get("id");
        try {
          const body = (await request.json()) as { data?: { id?: string }; id?: string };
          id = body?.data?.id || id;
        } catch {
          /* corpo vazio */
        }
        if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return new Response("ignored", { status: 200 });

        const { fetchMpOrder } = await import("@/lib/mercadopago.server");
        const mp = await fetchMpOrder(id);
        if (!mp || !mp.paid || !mp.externalReference) return new Response("ok", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, mp_order_id")
          .eq("id", mp.externalReference)
          .maybeSingle();
        if (order && order.mp_order_id === mp.id) {
          const { markOrderPaid } = await import("@/lib/orders.server");
          await markOrderPaid(order.id);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
