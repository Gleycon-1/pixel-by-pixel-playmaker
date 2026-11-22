import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/store/PageShell";
import { StatusBadge, StatusTimeline } from "@/components/store/OrderBits";
import { WhatsAppIcon } from "@/components/store/icons";
import { Button } from "@/components/ui/button";
import { getMyOrder } from "@/lib/customer.functions";
import { refreshPixStatus } from "@/lib/checkout.functions";
import { catalogQuery } from "@/lib/catalog.functions";
import { dateTime, money, PAYMENT_LABEL } from "@/lib/format";
import { etaDeadline, formatAddress } from "@/lib/order-dto";
import { storeInfo, waLink } from "@/lib/store-info";
import { useSession } from "@/stores/session";
import { useHydrated } from "@/stores/hydration";
import { STORE_CONFIG } from "@/store.config";
import { residenceTypeLabel } from "@/lib/address";
import { deliveryPin } from "@/lib/rules";
import { LiveMap, orderMapPoints } from "@/components/map/LiveMap";

export const Route = createFileRoute("/pedidos/$id")({
  head: () => ({
    meta: [
      { title: `Acompanhar pedido — ${STORE_CONFIG.storeName}` },
      { name: "description", content: "Status do seu pedido em tempo real e pagamento Pix." },
      { property: "og:title", content: `Acompanhar pedido — ${STORE_CONFIG.storeName}` },
      { property: "og:description", content: "Acompanhe seu pedido em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderPage,
});

function PixBox({ orderId, code, total, testMode }: { orderId: string; code: string; total: number; testMode: boolean }) {
  const token = useSession((s) => s.customerToken);
  const qc = useQueryClient();
  const [img, setImg] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(code, { margin: 1, width: 280 }).then(setImg).catch(() => setImg(null));
  }, [code]);

  // Reforço: consulta o status do Pix a cada 4s
  useQuery({
    queryKey: ["pix-status", orderId],
    queryFn: async () => {
      const r = await refreshPixStatus({ data: { token: token!, id: orderId } });
      if (r.status !== "awaiting_payment") qc.invalidateQueries({ queryKey: ["order", orderId] });
      return r;
    },
    enabled: !!token,
    refetchInterval: 4000,
  });

  return (
    <div className="rounded-2xl border border-warning/50 bg-warning/10 p-4 text-center">
      <p className="font-display text-xl font-extrabold">Pague {money(total)} com Pix</p>
      <p className="mt-1 text-sm text-muted-foreground">Seu pedido entra na fila de preparo assim que o pagamento for confirmado.</p>
      {img && <img src={img} alt="QR Code Pix" width={240} height={240} className="mx-auto mt-4 rounded-xl bg-foreground p-2" />}
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-background/60 p-2">
        <code className="min-w-0 flex-1 truncate text-left text-xs">{code}</code>
        <Button
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            toast.success("Código Pix copiado!");
          }}
        >
          <Copy /> Copiar
        </Button>
      </div>
      <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Aguardando confirmação do pagamento…
      </p>
      {testMode && (
        <p className="mt-3 text-center text-xs text-muted-foreground">Modo teste: a loja confirma o pagamento pelo painel.</p>
      )}
    </div>
  );
}

