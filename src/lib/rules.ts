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

/** 2% do subtotal dos produtos (sem frete), arredondado para baixo em centavos. */
export function calcCashback(subtotalCents: number) {
  return Math.floor(subtotalCents * CASHBACK_RATE);
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
