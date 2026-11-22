import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminSalesReport } from "@/lib/admin.functions";
import { money } from "@/lib/format";
import { useAdmin } from "./use-admin";

type Mode = "day" | "month" | "year";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function range(mode: Mode, ref: string) {
  const [y, m] = ref.split("-");
  if (mode === "day") return { from: `${ref}T00:00:00-03:00`, to: `${ref}T23:59:59-03:00`, label: ref.split("-").reverse().join("/") };
  if (mode === "month") {
    const last = new Date(Number(y), Number(m), 0).getDate();
    return { from: `${y}-${m}-01T00:00:00-03:00`, to: `${y}-${m}-${last}T23:59:59-03:00`, label: `${m}/${y}` };
  }
  return { from: `${y}-01-01T00:00:00-03:00`, to: `${y}-12-31T23:59:59-03:00`, label: String(y) };
}

export function SalesReport() {
  const { token, handleError } = useAdmin();
  const fetchReport = useServerFn(adminSalesReport);
  const [mode, setMode] = useState<Mode>("day");
  const [ref, setRef] = useState(today());
  const r = range(mode, ref);
  const q = useQuery({
    queryKey: ["admin-sales", r.from, r.to],
    queryFn: async () => {
      try {
        return await fetchReport({ data: { token, from: new Date(r.from).toISOString(), to: new Date(r.to).toISOString() } });
      } catch (e) {
        handleError(e);
        return null;
      }
    },
  });
  const d = q.data;
  const methods = [
    ["pix", "Pix"],
    ["credit", "Crédito"],
    ["debit", "Débito"],
    ["cash", "Dinheiro"],
  ] as const;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-display text-lg font-extrabold">Faturamento unificado — {r.label}</h2>
        {(["day", "month", "year"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
            {m === "day" ? "Diário" : m === "month" ? "Mensal" : "Anual"}
          </Button>
        ))}
        <Input type="date" className="w-40" value={ref} onChange={(e) => e.target.value && setRef(e.target.value)} aria-label="Data de referência" />
      </div>
      {d && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Card label="Total geral" value={money(d.totalCents)} sub={`${d.count} vendas`} strong />
            <Card label="Delivery (App)" value={money(d.byChannel.app.cents)} sub={`${d.byChannel.app.count} pedidos`} />
            <Card label="Balcão / PDV" value={money(d.byChannel.pdv.cents)} sub={`${d.byChannel.pdv.count} vendas`} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {methods.map(([k, label]) => (
              <Card key={k} label={label} value={money(d.byMethod[k].cents)} sub={`${d.byMethod[k].count} vendas`} />
            ))}
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="mb-3">
              <h3 className="font-display font-extrabold">Faturamento por categoria</h3>
              <p className="text-xs text-muted-foreground">Produtos vendidos no período, sem taxas de entrega.</p>
            </div>
            {d.byCategory.length ? (
              <div className="divide-y divide-border">
                {d.byCategory.map((category) => (
                  <div key={category.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{category.name}</p>
                      <p className="text-xs text-muted-foreground">{category.quantity} {category.quantity === 1 ? "unidade" : "unidades"}</p>
                    </div>
                    <p className="font-display text-lg font-extrabold">{money(category.cents)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum produto vendido no período.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Card({ label, value, sub, strong }: { label: string; value: string; sub: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-xl bg-primary p-3 text-primary-foreground" : "rounded-xl bg-muted/50 p-3"}>
      <p className="text-[11px] uppercase opacity-80">{label}</p>
      <p className="font-display text-xl font-extrabold">{value}</p>
      <p className="text-xs opacity-80">{sub}</p>
    </div>
  );
}
