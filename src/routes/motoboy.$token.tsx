import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Navigation, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { courierDeliver, courierPanel, courierUpdateLocation } from "@/lib/courier.functions";
import { money } from "@/lib/format";
import { formatAddress, mapsLinkFor } from "@/lib/order-dto";
import { residenceTypeLabel } from "@/lib/address";

export const Route = createFileRoute("/motoboy/$token")({
  head: () => ({
    meta: [
      { title: "Minhas entregas — Painel do motoboy" },
      { name: "description", content: "Entregas ativas do motoboy, com rota, contato do cliente e confirmação de entrega." },
      { property: "og:title", content: "Minhas entregas — Painel do motoboy" },
      { property: "og:description", content: "Entregas ativas do motoboy, com rota e confirmação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CourierPage,
});

function CourierPage() {
  const { token } = Route.useParams();
  const fetchPanel = useServerFn(courierPanel);
  const sendLoc = useServerFn(courierUpdateLocation);
  const q = useQuery({ queryKey: ["courier", token], queryFn: () => fetchPanel({ data: { token } }), refetchInterval: 10000, retry: false });
  const tracked = (q.data?.orders ?? []).filter((o) => o.gps_tracking).map((o) => o.id);
  const trackedKey = tracked.join(",");
  const [gps, setGps] = useState<"off" | "on" | "denied">("off");
  const last = useRef(0);

  // Só pede/transmite localização quando algum pedido tem rastreio GPS ligado
  useEffect(() => {
    if (!trackedKey || !("geolocation" in navigator)) {
      setGps("off");
      return;
    }
    const ids = trackedKey.split(",");
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGps("on");
        if (Date.now() - last.current < 8000) return;
        last.current = Date.now();
        void sendLoc({ data: { token, orderIds: ids, lat: p.coords.latitude, lng: p.coords.longitude } }).catch(() => {});
      },
      () => setGps("denied"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [trackedKey, token, sendLoc]);

  if (q.error) return <Shell><p className="py-16 text-center text-destructive">{(q.error as Error).message}</p></Shell>;
  if (!q.data) return <Shell><div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin" /></div></Shell>;
  const d = q.data;

  return (
    <Shell title={`Olá, ${d.courier.name}`} subtitle={d.storeName ?? undefined}>
      {tracked.length > 0 && (
        <p className={`rounded-xl p-3 text-sm font-bold ${gps === "denied" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
          {gps === "denied" ? "⚠️ Libere a localização no navegador: a loja pediu rastreio GPS desta entrega." : gps === "on" ? "📡 Compartilhando sua localização com a loja e o cliente." : "📡 Ativando GPS…"}
        </p>
      )}
      {d.orders.length === 0 && <p className="py-16 text-center text-muted-foreground">Nenhuma entrega ativa agora. Esta tela atualiza sozinha.</p>}
      {d.orders.map((o) => <DeliveryCard key={o.id} o={o} token={token} requirePin={d.requirePin} onDone={() => q.refetch()} />)}
    </Shell>
  );
}

type Order = Awaited<ReturnType<typeof courierPanel>>["orders"][number];

function DeliveryCard({ o, token, requirePin, onDone }: { o: Order; token: string; requirePin: boolean; onDone: () => void }) {
  const deliver = useServerFn(courierDeliver);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const finish = async () => {
    setBusy(true);
    try {
      const r = await deliver({ data: { token, orderId: o.id, pin: requirePin ? pin : null } });
      if (!r.ok) toast.error(r.message);
      else {
        toast.success(`Entrega #${o.code} finalizada!`);
        onDone();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const collect = o.paid ? "Já pago" : o.payment_method === "cash" ? `Cobrar ${money(o.total_cents)} em dinheiro${o.change_due_cents ? ` · levar troco ${money(o.change_due_cents)}` : ""}` : `Cobrar ${money(o.total_cents)} na maquininha`;

  return (
    <article className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-xl font-extrabold">#{o.code}</p>
        {o.gps_tracking && <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-extrabold text-primary">GPS</span>}
      </div>
      <div>
        <p className="font-bold">{o.customer_name}</p>
        <p className="text-sm text-muted-foreground" aria-label="Telefone do cliente">{o.phone_masked}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" asChild><a href={o.call_href}><Phone /> Ligar</a></Button>
        <Button variant="outline" asChild><a href={o.whatsapp_href} target="_blank" rel="noreferrer">WhatsApp</a></Button>
      </div>
      <div className="flex gap-2 text-sm">
        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="font-bold text-primary">{residenceTypeLabel(o.address?.residence_type)}</p>
          <p>{formatAddress(o.address)}</p>
          {o.address?.reference && <p className="text-muted-foreground">Ref: {o.address.reference}</p>}
        </div>
      </div>
      <Button variant="secondary" className="w-full" asChild><a href={mapsLinkFor(o.address)} target="_blank" rel="noreferrer"><Navigation /> Abrir rota</a></Button>
      <ul className="text-sm">{o.items.map((i, k) => <li key={k}>{i.quantity}x {i.name}</li>)}</ul>
      {o.notes && <p className="rounded bg-muted p-2 text-sm">📝 {o.notes}</p>}
      <p className="rounded-xl bg-accent/15 p-2 text-sm font-bold text-accent">{collect}</p>
      {requirePin && (
        <Input inputMode="numeric" maxLength={4} placeholder="Código de entrega (4 dígitos)" aria-label="Código de entrega" className="h-12 text-center text-xl tracking-[0.5em]" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
      )}
      <Button size="lg" className="w-full" disabled={busy || (requirePin && pin.length !== 4)} onClick={finish}>
        <CheckCircle2 /> Finalizar entrega
      </Button>
    </article>
  );
}

function Shell({ children, title, subtitle }: { children: React.ReactNode; title?: string | undefined; subtitle?: string | undefined }) {
  return (
    <main className="mx-auto min-h-screen max-w-lg space-y-3 p-4">
      <header className="pb-2">
        <h1 className="font-display text-2xl font-extrabold">{title ?? "Painel do motoboy"}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      {children}
    </main>
  );
}
