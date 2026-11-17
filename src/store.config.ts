/**
 * ============================================================================
 *  INÍCIO DA ÁREA WHITE-LABEL SUBSTITUÍVEL (ALTERE APENAS AQUI)
 * ============================================================================
 *  Para revender o sistema para outra adega, troque somente os valores abaixo
 *  e as imagens /public/logo.png e /public/banner.jpg.
 *  - STORE_THEME: cores da marca (aplicadas no app inteiro automaticamente).
 *  - STORE_CONFIG: nome, contatos e CEP base do frete.
 *  Os dados de contato também podem ser ajustados depois no painel /admin
 *  (aba Configurações) — o que for salvo lá tem prioridade sobre estes valores.
 * ============================================================================
 */
export const STORE_THEME = {
  "--store-primary": "#f59e0b",
  "--store-accent": "#10b981",
  "--store-bg": "#0f172a",
  "--store-card-bg": "#1e293b",
} as const;

export const STORE_CONFIG = {
  storeName: "Connect Power",
  tagline: "As melhores bebidas geladas entregues na sua porta",
  logoUrl: "/logo.png",
  headerBannerUrl: "/banner.jpg",
  contact: {
    whatsappNumber: "5511978590216", // Apenas números com DDI e DDD
    whatsappDisplay: "(11) 97859-0216",
    instagramUrl: "https://instagram.com/adegapowerhouse",
    instagramUser: "@adegapowerhouse",
    addressText: "Rua Exemplo, 123 - Sapopemba, São Paulo - SP",
    originCep: "03929-040", // CEP base inicial utilizado no cálculo de frete
    googleMapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Rua+Exemplo+123+Sapopemba+Sao+Paulo",
  },
};
/* ============================================================================
 *  FIM DA ÁREA WHITE-LABEL SUBSTITUÍVEL
 * ========================================================================== */

export type StoreConfig = typeof STORE_CONFIG;

export function storeThemeCss() {
  const vars = Object.entries(STORE_THEME)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `:root{${vars}}`;
}