function OrderPage() {
  const { id } = Route.useParams();
  const hydrated = useHydrated();
  const token = useSession((s) => s.customerToken);
  const { data: catalog } = useQuery(catalogQuery);
  const info = storeInfo(catalog?.settings);

  const q = useQuery({
    queryKey: ["order", id],
    queryFn: () => getMyOrder({ data: { token: token!, id } }),
    enabled: hydrated && !!token,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "delivered" || s === "cancelled" ? false : 8000;
    },
  });
  const o = q.data;

  if (hydrated && !token) {
    return (
      <PageShell title="Pedido" back="/pedidos">
        <div className="py-16 text-center">
          <Button asChild variant="hero" size="xl">
            <Link to="/entrar" search={{ redirect: `/pedidos/${id}` }}>Entrar para ver o pedido</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  if (!o) {
    return (
      <PageShell title="Pedido" back="/pedidos">
        <div className="flex justify-center py-16">
          {q.error ? <p className="text-destructive">{(q.error as Error).message}</p> : <Loader2 className="size-6 animate-spin text-muted-foreground" />}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={`Pedido #${o.code}`} back="/pedidos" action={<StatusBadge status={o.status} />}>
      <div className="space-y-4">
        {o.status === "awaiting_payment" && o.pix_qr_code && (
          <PixBox orderId={o.id} code={o.pix_qr_code} total={o.total_cents} testMode={catalog?.settings.pix_test_mode ?? false} />
        )}

        {o.status === "cancelled" ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-bold text-destructive">Pedido cancelado.</p>
            {o.cashback_used_cents > 0 && <p className="mt-1">O cashback usado ({money(o.cashback_used_cents)}) voltou para sua carteira.</p>}
          </div>
        ) : (
          o.status !== "awaiting_payment" && (
            <div className="rounded-2xl border border-border bg-card p-4">
              {o.fulfillment === "delivery" && o.eta_minutes && !["delivered", "cancelled"].includes(o.status) && (
                <p className="mb-3 rounded-xl bg-accent/15 p-3 text-center text-sm font-bold text-accent">
                  🛵 Seu pedido será entregue em até {o.eta_minutes} min (previsão {etaDeadline(o)})
                </p>
              )}
              {o.fulfillment === "delivery" && deliveryPin(o.customer_phone) && !["delivered", "cancelled"].includes(o.status) && (
                <div className="mb-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-center">
                  <p className="text-xs font-bold uppercase text-primary">Código de entrega</p>
                  <p className="font-display text-3xl font-extrabold tracking-[0.4em]">{deliveryPin(o.customer_phone)}</p>
                  <p className="text-xs text-muted-foreground">São os 4 últimos dígitos do seu celular. Informe ao motoboy só quando receber o pedido.</p>
                </div>
              )}
              <StatusTimeline status={o.status} fulfillment={o.fulfillment} />
              {o.fulfillment === "delivery" && o.gps_tracking && o.status === "out_for_delivery" && (
                <div className="mt-4"><LiveMap {...orderMapPoints(o)} updatedAt={o.courier_location_at} /></div>
              )}
              {o.status === "delivered" && o.cashback_earned_cents > 0 && (
                <p className="mt-4 rounded-xl bg-accent/10 p-3 text-sm text-accent">🎉 Você ganhou {money(o.cashback_earned_cents)} de cashback neste pedido!</p>
              )}
            </div>
          )
        )}

        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="mb-2 text-xs text-muted-foreground">{dateTime(o.created_at)}</p>
          <ul className="space-y-1">
            {o.order_items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span>
                  {i.quantity}x {i.name}
                </span>
                <span>{money(i.unit_price_cents * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 border-t border-border pt-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{money(o.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Entrega {o.billed_km ? `(${o.billed_km} km)` : ""}</span>
              <span>{o.fulfillment === "pickup" ? "Retirada" : money(o.delivery_fee_cents)}</span>
            </div>
            {o.cashback_used_cents > 0 && (
              <div className="flex justify-between text-accent">
                <span>Cashback</span>
                <span>- {money(o.cashback_used_cents)}</span>
              </div>
            )}
            <div className="flex justify-between font-display text-lg font-extrabold">
              <span>Total</span>
              <span className="text-primary">{money(o.total_cents)}</span>
            </div>
          </div>
          <p className="mt-3">
            <b>Pagamento:</b> {PAYMENT_LABEL[o.payment_method]}
            {o.card_type ? ` (${o.card_type === "debit" ? "débito" : "crédito"})` : ""}
            {o.change_due_cents > 0 ? ` — troco de ${money(o.change_due_cents)}` : ""}
          </p>
          {o.address && (
            <div className="mt-2 flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <p><b>{residenceTypeLabel(o.address.residence_type)}:</b> {formatAddress(o.address)}</p>
            </div>
          )}
          {o.notes && <p className="mt-2 text-muted-foreground">Obs: {o.notes}</p>}
        </div>

        <Button asChild variant="whatsapp" size="xl" className="w-full">
          <a href={waLink(info.whatsappNumber, `Olá! Sobre o meu pedido #${o.code}:`)} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon /> Falar com a loja sobre o pedido
          </a>
        </Button>
      </div>
    </PageShell>
  );
}
