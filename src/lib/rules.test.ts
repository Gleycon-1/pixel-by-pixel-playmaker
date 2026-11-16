import { describe, expect, it } from "vitest";
import {
  billedKilometers,
  calcCashback,
  applyFreeDelivery,
  isStoreOpenNow,
  calcChange,
  calcDeliveryFee,
  normalizePhone,
  usableCashback,
} from "./rules";

const settings = {
  raio_maximo_km: 20,
  limite_km_taxa_fixa: 5,
  valor_taxa_fixa_cents: 700,
  valor_por_km_adicional_cents: 150,
};

describe("frete por km", () => {
  it("arredonda distância fracionada para cima (5,3 km => 6 km)", () => {
    expect(billedKilometers(5.3)).toBe(6);
  });

  it("cobra só a taxa fixa até o limite (R$ 7,00 até 5 km)", () => {
    const r = calcDeliveryFee(4.2, settings);
    expect(r.ok && r.feeCents).toBe(700);
  });

  it("5,3 km cobra taxa fixa + 1 km excedente (R$ 8,50)", () => {
    const r = calcDeliveryFee(5.3, settings);
    expect(r.ok && r.extraKm).toBe(1);
    expect(r.ok && r.feeCents).toBe(850);
  });

  it("bloqueia entrega acima do raio máximo (20 km)", () => {
    const r = calcDeliveryFee(20.4, settings);
    expect(r.ok).toBe(false);
  });

  it("adicional R$ 0,00 cobra R$ 7,00 fixos em qualquer distância até 20 km", () => {
    const r = calcDeliveryFee(18.7, { ...settings, valor_por_km_adicional_cents: 0 });
    expect(r.ok && r.feeCents).toBe(700);
  });
});

describe("cashback", () => {
  it("credita 2% do subtotal dos produtos", () => {
    expect(calcCashback(10000)).toBe(200);
  });

  it("não deixa usar mais saldo que o subtotal", () => {
    expect(usableCashback(5000, 3000)).toBe(3000);
  });
});

describe("troco", () => {
  it("calcula o troco que o motoboy leva", () => {
    expect(calcChange(4350, 5000)).toBe(650);
  });

  it("recusa valor menor que o total", () => {
    expect(calcChange(4350, 4000)).toBeNull();
  });
});

describe("telefone", () => {
  it("adiciona DDI 55 ao número com DDD", () => {
    expect(normalizePhone("(11) 97859-0216")).toBe("5511978590216");
  });
});

describe("regras do painel", () => {
  it("cashback com porcentagem configurável (5% de R$100 = R$5)", () => {
    expect(calcCashback(10000, 5)).toBe(500);
  });
  it("frete grátis a partir do mínimo", () => {
    expect(applyFreeDelivery(800, 10000, 10000)).toBe(0);
    expect(applyFreeDelivery(800, 9999, 10000)).toBe(800);
    expect(applyFreeDelivery(800, 50000, 0)).toBe(800);
  });
  it("modo automático vira a meia-noite (10:00–02:00)", () => {
    // 01:00 em SP = 04:00 UTC
    expect(isStoreOpenNow("auto", "10:00", "02:00", new Date("2026-01-10T04:00:00Z"))).toBe(true);
    // 05:00 em SP = 08:00 UTC
    expect(isStoreOpenNow("auto", "10:00", "02:00", new Date("2026-01-10T08:00:00Z"))).toBe(false);
    expect(isStoreOpenNow("closed", "10:00", "02:00")).toBe(false);
    expect(isStoreOpenNow("open", "10:00", "02:00")).toBe(true);
  });
});
