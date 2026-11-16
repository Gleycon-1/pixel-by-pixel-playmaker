import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCatalog, adminGetSettings, adminPdvSale } from "@/lib/admin.functions";
import { centsToInput, maskPhoneInput, money, parseMoneyInput } from "@/lib/format";
import { calcCashback, calcChange } from "@/lib/rules";
import { cn } from "@/lib/utils";
import { useAdmin } from "./use-admin";

export function PdvPanel() {
  const { token, run } = useAdmin();
  const qc = useQueryClient();
  const fetchCatalog = useServerFn(adminCatalog);
  const fetchSettings = useServerFn(adminGetSettings);
  const sale = useServerFn(adminPdvSale);
  const cat = useQuery({ queryKey: ["admin-catalog"], queryFn: () => fetchCatalog({ data: { token } }) });
  const settings = useQuery({ queryKey: ["admin-settings"], queryFn: () => fetchSettings({ data: { token } }) });

  const [q, setQ] = useState("");
  const [catId, setCatId] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [source, setSource] = useState<"counter" | "whatsapp">("counter");
  const [payment, setPayment] = useState<"pix" | "card" | "cash">("cash");
  const [cardType, setCardType] = useState<"debit" | "credit">("debit");
  const [cashGiven, setCashGiven] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [fee, setFee] = useState("");
  const [busy, setBusy] = useState(false);

  const products = cat.data?.products ?? [];
  const filtered = products.filter(
    (p) => p.available && (!catId || p.category_id === catId) && p.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const lines = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ p: products.find((x) => x.id === id)!, qty })).filter((l) => l.p),
    [cart, products],
  );
  const subtotal = lines.reduce((a, l) => a + l.p.price_cents * l.qty, 0);
  const feeCents = source === "whatsapp" ? parseMoneyInput(fee) : 0;
  const total = subtotal + feeCents;
  const givenCents = parseMoneyInput(cashGiven);
  const change = payment === "cash" && givenCents > 0 ? calcChange(total, givenCents) : 0;
  const cashback = phone.replace(/\D/g, "").length >= 10 ? calcCashback(subtotal, settings.data?.cashback_percent ?? 2) : 0;

  const add = (id: string, d: number) =>
    setCart((c) => {
      const p = products.find((x) => x.id === id);
      const n = Math.max(0, (c[id] ?? 0) + d);
      if (p?.stock != null && n > p.stock) {
        toast.error(`Só há ${p.stock} un. em estoque.`);
        return c;
      }
      const next = { ...c };
      if (n === 0) delete next[id];
      else next[id] = n;
      return next;
    });

  const finish = async () => {
    setBusy(true);
    const r = await run(() =>
      sale({
        data: {
          token,
          source,
          items: lines.map((l) => ({ productId: l.p.id, qty: l.qty })),
          paymentMethod: payment,
          cardType: payment === "card" ? cardType : null,
          cashGivenCents: payment === "cash" && givenCents > 0 ? givenCents : null,
          customerName: name.trim() || null,
          customerPhone: phone.replace(/\D/g, "") || null,
          deliveryFeeCents: feeCents,
          addressLine: source === "whatsapp" ? addressLine.trim() || null : null,
          notes: null,
        },
      }),
    );
    setBusy(false);
    if (!r) return;
    toast.success(
      `Venda #${r.code} registrada — ${money(r.totalCents)}${r.changeDueCents ? ` · troco ${money(r.changeDueCents)}` : ""}${r.cashbackCents ? ` · cashback ${money(r.cashbackCents)}` : ""}`,
      { duration: 8000 },
    );
    if (r.createdPin) toast.info(`Cliente cadastrado. PIN inicial de acesso: ${r.createdPin}`, { duration: 12000 });
    setCart({});
    setCashGiven("");
    setName("");
    setPhone("");
    setAddressLine("");
    setFee("");
    void qc.invalidateQueries({ queryKey: ["admin-catalog"] });
    void qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  return (
    <div className="grid gap-4 pt-2 lg:grid-cols-[1fr_380px]">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar produto…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant={catId === null ? "default" : "outline"} onClick={() => setCatId(null)}>Todos</Button>
          {(cat.data?.categories ?? []).map((c) => (
            <Button key={c.id} size="sm" variant={catId === c.id ? "default" : "outline"} onClick={() => setCatId(c.id)}>{c.name}</Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p.id, 1)}
              className="relative rounded-xl border border-border bg-card p-2 text-left transition hover:border-primary"
            >
              {p.image_url && <img src={p.image_url} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />}
              <p className="mt-1 line-clamp-2 text-sm font-bold">{p.name}</p>
              <p className="text-sm font-extrabold text-primary">{money(p.price_cents)}</p>
              {p.stock != null && <p className="text-[11px] text-muted-foreground">Estoque: {p.stock}</p>}
              {cart[p.id] && <span className="absolute right-2 top-2 rounded-full bg-primary px-2 text-xs font-extrabold text-primary-foreground">{cart[p.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      <aside className="h-fit space-y-3 rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-20">
        <div className="grid grid-cols-2 gap-1">
          {(["counter", "whatsapp"] as const).map((s) => (
            <Button key={s} variant={source === s ? "default" : "outline"} size="sm" onClick={() => setSource(s)}>
              {s === "counter" ? "Balcão" : "Pedido WhatsApp"}
            </Button>
          ))}
        </div>
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Toque nos produtos para adicionar.</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {lines.map((l) => (
              <li key={l.p.id} className="flex items-center gap-1 text-sm">
                <span className="min-w-0 flex-1 truncate">{l.p.name}</span>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => add(l.p.id, -1)} aria-label="Menos"><Minus /></Button>
                <span className="w-6 text-center font-bold">{l.qty}</span>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => add(l.p.id, 1)} aria-label="Mais"><Plus /></Button>
                <span className="w-20 text-right">{money(l.p.price_cents * l.qty)}</span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="ghost" size="sm" className="text-destructive" disabled={!lines.length} onClick={() => setCart({})}><Trash2 /> Limpar</Button>

        {source === "whatsapp" && (
          <div className="space-y-2">
            <Input placeholder="Endereço (vazio = retirada)" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
            <Input placeholder="Taxa de entrega (R$)" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
        )}

        <div className="space-y-2">
          <Label>Cliente (opcional — credita cashback)</Label>
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="(11) 99999-9999" inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhoneInput(e.target.value))} />
        </div>

        <div className="grid grid-cols-3 gap-1">
          {(["cash", "card", "pix"] as const).map((m) => (
            <Button key={m} size="sm" variant={payment === m ? "default" : "outline"} onClick={() => setPayment(m)}>
              {m === "cash" ? "Dinheiro" : m === "card" ? "Cartão" : "Pix"}
            </Button>
          ))}
        </div>
        {payment === "card" && (
          <div className="grid grid-cols-2 gap-1">
            {(["debit", "credit"] as const).map((t) => (
              <Button key={t} size="sm" variant={cardType === t ? "secondary" : "outline"} onClick={() => setCardType(t)}>
                {t === "debit" ? "Débito" : "Crédito"}
              </Button>
            ))}
          </div>
        )}
        {payment === "cash" && (
          <div className="space-y-1">
            <Input placeholder="Valor recebido (R$)" inputMode="decimal" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} />
            <div className="flex flex-wrap gap-1">
              {[2000, 5000, 10000, 20000].map((v) => (
                <Button key={v} size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCashGiven(centsToInput(v))}>{money(v)}</Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {feeCents > 0 && <div className="flex justify-between"><span>Entrega</span><span>{money(feeCents)}</span></div>}
          <div className="flex justify-between font-display text-xl font-extrabold"><span>Total</span><span>{money(total)}</span></div>
          {payment === "cash" && givenCents > 0 && (
            <div className={cn("flex justify-between font-bold", change === null ? "text-destructive" : "text-success")}>
              <span>Troco</span><span>{change === null ? "valor insuficiente" : money(change)}</span>
            </div>
          )}
          {cashback > 0 && source === "counter" && <p className="text-xs text-accent">Cliente ganha {money(cashback)} de cashback</p>}
        </div>
        <Button className="w-full" size="lg" disabled={busy || !lines.length || change === null} onClick={finish}>
          {source === "counter" ? "Finalizar venda" : "Lançar pedido no monitor"}
        </Button>
      </aside>
    </div>
  );
}
