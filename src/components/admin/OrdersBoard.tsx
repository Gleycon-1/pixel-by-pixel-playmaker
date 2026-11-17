import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, Clock, MapPin, Minus, Plus, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminCouriers, adminGetSettings, adminOrders, adminQuickSettings, adminSetOrderEta, adminSetOrderStatus } from "@/lib/admin.functions";
import { courierMessage, paymentTag, receiptMessage } from "@/lib/admin-messages";
import { dateTime, money, phoneDisplay } from "@/lib/format";
import { etaDeadline, formatAddress, mapsLinkFor, type OrderDTO } from "@/lib/order-dto";
import { storeInfo, waLink } from "@/lib/store-info";
import { cn } from "@/lib/utils";
import { useAdmin } from "./use-admin";
import { beep, printReceipt, unlockAudio } from "./receipt";
import { residenceTypeLabel } from "@/lib/address";

const COLUMNS = [
  { key: "received", title: "Recebido", statuses: ["awaiting_payment", "received"] },
  { key: "preparing", title: "Preparando", statuses: ["preparing"] },
  { key: "out", title: "Saiu para entrega", statuses: ["out_for_delivery", "ready_for_pickup"] },
  { key: "done", title: "Entregue", statuses: ["delivered"] },
] as const;

const SOURCE_LABEL: Record<string, string> = { online: "ONLINE", counter: "BALCÃO", whatsapp: "WHATSAPP" };

