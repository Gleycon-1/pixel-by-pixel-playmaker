import { money, PAYMENT_LABEL, phoneDisplay } from "@/lib/format";
import { formatAddress, type OrderDTO } from "@/lib/order-dto";
import { residenceTypeLabel } from "@/lib/address";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** Abre uma janela com o cupom térmico (58mm ou 80mm) e chama a impressão. */
export function printReceipt(o: OrderDTO, storeName: string, width: 58 | 80) {
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return;
  const rows = o.order_items
    .map((i) => `<tr><td>${i.quantity}x ${esc(i.name)}</td><td class="r">${money(i.unit_price_cents * i.quantity)}</td></tr>`)
    .join("");
  const line = (l: string, r: string) => `<tr><td>${l}</td><td class="r">${r}</td></tr>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pedido #${o.code}</title>
<style>
@page { size: ${width}mm auto; margin: 2mm; }
body { font-family: "Courier New", monospace; font-size: ${width === 58 ? 11 : 13}px; width: ${width - 4}mm; margin: 0 auto; color: #000; }
h1 { font-size: 1.3em; text-align: center; margin: 4px 0; }
.c { text-align: center; } .r { text-align: right; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; } td { vertical-align: top; padding: 1px 0; }
hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; } .b { font-weight: bold; font-size: 1.15em; }
</style></head><body>
<h1>${esc(storeName)}</h1>
<div class="c">PEDIDO #${o.code}<br>${new Date(o.created_at).toLocaleString("pt-BR")}</div><hr>
<div>${esc(o.customer_name)}${o.customer_phone ? "<br>" + phoneDisplay(o.customer_phone) : ""}</div>
${o.fulfillment === "delivery" && o.address ? `<div><span class="b">Tipo: ${esc(residenceTypeLabel(o.address.residence_type))}</span><br>${esc(formatAddress(o.address))}${o.address.reference ? "<br>Ref: " + esc(o.address.reference) : ""}</div>` : `<div>RETIRADA / BALCÃO</div>`}
<hr><table>${rows}</table><hr><table>
${line("Subtotal", money(o.subtotal_cents))}
${o.delivery_fee_cents ? line("Entrega", money(o.delivery_fee_cents)) : ""}
${o.cashback_used_cents ? line("Cashback", "-" + money(o.cashback_used_cents)) : ""}
<tr class="b"><td>TOTAL</td><td class="r">${money(o.total_cents)}</td></tr></table><hr>
<div>Pagamento: ${PAYMENT_LABEL[o.payment_method]}${o.card_type ? " (" + (o.card_type === "credit" ? "crédito" : "débito") + ")" : ""}</div>
${o.change_due_cents ? `<div class="b">TROCO: ${money(o.change_due_cents)} (p/ ${money(o.cash_change_for_cents ?? 0)})</div>` : ""}
${o.notes ? `<hr><div>Obs: ${esc(o.notes)}</div>` : ""}
<hr><div class="c">Obrigado pela preferência!</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
</body></html>`);
  w.document.close();
}

/** Bipe curto via WebAudio (sem arquivo de áudio). */
let ctx: AudioContext | null = null;
export function unlockAudio() {
  if (!ctx) ctx = new AudioContext();
  void ctx.resume();
}
export function beep() {
  try {
    unlockAudio();
    const c = ctx!;
    [0, 0.25, 0.5].forEach((t) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "square";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, c.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 0.2);
      o.connect(g).connect(c.destination);
      o.start(c.currentTime + t);
      o.stop(c.currentTime + t + 0.2);
    });
  } catch {
    /* navegador sem áudio */
  }
}
