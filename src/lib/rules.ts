/** Regras de negócio puras (frete, cashback, troco, telefone). Usadas no cliente e no servidor. */

export type FreightSettings = {
  raio_maximo_km: number;
  limite_km_taxa_fixa: number;
  valor_taxa_fixa_cents: number;
  valor_por_km_adicional_cents: number;
};

export type FreightResult =
  | { ok: true; distanceKm: number; billedKm: number; extraKm: number; feeCents: number }
  | { ok: false; reason: "out_of_range"; distanceKm: number; billedKm: number; maxKm: number };

export const CASHBACK_RATE = 0.02;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Arredonda a distância para cima ao próximo km inteiro (5,3 km => 6 km). */
export function billedKilometers(distanceKm: number) {
  const clean = Math.round(distanceKm * 1000) / 1000; // evita 5.0000001 => 6
  return Math.max(0, Math.ceil(clean));
}

export function calcDeliveryFee(distanceKm: number, s: FreightSettings): FreightResult {
  const billedKm = billedKilometers(distanceKm);
  const maxKm = Number(s.raio_maximo_km);
  if (distanceKm > maxKm) {
    return { ok: false, reason: "out_of_range", distanceKm, billedKm, maxKm };
  }
  const limit = Number(s.limite_km_taxa_fixa);
  const extraKm = billedKm <= limit ? 0 : Math.ceil(billedKm - limit);
  const feeCents = s.valor_taxa_fixa_cents + extraKm * s.valor_por_km_adicional_cents;
  return { ok: true, distanceKm, billedKm, extraKm, feeCents };
}

/** % do subtotal dos produtos (sem frete), arredondado para baixo em centavos. Padrão 2%. */
export function calcCashback(subtotalCents: number, percent: number = CASHBACK_RATE * 100) {
  return Math.floor((subtotalCents * Math.max(0, percent)) / 100);
}

/** Frete grátis quando o subtotal atinge o mínimo configurado (0 = desligado). */
export function applyFreeDelivery(feeCents: number, subtotalCents: number, minCents: number) {
  return minCents > 0 && subtotalCents >= minCents ? 0 : feeCents;
}

/** Loja aberta? "auto" usa o horário (HH:MM, aceita virar a meia-noite) no fuso de São Paulo. */
export function isStoreOpenNow(
  mode: string,
  openTime: string,
  closeTime: string,
  now: Date = new Date(),
): boolean {
  if (mode === "open") return true;
  if (mode === "closed") return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const cur = h * 60 + m;
  const toMin = (t: string) => {
    const [a, b] = t.split(":").map(Number);
    return (a ?? 0) * 60 + (b ?? 0);
  };
  const o = toMin(openTime);
  const c = toMin(closeTime);
  if (o === c) return true;
  return o < c ? cur >= o && cur < c : cur >= o || cur < c;
}

/** Quanto do saldo pode ser usado: nunca mais que o subtotal dos produtos. */
export function usableCashback(balanceCents: number, subtotalCents: number) {
  return Math.max(0, Math.min(balanceCents, subtotalCents));
}

/** Troco que o motoboy deve levar. null = valor informado é menor que o total. */
export function calcChange(totalCents: number, payWithCents: number): number | null {
  if (payWithCents < totalCents) return null;
  return payWithCents - totalCents;
}

/** Normaliza para apenas dígitos com DDI 55. Retorna null se inválido. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!/^55\d{10,11}$/.test(d)) return null;
  return d;
}

/** PIN de entrega: últimos 4 dígitos do celular do cliente. */
export function deliveryPin(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 4 ? d.slice(-4) : null;
}

/** Telefone com os 4 últimos dígitos ocultos, ex.: (11) 98765-****. */
export function maskPhoneTail(phone: string | null | undefined) {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 8) return "****";
  const ddd = d.length >= 10 ? `(${d.slice(0, 2)}) ` : "";
  const body = d.length >= 10 ? d.slice(2) : d;
  return `${ddd}${body.slice(0, body.length - 4)}-****`;
}

export type SalesRow = { source: string; payment_method: string; card_type: string | null; total_cents: number };
export type SalesItemRow = { product_id: string | null; quantity: number; unit_price_cents: number };
export const SALES_METHODS = ["pix", "credit", "debit", "cash"] as const;
/** Une vendas do app (online) e do PDV (balcão/WhatsApp) e separa por meio de pagamento. */
export function summarizeSales(rows: SalesRow[]) {
  const empty = () => ({ count: 0, cents: 0 });
  const byMethod = { pix: empty(), credit: empty(), debit: empty(), cash: empty() };
  const byChannel = { app: empty(), pdv: empty() };
  let total = 0;
  for (const r of rows) {
    const m = r.payment_method === "card" ? (r.card_type === "credit" ? "credit" : "debit") : (r.payment_method as "pix" | "cash");
    const ch = r.source === "online" ? "app" : "pdv";
    byMethod[m].count++;
    byMethod[m].cents += r.total_cents;
    byChannel[ch].count++;
    byChannel[ch].cents += r.total_cents;
    total += r.total_cents;
  }
  return { totalCents: total, count: rows.length, byMethod, byChannel };
}

/** Soma o valor histórico dos itens vendidos; frete não entra no faturamento das categorias. */
export function summarizeSalesByCategory(
  rows: SalesItemRow[],
  productCategories: Record<string, string | null>,
  categoryNames: Record<string, string>,
) {
  const totals = new Map<string, { id: string; name: string; cents: number; quantity: number }>();
  for (const row of rows) {
    const categoryId = row.product_id ? productCategories[row.product_id] : null;
    const id = categoryId && categoryNames[categoryId] ? categoryId : "sem-categoria";
    const current = totals.get(id) ?? { id, name: id === "sem-categoria" ? "Sem categoria" : categoryNames[id]!, cents: 0, quantity: 0 };
    current.cents += row.unit_price_cents * row.quantity;
    current.quantity += row.quantity;
    totals.set(id, current);
  }
  return [...totals.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "pt-BR"));
}
