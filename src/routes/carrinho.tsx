import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Banknote, Bike, CreditCard, Loader2, MapPin, Minus, Plus, QrCode, Store, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/store/PageShell";
import { AddressForm, emptyAddress, isAddressComplete, type AddressDraft } from "@/components/store/AddressForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { catalogQuery } from "@/lib/catalog.functions";
import { placeOrder, quoteFreight } from "@/lib/checkout.functions";
import { money, parseMoneyInput } from "@/lib/format";
import { calcChange, usableCashback } from "@/lib/rules";
import { cartTotals, useCart } from "@/stores/cart";
import { useHydrated } from "@/stores/hydration";
import { useMe } from "@/hooks/use-customer";
import { STORE_CONFIG } from "@/store.config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: `Carrinho — ${STORE_CONFIG.storeName}` },
      { name: "description", content: "Revise seus itens, calcule o frete pelo CEP e finalize o pedido." },
      { property: "og:title", content: `Carrinho — ${STORE_CONFIG.storeName}` },
      { property: "og:description", content: "Finalize seu pedido de bebidas geladas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: CartPage,
});

function Option({ active, onClick, icon, title, subtitle, disabled }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; subtitle?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors disabled:opacity-40",
        active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function CartPage() {
  const hydrated = useHydrated();
  const { data: catalog } = useSuspenseQuery(catalogQuery);
  const settings = catalog.settings;
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const { data: me, loggedIn, token } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(placeOrder);

  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [addressId, setAddressId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<AddressDraft>(emptyAddress);
  const [saveAddr, setSaveAddr] = useState(true);
  const [payment, setPayment] = useState<"pix" | "card" | "cash" | null>(null);
  const [cardType, setCardType] = useState<"debit" | "credit">("debit");
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [useCb, setUseCb] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  // Mantém preço/disponibilidade atualizados com o cardápio
  const lines = useMemo(
    () =>
      items.map((i) => {
        const p = catalog.products.find((x) => x.id === i.productId);
        return { ...i, priceCents: p?.price_cents ?? i.priceCents, available: p ? p.available : false };
      }),
    [items, catalog.products],
  );
  const subtotal = lines.reduce((a, l) => a + l.priceCents * l.qty, 0);
  const count = cartTotals(items).count;
  const unavailable = lines.filter((l) => !l.available);

  const addresses = me?.addresses ?? [];
  const effectiveAddressId = addressId ?? addresses[0]?.id ?? "new";
  const selectedSaved = addresses.find((a) => a.id === effectiveAddressId) ?? null;
  const quoteAddress = selectedSaved
    ? { cep: selectedSaved.cep, street: selectedSaved.street, number: selectedSaved.number, neighborhood: selectedSaved.neighborhood, city: selectedSaved.city, state: selectedSaved.state }
    : isAddressComplete(draft)
      ? { cep: draft.cep, street: draft.street, number: draft.number, neighborhood: draft.neighborhood, city: draft.city, state: draft.state }
      : null;

  const quote = useQuery({
    queryKey: ["quote", quoteAddress],
    queryFn: () => quoteFreight({ data: quoteAddress! }),
    enabled: fulfillment === "delivery" && !!quoteAddress && loggedIn,
    retry: false,
    staleTime: 5 * 60_000,
  });

  const fee = fulfillment === "delivery" && quote.data?.ok ? quote.data.feeCents : 0;
  const balance = me?.customer.cashback_cents ?? 0;
  const cashbackUsed = useCb ? usableCashback(balance, subtotal) : 0;
  const total = subtotal + fee - cashbackUsed;
  const changeForCents = parseMoneyInput(changeFor);
  const change = needsChange ? calcChange(total, changeForCents) : 0;

  const deliveryReady = fulfillment === "pickup" || (quote.data?.ok ?? false);
  const canSubmit =
    !busy && count > 0 && unavailable.length === 0 && payment !== null && deliveryReady && settings.store_open && (payment !== "cash" || !needsChange || (change !== null && changeForCents > 0));

  const onSubmit = async () => {
    if (!token || !payment) return;
    setBusy(true);
    try {
      const r = await submit({
        data: {
          token,
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
          fulfillment,
          addressId: fulfillment === "delivery" && selectedSaved ? selectedSaved.id : null,
          newAddress: fulfillment === "delivery" && !selectedSaved ? draft : null,
          saveAddress: saveAddr,
          paymentMethod: payment,
          cardType: payment === "card" ? cardType : null,
          needsChange: payment === "cash" && needsChange,
          cashChangeForCents: payment === "cash" && needsChange ? changeForCents : null,
          useCashback: useCb,
          notes: notes || null,
        },
      });
      clear();
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      toast.success(`Pedido #${r.code} enviado!`);
      navigate({ to: "/pedidos/$id", params: { id: r.orderId } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!hydrated) {
    return (
      <PageShell title="Carrinho">
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (count === 0) {
    return (
      <PageShell title="Carrinho">
        <div className="flex flex-col items-center py-20 text-center">
          <p className="text-5xl">🧊</p>
          <h2 className="mt-4 text-2xl font-extrabold">Seu carrinho está vazio</h2>
          <p className="mt-1 text-muted-foreground">Bora escolher umas geladas?</p>
          <Button asChild variant="hero" size="xl" className="mt-6">
            <Link to="/">Ver cardápio</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Carrinho">
      {!settings.store_open && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" /> A loja está fechada no momento. Você pode montar o carrinho, mas não finalizar.
        </div>
      )}

      {/* Itens */}
      <ul className="space-y-2.5">
        {lines.map((l) => (
          <li key={l.productId} className={cn("flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5", !l.available && "opacity-60")}>
            {l.imageUrl ? (
              <img src={l.imageUrl} alt="" width={64} height={64} className="size-16 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="size-16 shrink-0 rounded-xl bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-bold">{l.name}</p>
              <p className="text-sm font-extrabold text-primary">{money(l.priceCents * l.qty)}</p>
              {!l.available && <p className="text-xs font-bold text-destructive">Esgotado — remova para continuar</p>}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-muted p-0.5">
              <button className="flex size-8 items-center justify-center rounded-full bg-secondary" onClick={() => setQty(l.productId, l.qty - 1)} aria-label="Diminuir">
                {l.qty === 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" />}
              </button>
              <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
              <button className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground" onClick={() => setQty(l.productId, l.qty + 1)} aria-label="Aumentar">
                <Plus className="size-3.5" />
              </button>
            </div>
            {!l.available && (
              <button onClick={() => remove(l.productId)} className="text-destructive" aria-label="Remover">
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {!loggedIn ? (
        <div className="mt-8 rounded-2xl border border-primary/40 bg-primary/10 p-5 text-center">
          <h2 className="text-xl font-extrabold">Falta pouco!</h2>
          <p className="mt-1 text-sm text-muted-foreground">Entre com seu WhatsApp e PIN para calcular o frete e finalizar.</p>
          <Button asChild variant="hero" size="xl" className="mt-4 w-full">
            <Link to="/entrar" search={{ redirect: "/carrinho" }}>
              Entrar e finalizar · {money(subtotal)}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <Section title="Como você quer receber?">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Option active={fulfillment === "delivery"} onClick={() => setFulfillment("delivery")} icon={<Bike className="size-5" />} title="Entrega" subtitle={`Até ${settings.raio_maximo_km} km`} />
              <Option
                active={fulfillment === "pickup"}
                onClick={() => setFulfillment("pickup")}
                icon={<Store className="size-5" />}
                title="Retirar na loja"
                subtitle="Sem taxa de entrega"
                disabled={!settings.allow_pickup}
              />
            </div>
          </Section>

          {fulfillment === "delivery" && (
            <Section title="Endereço de entrega">
              <div className="space-y-2">
                {addresses.map((a) => (
                  <Option
                    key={a.id}
                    active={effectiveAddressId === a.id}
                    onClick={() => setAddressId(a.id)}
                    icon={<MapPin className="size-5" />}
                    title={a.label || `${a.street}, ${a.number}`}
                    subtitle={`${a.street}, ${a.number} - ${a.neighborhood ?? ""} ${a.city}/${a.state}`}
                  />
                ))}
                {addresses.length > 0 && (
                  <Option active={effectiveAddressId === "new"} onClick={() => setAddressId("new")} icon={<Plus className="size-5" />} title="Novo endereço" />
                )}
              </div>
              {effectiveAddressId === "new" && (
                <div className="mt-3 rounded-2xl border border-border bg-card p-3.5">
                  <AddressForm value={draft} onChange={setDraft} />
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <Switch checked={saveAddr} onCheckedChange={setSaveAddr} /> Salvar este endereço
                  </label>
                </div>
              )}

              <div className="mt-3">
                {quote.isFetching && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Calculando distância e frete…
                  </p>
                )}
                {quote.error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{(quote.error as Error).message}</p>}
                {quote.data && !quote.isFetching && quote.data.ok && (
                  <div className="flex items-center justify-between rounded-xl border border-success/40 bg-success/10 p-3 text-sm">
                    <span>
                      📍 {quote.data.distanceKm.toFixed(1).replace(".", ",")} km (cobrado {quote.data.billedKm} km)
                    </span>
                    <span className="font-extrabold text-success">{money(quote.data.feeCents)}</span>
                  </div>
                )}
                {quote.data && !quote.isFetching && !quote.data.ok && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
                    <p className="font-bold text-destructive">
                      Seu endereço fica a {quote.data.distanceKm.toFixed(1).replace(".", ",")} km — fora do nosso raio de {quote.data.maxKm} km.
                    </p>
                    {settings.allow_pickup && (
                      <Button variant="soft" size="sm" className="mt-2" onClick={() => setFulfillment("pickup")}>
                        <Store /> Retirar na loja
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {balance > 0 && (
            <Section title="Cashback">
              <label className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-3.5">
                <Wallet className="size-5 text-accent" />
                <span className="flex-1 text-sm">
                  Usar meu saldo de <b className="text-accent">{money(balance)}</b>
                  {useCb && <span className="block text-xs text-muted-foreground">Desconto de {money(cashbackUsed)} nos produtos</span>}
                </span>
                <Switch checked={useCb} onCheckedChange={setUseCb} />
              </label>
            </Section>
          )}

          <Section title="Pagamento">
            <div className="grid gap-2 sm:grid-cols-3">
              {settings.accept_pix && <Option active={payment === "pix"} onClick={() => setPayment("pix")} icon={<QrCode className="size-5" />} title="Pix online" subtitle="Aprovação na hora" />}
              {settings.accept_card && <Option active={payment === "card"} onClick={() => setPayment("card")} icon={<CreditCard className="size-5" />} title="Maquininha" subtitle="Na entrega" />}
              {settings.accept_cash && <Option active={payment === "cash"} onClick={() => setPayment("cash")} icon={<Banknote className="size-5" />} title="Dinheiro" subtitle="Na entrega" />}
            </div>
            {payment === "card" && (
              <div className="mt-3 flex gap-2">
                {(["debit", "credit"] as const).map((t) => (
                  <Button key={t} variant={cardType === t ? "default" : "soft"} className="flex-1 rounded-full" onClick={() => setCardType(t)}>
                    {t === "debit" ? "Débito" : "Crédito"}
                  </Button>
                ))}
              </div>
            )}
            {payment === "cash" && (
              <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-3.5">
                <p className="text-sm font-bold">Precisa de troco?</p>
                <div className="flex gap-2">
                  <Button variant={!needsChange ? "default" : "soft"} className="flex-1 rounded-full" onClick={() => setNeedsChange(false)}>
                    Não, valor certo
                  </Button>
                  <Button variant={needsChange ? "default" : "soft"} className="flex-1 rounded-full" onClick={() => setNeedsChange(true)}>
                    Sim
                  </Button>
                </div>
                {needsChange && (
                  <div>
                    <Input inputMode="decimal" placeholder="Troco para quanto? Ex: 100,00" value={changeFor} onChange={(e) => setChangeFor(e.target.value)} className="h-12 text-lg font-bold" />
                    {changeForCents > 0 && change !== null && (
                      <p className="mt-2 text-sm">
                        O motoboy vai levar <b className="text-primary">{money(change)}</b> de troco.
                      </p>
                    )}
                    {changeForCents > 0 && change === null && <p className="mt-2 text-sm text-destructive">O valor precisa ser maior que o total ({money(total)}).</p>}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Observações">
            <Textarea placeholder="Ex: interfone quebrado, trazer bem gelada…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
          </Section>

          <div className="mt-6 space-y-1.5 rounded-2xl border border-border bg-card p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entrega</span>
              <span>{fulfillment === "pickup" ? "Retirada" : quote.data?.ok ? money(fee) : "—"}</span>
            </div>
            {cashbackUsed > 0 && (
              <div className="flex justify-between text-accent">
                <span>Cashback</span>
                <span>- {money(cashbackUsed)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-display text-xl font-extrabold">
              <span>Total</span>
              <span className="text-primary">{money(total)}</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">Você ganha 2% de cashback sobre os produtos quando o pedido for entregue.</p>
          </div>

          <Button variant="hero" size="xl" className="mt-5 w-full" disabled={!canSubmit} onClick={() => void onSubmit()}>
            {busy ? <Loader2 className="animate-spin" /> : `Fazer pedido · ${money(total)}`}
          </Button>
        </>
      )}
    </PageShell>
  );
}
