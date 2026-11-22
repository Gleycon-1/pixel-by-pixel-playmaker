import { describe, expect, it } from "vitest";
import { deliveryPin, maskPhoneTail } from "./rules";

describe("PIN de entrega", () => {
  it("usa os últimos 4 dígitos do celular", () => {
    expect(deliveryPin("(11) 98765-4321")).toBe("4321");
    expect(deliveryPin("5511987654321")).toBe("4321");
  });
  it("oculta os 4 últimos dígitos para o motoboy", () => {
    expect(maskPhoneTail("11987654321")).toBe("(11) 98765-****");
    expect(maskPhoneTail("5511987654321")).toBe("(11) 98765-****");
  });
});

import { summarizeSales, summarizeSalesByCategory } from "./rules";
describe("faturamento unificado", () => {
  it("soma app e PDV e separa crédito/débito", () => {
    const r = summarizeSales([
      { source: "online", payment_method: "pix", card_type: null, total_cents: 1000 },
      { source: "counter", payment_method: "card", card_type: "credit", total_cents: 2000 },
      { source: "counter", payment_method: "card", card_type: "debit", total_cents: 500 },
      { source: "whatsapp", payment_method: "cash", card_type: null, total_cents: 300 },
    ]);
    expect(r.totalCents).toBe(3800);
    expect(r.byChannel.app.cents).toBe(1000);
    expect(r.byChannel.pdv.cents).toBe(2800);
    expect(r.byMethod.credit.cents).toBe(2000);
    expect(r.byMethod.debit.cents).toBe(500);
  });

  it("soma quantidade e valor dos produtos por categoria, sem incluir frete", () => {
    const result = summarizeSalesByCategory(
      [
        { product_id: "cerveja", quantity: 2, unit_price_cents: 1000 },
        { product_id: "cerveja", quantity: 1, unit_price_cents: 500 },
        { product_id: "whisky", quantity: 2, unit_price_cents: 2000 },
        { product_id: null, quantity: 1, unit_price_cents: 300 },
      ],
      { cerveja: "bebidas", whisky: "destilados" },
      { bebidas: "Bebidas", destilados: "Destilados" },
    );
    expect(result).toEqual([
      { id: "destilados", name: "Destilados", cents: 4000, quantity: 2 },
      { id: "bebidas", name: "Bebidas", cents: 2500, quantity: 3 },
      { id: "sem-categoria", name: "Sem categoria", cents: 300, quantity: 1 },
    ]);
  });
});
