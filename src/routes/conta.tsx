import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ClipboardList, Loader2, LogOut, MapPin, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/store/PageShell";
import { AddressForm, emptyAddress, isAddressComplete, type AddressDraft } from "@/components/store/AddressForm";
import { Button } from "@/components/ui/button";
import { deleteAddress, logoutCustomer, saveAddress } from "@/lib/customer.functions";
import { money, phoneDisplay } from "@/lib/format";
import { useMe } from "@/hooks/use-customer";
import { useSession } from "@/stores/session";
import { STORE_CONFIG } from "@/store.config";
import { residenceTypeLabel } from "@/lib/address";

export const Route = createFileRoute("/conta")({
  head: () => ({
    meta: [
      { title: `Minha conta — ${STORE_CONFIG.storeName}` },
      { name: "description", content: "Seu saldo de cashback e endereços salvos." },
      { property: "og:title", content: `Minha conta — ${STORE_CONFIG.storeName}` },
      { property: "og:description", content: "Cashback e endereços de entrega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { data, loggedIn, hydrated, token, isLoading } = useMe();
  const setToken = useSession((s) => s.setCustomerToken);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const save = useServerFn(saveAddress);
  const del = useServerFn(deleteAddress);
  const logout = useServerFn(logoutCustomer);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<AddressDraft>(emptyAddress);
  const [busy, setBusy] = useState(false);

  if (hydrated && !loggedIn) {
    return (
      <PageShell title="Minha conta">
        <div className="py-16 text-center">
          <Button asChild variant="hero" size="xl">
            <Link to="/entrar" search={{ redirect: "/conta" }}>Entrar</Link>
          </Button>
        </div>
      </PageShell>
    );
  }
  if (!data || isLoading) {
    return (
      <PageShell title="Minha conta">
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["me"] });

  return (
    <PageShell title="Minha conta">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-display text-2xl font-extrabold">{data.customer.name}</p>
        <p className="text-sm text-muted-foreground">{phoneDisplay(data.customer.phone)}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/10 p-5">
        <div className="flex items-center gap-2 text-sm text-accent">
          <Wallet className="size-4" /> Saldo de cashback
        </div>
        <p className="mt-1 font-display text-4xl font-extrabold text-accent">{money(data.customer.cashback_cents)}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Você ganha 2% do valor dos produtos a cada pedido entregue. Use o saldo como desconto no carrinho. Se um pedido for cancelado, o saldo usado volta para cá.
        </p>
      </div>

      <Button asChild variant="soft" className="mt-4 h-12 w-full rounded-2xl">
        <Link to="/pedidos">
          <ClipboardList /> Meus pedidos
        </Link>
      </Button>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Endereços salvos</h2>
          {!adding && (
            <Button size="sm" variant="soft" className="rounded-full" onClick={() => setAdding(true)}>
              <Plus /> Adicionar
            </Button>
          )}
        </div>
        <ul className="space-y-2">
          {data.addresses.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5">
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold">{residenceTypeLabel(a.residence_type)}{a.label ? ` · ${a.label}` : ""}</p>
                <p>
                  {a.street}, {a.number}
                  {a.complement ? ` - ${a.complement}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {a.neighborhood ? `${a.neighborhood}, ` : ""}
                  {a.city}/{a.state} · {a.cep}
                </p>
              </div>
              <button
                aria-label="Excluir endereço"
                className="text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  if (!token || !confirm("Excluir este endereço?")) return;
                  await del({ data: { token, id: a.id } });
                  void refresh();
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {data.addresses.length === 0 && !adding && <p className="text-sm text-muted-foreground">Nenhum endereço salvo ainda.</p>}
        </ul>
        {adding && (
          <div className="mt-3 rounded-2xl border border-border bg-card p-3.5">
            <AddressForm value={draft} onChange={setDraft} showLabel />
            <div className="mt-3 flex gap-2">
              <Button variant="soft" className="flex-1 rounded-full" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 rounded-full"
                disabled={busy || !isAddressComplete(draft)}
                onClick={async () => {
                  if (!token) return;
                  setBusy(true);
                  try {
                    await save({ data: { token, address: draft } });
                    toast.success("Endereço salvo!");
                    setDraft(emptyAddress);
                    setAdding(false);
                    void refresh();
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
      </section>

      <Button
        variant="ghost"
        className="mt-8 w-full text-muted-foreground"
        onClick={async () => {
          if (token) await logout({ data: { token } }).catch(() => null);
          setToken(null);
          qc.removeQueries({ queryKey: ["me"] });
          navigate({ to: "/" });
        }}
      >
        <LogOut /> Sair
      </Button>
    </PageShell>
  );
}
