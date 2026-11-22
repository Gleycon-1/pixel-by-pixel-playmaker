import { STORE_CONFIG } from "@/store.config";
import type { PublicSettings } from "./catalog.functions";

/** Junta a área white-label com o que o lojista salvou no painel (painel tem prioridade). */
export function storeInfo(s?: Partial<PublicSettings> | null) {
  const c = STORE_CONFIG.contact;
  return {
    name: s?.store_name || STORE_CONFIG.storeName,
    tagline: s?.tagline || STORE_CONFIG.tagline,
    logoUrl: s?.logo_url || STORE_CONFIG.logoUrl,
    bannerUrl: s?.banner_url || STORE_CONFIG.headerBannerUrl,
    whatsappNumber: s?.whatsapp_number || c.whatsappNumber,
    whatsappDisplay: s?.whatsapp_display || c.whatsappDisplay,
    instagramUrl: s?.instagram_url || c.instagramUrl,
    instagramUser: s?.instagram_user || c.instagramUser,
    addressText: s?.address_text || c.addressText,
    googleMapsUrl: s?.google_maps_url || c.googleMapsUrl,
  };
}

export function waLink(number: string, text: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