export function OrdersBoard() {
  const { token, run, handleError } = useAdmin();
  const qc = useQueryClient();
  const fetchOrders = useServerFn(adminOrders);
  const fetchCouriers = useServerFn(adminCouriers);
  const fetchSettings = useServerFn(adminGetSettings);
  const quick = useServerFn(adminQuickSettings);
  const [sound, setSound] = useState(true);

  const active = useQuery({
    queryKey: ["admin-orders", "active"],
    queryFn: () => fetchOrders({ data: { token, scope: "active" } }),
    refetchInterval: 5000,
    retry: false,
  });
  const history = useQuery({
    queryKey: ["admin-orders", "history"],
    queryFn: () => fetchOrders({ data: { token, scope: "history" } }),
    refetchInterval: 15000,
    retry: false,
  });
  const couriers = useQuery({ queryKey: ["admin-couriers"], queryFn: () => fetchCouriers({ data: { token } }) });
  const settings = useQuery({ queryKey: ["admin-settings"], queryFn: () => fetchSettings({ data: { token } }) });
  useEffect(() => {
    const e = active.error ?? history.error;
    if (e) handleError(e);
  }, [active.error, history.error, handleError]);

  // Alerta sonoro para novos pedidos online
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!active.data) return;
    const ids = active.data.filter((o) => o.source === "online" && o.status === "received").map((o) => o.id);
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seen.current!.has(id));
    ids.forEach((id) => seen.current!.add(id));
    if (fresh.length && sound) beep();
  }, [active.data, sound]);

  const all = useMemo(() => {
    const since = Date.now() - 24 * 36e5;
    const done = (history.data ?? []).filter((o) => o.status === "delivered" && new Date(o.delivered_at ?? o.created_at).getTime() > since);
    return [...(active.data ?? []), ...done];
  }, [active.data, history.data]);

  const s = settings.data;
  const storeName = storeInfo(s ?? null).name;
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-orders"] });
  const setQuick = async (patch: { store_mode?: "open" | "closed" | "auto"; eta_minutes?: number }) => {
    await run(() => quick({ data: { ...patch, token } }));
    void qc.invalidateQueries({ queryKey: ["admin-settings"] });
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-sm font-bold">Loja:</span>
        {(["open", "closed", "auto"] as const).map((m) => (
          <Button key={m} size="sm" variant={s?.store_mode === m ? "default" : "outline"} onClick={() => setQuick({ store_mode: m })}>
            {m === "open" ? "Aberta" : m === "closed" ? "Fechada" : `Automático (${s?.open_time ?? ""}–${s?.close_time ?? ""})`}
          </Button>
        ))}
        <span className="ml-2 flex items-center gap-1 text-sm font-bold"><Clock className="size-4" /> Entrega em até</span>
        <Button size="icon" variant="outline" className="size-8" aria-label="Diminuir tempo" onClick={() => s && setQuick({ eta_minutes: Math.max(5, s.eta_minutes - 5) })}><Minus /></Button>
        <span className="min-w-14 text-center font-display text-lg font-extrabold">{s?.eta_minutes ?? "–"} min</span>
        <Button size="icon" variant="outline" className="size-8" aria-label="Aumentar tempo" onClick={() => s && setQuick({ eta_minutes: Math.min(300, s.eta_minutes + 5) })}><Plus /></Button>
        <Button
          size="sm"
          variant={sound ? "secondary" : "outline"}
          className="ml-auto"
          onClick={() => {
            unlockAudio();
            setSound(!sound);
            if (!sound) beep();
          }}
        >
          {sound ? <Bell /> : <BellOff />} Som {sound ? "ligado" : "desligado"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = all.filter((o) => (col.statuses as readonly string[]).includes(o.status));
          return (
            <section key={col.key} className="flex min-h-40 flex-col rounded-2xl bg-muted/40 p-2">
              <h2 className="flex items-center justify-between px-2 py-1 font-display font-extrabold">
                {col.title} <Badge variant="secondary">{list.length}</Badge>
              </h2>
              <div className="mt-1 flex flex-col gap-2">
                {list.map((o) => (
                  <OrderCard key={o.id} o={o} couriers={couriers.data ?? []} storeName={storeName} onChange={refresh} />
                ))}
                {!list.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nenhum pedido</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

type Courier = { id: string; name: string; whatsapp: string; active: boolean; plate: string | null };

function OrderCard({ o, couriers, storeName, onChange }: { o: OrderDTO; couriers: Courier[]; storeName: string; onChange: () => void }) {
  const { token, run } = useAdmin();
  const setStatus = useServerFn(adminSetOrderStatus);
  const setEta = useServerFn(adminSetOrderEta);
  const [courierId, setCourierId] = useState<string>(o.courier_id ?? "");
  const tag = paymentTag(o);
  const isDelivery = o.fulfillment === "delivery";

  const go = async (status: "received" | "preparing" | "out_for_delivery" | "ready_for_pickup" | "delivered" | "cancelled", cId?: string) => {
    const r = await run(() => setStatus({ data: { token, orderId: o.id, status, courierId: cId ?? null } }));
    if (r) onChange();
    return r;
  };

  const dispatch = async () => {
    const c = couriers.find((x) => x.id === courierId);
    if (!c) return;
    // abre a janela antes do await para não ser bloqueada
    const w = window.open("", "_blank");
    const r = await go("out_for_delivery", c.id);
    if (r && w) w.location.href = waLink(c.whatsapp, courierMessage(o, storeName));
    else w?.close();
  };

  return (
    <article className={cn("rounded-xl border bg-card p-3 text-sm shadow-sm", o.status === "received" && o.source === "online" ? "border-primary" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-extrabold">#{o.code}</p>
          <p className="text-xs text-muted-foreground">{dateTime(o.created_at)} · {SOURCE_LABEL[o.source] ?? o.source}</p>
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-extrabold",
            tag.tone === "success" && "bg-success text-success-foreground",
            tag.tone === "info" && "bg-primary/20 text-primary",
            tag.tone === "warning" && "bg-warning text-warning-foreground",
            tag.tone === "muted" && "bg-muted text-muted-foreground",
          )}
        >
          {tag.label}
        </span>
      </div>
      <p className="mt-2 font-bold">{o.customer_name}</p>
      {o.customer_phone && <p className="text-xs text-muted-foreground">{phoneDisplay(o.customer_phone)}</p>}
      {isDelivery ? (
        <div className="mt-1 flex items-start gap-1 text-xs">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <div>
            <p className="mb-0.5 font-bold text-primary">{residenceTypeLabel(o.address?.residence_type)}</p>
            <a href={mapsLinkFor(o.address)} target="_blank" rel="noreferrer" className="underline">{formatAddress(o.address)}</a>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-xs font-bold text-accent">RETIRADA NA LOJA</p>
      )}
      <ul className="mt-2 space-y-0.5 border-t border-border pt-2">
        {o.order_items.map((i) => (
          <li key={i.id}>{i.quantity}x {i.name}</li>
        ))}
      </ul>
      {o.notes && <p className="mt-1 rounded bg-muted p-1.5 text-xs">📝 {o.notes}</p>}
      <p className="mt-2 font-extrabold">Total {money(o.total_cents)}</p>

      {isDelivery && o.eta_minutes && !["delivered", "cancelled"].includes(o.status) && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <Clock className="size-3.5" /> até {o.eta_minutes} min ({etaDeadline(o)})
          <Button size="icon" variant="ghost" className="ml-auto size-6" aria-label="Menos 5 min" onClick={async () => { if (await run(() => setEta({ data: { token, orderId: o.id, minutes: Math.max(5, o.eta_minutes! - 5) } }))) onChange(); }}><Minus /></Button>
          <Button size="icon" variant="ghost" className="size-6" aria-label="Mais 5 min" onClick={async () => { if (await run(() => setEta({ data: { token, orderId: o.id, minutes: o.eta_minutes! + 5 } }))) onChange(); }}><Plus /></Button>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {o.status === "received" && <Button size="sm" onClick={() => go("preparing")}>Iniciar preparo</Button>}
        {o.status === "preparing" && isDelivery && (
          <div className="flex gap-1">
            <Select value={courierId} onValueChange={setCourierId}>
              <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Motoboy" /></SelectTrigger>
              <SelectContent>
                {couriers.filter((c) => c.active).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!courierId} onClick={dispatch}>Despachar</Button>
          </div>
        )}
        {o.status === "preparing" && !isDelivery && <Button size="sm" onClick={() => go("ready_for_pickup")}>Pronto p/ retirada</Button>}
        {(o.status === "out_for_delivery" || o.status === "ready_for_pickup") && (
          <Button size="sm" variant="secondary" onClick={() => go("delivered")}>Marcar entregue</Button>
        )}
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => printReceipt(o, storeName, 58)}><Printer className="size-3" /> 58mm</Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => printReceipt(o, storeName, 80)}><Printer className="size-3" /> 80mm</Button>
          {o.customer_phone && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
              <a href={waLink(o.customer_phone, receiptMessage(o, storeName))} target="_blank" rel="noreferrer">Cupom WhatsApp</a>
            </Button>
          )}
          {!["delivered", "cancelled"].includes(o.status) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-destructive"
              onClick={() => confirm(`Cancelar o pedido #${o.code}?`) && go("cancelled")}
            >
              <X className="size-3" /> Cancelar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
