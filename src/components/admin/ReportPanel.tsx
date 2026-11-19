import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCourierReport } from "@/lib/admin.functions";
import { dateTime, money, PAYMENT_LABEL } from "@/lib/format";
import { waLink } from "@/lib/store-info";
import { useAdmin } from "./use-admin";
import { SalesReport } from "./SalesReport";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function ReportPanel() {
  const { token, handleError } = useAdmin();
  const report = useServerFn(adminCourierReport);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const q = useQuery({
    queryKey: ["admin-report", from, to],
    queryFn: async () => {
      try {
        return await report({ data: { token, from: new Date(`${from}T00:00:00-03:00`).toISOString(), to: new Date(`${to}T23:59:59-03:00`).toISOString() } });
      } catch (e) {
        handleError(e);
        return [];
      }
    },
  });
  const km = (n: number) => `${n.toFixed(1).replace(".", ",")} km`;

  return (
    <div className="space-y-4 pt-2">
      <SalesReport />
      <h2 className="font-display text-lg font-extrabold">Total a acertar com motoboys</h2>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <Button variant="outline" onClick={() => { setFrom(today()); setTo(today()); }}>Hoje</Button>
      </div>
      {(q.data ?? []).filter((r) => r.count > 0).map((r) => {
        const msg = [
          `🧾 *Total a Acertar* — ${r.courier.name}`,
          `Período: ${from.split("-").reverse().join("/")} a ${to.split("-").reverse().join("/")}`,
          `Corridas: ${r.count} · ${km(r.distanceKm)}`,
          `Taxas de entrega (a receber): ${money(r.feesCents)}`,
          `Dinheiro coletado (a devolver): ${money(r.cashCollectedCents)}`,
          `*Saldo: ${r.cashCollectedCents - r.feesCents >= 0 ? `motoboy devolve ${money(r.cashCollectedCents - r.feesCents)}` : `loja paga ${money(r.feesCents - r.cashCollectedCents)}`}*`,
        ].join("\n");
        const net = r.cashCollectedCents - r.feesCents;
        return (
          <section key={r.courier.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-extrabold">{r.courier.name} <span className="text-sm text-muted-foreground">{r.courier.plate}</span></h3>
              <Button size="sm" variant="outline" asChild><a href={waLink(r.courier.whatsapp, msg)} target="_blank" rel="noreferrer">Enviar acerto no WhatsApp</a></Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="Corridas" value={String(r.count)} />
              <Stat label="KM rodado" value={km(r.distanceKm)} />
              <Stat label="Taxas (motoboy)" value={money(r.feesCents)} />
              <Stat label="Dinheiro coletado" value={money(r.cashCollectedCents)} />
              <Stat label="Total a acertar" value={net >= 0 ? `Devolve ${money(net)}` : `Receber ${money(-net)}`} strong />
            </div>
            <table className="mt-3 w-full text-xs">
              <thead className="text-left text-muted-foreground"><tr><th>Pedido</th><th>Entregue</th><th>Cliente</th><th>KM</th><th>Pgto</th><th className="text-right">Taxa</th></tr></thead>
              <tbody>
                {r.rides.map((x) => (
                  <tr key={x.id} className="border-t border-border">
                    <td>#{x.code}</td><td>{x.delivered_at ? dateTime(x.delivered_at) : "-"}</td><td>{x.customer_name}</td>
                    <td>{x.distance_km != null ? km(x.distance_km) : "-"}</td><td>{PAYMENT_LABEL[x.payment_method]}{x.payment_method === "cash" ? ` ${money(x.total_cents)}` : ""}</td>
                    <td className="text-right">{money(x.delivery_fee_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      {q.data && !q.data.some((r) => r.count > 0) && <p className="text-sm text-muted-foreground">Nenhuma entrega no período.</p>}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-xl bg-primary p-2 text-primary-foreground" : "rounded-xl bg-muted/50 p-2"}>
      <p className="text-[11px] uppercase opacity-80">{label}</p>
      <p className="font-display font-extrabold">{value}</p>
    </div>
  );
}
