import { describe, expect, it } from "vitest";
import { isStrongAdminPassword, strongAdminPasswordSchema } from "./admin-password";

describe("senha forte do painel administrativo", () => {
  it("aceita uma senha forte de 8 caracteres", () => {
    expect(isStrongAdminPassword("Aa1@aaaa")).toBe(true);
    expect(strongAdminPasswordSchema.safeParse("Aa1@aaaa").success).toBe(true);
  });

  it.each([
    ["Aa1@aaa", "menos de 8 caracteres"],
    ["aa1@aaaa", "sem maiúscula"],
    ["AA1@AAAA", "sem minúscula"],
    ["AaA@aaaa", "sem número"],
    ["Aa1aaaaa", "sem caractere especial"],
  ])("recusa %s: %s", (password) => {
    expect(isStrongAdminPassword(password)).toBe(false);
    expect(strongAdminPasswordSchema.safeParse(password).success).toBe(false);
  });
});
