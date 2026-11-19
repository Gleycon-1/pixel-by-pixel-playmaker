import { maskPhoneTail } from "./rules";
import { money, PAYMENT_LABEL, phoneDisplay } from "./format";
import { formatAddress, mapsLinkFor, type OrderDTO } from "./order-dto";
import { residenceTypeLabel } from "./address";

export function paymentTag(o: OrderDTO): { label: string; tone: "success" | "info" | "warning" | "muted" } {
  if (o.status === "awaiting_payment") return { label: "AGUARDANDO PIX", tone: "muted" };
  if (o.payment_method === "pix") return { label: "PIX PAGO", tone: "success" };
  if (o.payment_method === "card") return { label: `MAQUININHA · ${o.card_type === "credit" ? "CRÉDITO" : "DÉBITO"}`, tone: "info" };
  return {
    label: o.change_due_cents > 0 ? `DINHEIRO — LEVAR TROCO DE ${money(o.change_due_cents)}` : "DINHEIRO — SEM TROCO",
    tone: "warning",
  };
}

function amountToCollect(o: OrderDTO) {
  if (o.payment_method === "pix") return "✅ Pix já pago — NÃO cobrar nada";
  if (o.payment_method === "card") return `💳 Cobrar ${money(o.total_cents)} na maquininha (${o.card_type === "credit" ? "crédito" : "débito"})`;
  if (o.change_due_cents > 0)
    return `💵 Cobrar ${money(o.total_cents)} em dinheiro — cliente paga com ${money(o.cash_change_for_cents ?? 0)}, LEVAR TROCO DE ${money(o.change_due_cents)}`;
  return `💵 Cobrar ${money(o.total_cents)} em dinheiro (sem troco)`;
}

export function courierMessage(o: OrderDTO, storeName: string, panelLink?: string) {
  const a = o.address;
  return [
    `🛵 *ENTREGA #${o.code}* — ${storeName}`,
    ``,
    panelLink ? `📲 *Abra suas entregas:* ${panelLink}` : null,
    panelLink ? `` : null,
    `👤 *Cliente:* ${o.customer_name}`,
    panelLink ? `📞 ${maskPhoneTail(o.customer_phone)} (ligue pelo painel)` : `📞 ${phoneDisplay(o.customer_phone)}`,
    `🏠 *Endereço:* ${formatAddress(a)}`,
    a ? `🏡 *Tipo de imóvel:* ${residenceTypeLabel(a.residence_type)}` : null,
    a?.reference ? `📌 Ref: ${a.reference}` : null,
    o.distance_km != null ? `📏 Distância: ${String(o.distance_km).replace(".", ",")} km` : null,
    ``,
    amountToCollect(o),
    ``,
    `📦 *Itens:*`,
    ...o.order_items.map((i) => `• ${i.quantity}x ${i.name}`),
    o.notes ? `\n📝 Obs: ${o.notes}` : null,
    ``,
    `🗺️ *Rota no Google Maps:*`,
    mapsLinkFor(a),
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function receiptMessage(o: OrderDTO, storeName: string) {
  return [
    `🧾 *${storeName}* — Recibo do pedido #${o.code}`,
    `${new Date(o.created_at).toLocaleString("pt-BR")}`,
    ``,
    ...o.order_items.map((i) => `${i.quantity}x ${i.name} — ${money(i.unit_price_cents * i.quantity)}`),
    ``,
    `Subtotal: ${money(o.subtotal_cents)}`,
    o.fulfillment === "delivery" ? `Entrega: ${money(o.delivery_fee_cents)}` : `Retirada na loja`,
    o.cashback_used_cents > 0 ? `Cashback: -${money(o.cashback_used_cents)}` : null,
    `*Total: ${money(o.total_cents)}*`,
    `Pagamento: ${PAYMENT_LABEL[o.payment_method]}${o.change_due_cents > 0 ? ` (troco ${money(o.change_due_cents)})` : ""}`,
    ``,
    `Obrigado pela preferência! 🍻`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
