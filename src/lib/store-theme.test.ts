import { describe, expect, it } from "vitest";
import { buttonForeground, DEFAULT_BUTTON_COLOR, dynamicStoreThemeCss, normalizeButtonColor } from "./store-theme";

describe("aparência da loja", () => {
  it("aceita qualquer HSL dentro dos limites e rejeita valores inseguros", () => {
    expect(normalizeButtonColor("215 100% 100%")).toBe("215 100% 100%");
    expect(normalizeButtonColor("0 0% 0%")).toBe("0 0% 0%");
    expect(normalizeButtonColor("999 0% 0%")).toBe(DEFAULT_BUTTON_COLOR);
    expect(normalizeButtonColor("0 0% 0%;color:red")).toBe(DEFAULT_BUTTON_COLOR);
  });

  it("usa texto escuro em botão claro e texto claro em botão escuro", () => {
    expect(buttonForeground("0 0% 100%")).toBe("hsl(222 47% 11%)");
    expect(buttonForeground("0 0% 0%")).toBe("hsl(0 0% 100%)");
    expect(dynamicStoreThemeCss({ button_color: "215 20% 100%", store_theme: "light" })).toContain("--primary-accessible:hsl(222 47% 11%)");
  });

  it("usa cinza-gelo no tema claro, nunca branco puro como fundo", () => {
    expect(dynamicStoreThemeCss({ button_color: "0 0% 50%", store_theme: "light" })).toContain("--store-bg:#F3F4F6");
    expect(dynamicStoreThemeCss({ button_color: "0 0% 50%", store_theme: "light" })).not.toContain("--store-bg:#FFFFFF");
  });
});
