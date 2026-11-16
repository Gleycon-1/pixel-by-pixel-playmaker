export const ORDER_SELECT =
  "id, code, customer_id, customer_name, customer_phone, status, fulfillment, address, distance_km, billed_km, subtotal_cents, delivery_fee_cents, cashback_used_cents, cashback_earned_cents, total_cents, payment_method, card_type, cash_change_for_cents, change_due_cents, notes, pix_qr_code, paid_at, courier_id, dispatched_at, delivered_at, cancelled_at, created_at, order_items(id, product_id, name, unit_price_cents, quantity)";

export type OrderAddress = {
  cep: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  reference?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type OrderItemDTO = {
  id: string;
  product_id: string | null;
  name: string;
  unit_price_cents: number;
  quantity: number;
};

export type OrderDTO = {
  id: string;
  code: number;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: string;
  fulfillment: "delivery" | "pickup";
  address: OrderAddress | null;
  distance_km: number | null;
  billed_km: number | null;
  subtotal_cents: number;
  delivery_fee_cents: number;
  cashback_used_cents: number;
  cashback_earned_cents: number;
  total_cents: number;
  payment_method: "pix" | "card" | "cash";
  card_type: "debit" | "credit" | null;
  cash_change_for_cents: number | null;
  change_due_cents: number;
  notes: string | null;
  pix_qr_code: string | null;
  paid_at: string | null;
  courier_id: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  order_items: OrderItemDTO[];
};

export function formatAddress(a: OrderAddress | null) {
  if (!a) return "";
  return `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""} - ${a.neighborhood ? a.neighborhood + ", " : ""}${a.city}/${a.state} - CEP ${a.cep}`;
}

export function mapsLinkFor(a: OrderAddress | null) {
  if (!a) return "";
  if (a.lat != null && a.lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(a))}`;
}
