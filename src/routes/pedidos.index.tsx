import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2 } from "lucide-react";
import { PageShell } from "@/components/store/PageShell";
import { StatusBadge } from "@/components/store/OrderBits";
import { Button } from "@/components/ui/button";
import { myOrders } from "@/lib/customer.functions";
import { dateTime, money } from "@/lib/format";
import { useSession } from "@/stores/session";
import { useHydrated } from "@/stores/hydration";
import { STORE_CONFIG } from "@/store.config";

export const Route = createFileRoute("/pedidos/")({
  head: () => ({
    meta: [
      { title: `Meus pedidos — ${STORE_CONFIG.storeName}` },
      { name: "description", content: "Acompanhe o status dos seus pedidos em tempo real." },
      { property: "og:title", content: `Meus pedidos — ${STORE_CONFIG.storeName}` },
      { property: "og:description", content: "Histórico e status dos seus pedidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const hydrated = useHydrated();
  const token = useSession((s) => s.customerToken);
  const q = useQuery({
    queryKey: ["my-orders", token],
    queryFn: () => myOrders({ data: { token: token! } }),
    enabled: hydrated && !!token,
    refetchInterval: 10_000,
  });

  if (hydrated && !token) {
    return (
      <PageShell title="Meus pedidos">
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Entre para ver seus pedidos.</p>
          <Button asChild variant="hero" size="xl" className="mt-4">
            <Link to="/entrar" search={{ redirect: "/pedidos" }}>Entrar</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Meus pedidos">
      {!q.data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : q.data.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Você ainda não fez pedidos.</p>
          <Button asChild variant="hero" size="xl" className="mt-4">
            <Link to="/">Ver cardápio</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {q.data.map((o) => (
            <li key={o.id}>
              <Link to="/pedidos/$id" params={{ id: o.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-extrabold">#{o.code}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{o.order_items.map((i) => `${i.quantity}x ${i.name}`).join(" · ")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{dateTime(o.created_at)}</p>
                </div>
                <span className="font-display font-extrabold text-primary">{money(o.total_cents)}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
