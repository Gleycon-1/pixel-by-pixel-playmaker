import { describe, expect, it } from "vitest";
import { normalizeMobilePhone } from "./rules";

describe("telefone no primeiro cadastro", () => {
  it("aceita celular brasileiro com DDD", () => {
    expect(normalizeMobilePhone("(11) 98765-4321")).toBe("5511987654321");
  });

  it.each(["00000000000", "11111111111", "11999999999", "1187654321", "00876543210"])("bloqueia %s", (phone) => {
    expect(normalizeMobilePhone(phone)).toBeNull();
  });
});
