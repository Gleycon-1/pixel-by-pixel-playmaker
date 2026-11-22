import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { publicDb } from "./public-db.server";
import { isStoreOpenNow } from "./rules";

export type PublicSettings = {
  store_name: string | null;
  tagline: string | null;
  whatsapp_number: string | null;
  whatsapp_display: string | null;
  instagram_user: string | null;
  instagram_url: string | null;
  address_text: string | null;
  google_maps_url: string | null;
  raio_maximo_km: number;
  limite_km_taxa_fixa: number;
  valor_taxa_fixa_cents: number;
  valor_por_km_adicional_cents: number;
  accept_pix: boolean;
  accept_card: boolean;
  accept_cash: boolean;
  allow_pickup: boolean;
  pix_test_mode: boolean;
  featured_enabled: boolean;
  store_open: boolean;
  store_mode: string;
  open_time: string;
  close_time: string;
  eta_minutes: number;
  cashback_percent: number;
  free_delivery_min_cents: number;
  logo_url: string | null;
  banner_url: string | null;
  banner_enabled: boolean;
  button_color: string;
  store_theme: "dark" | "light";
};

export type Category = { id: string; name: string; position: number; active: boolean };
export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  featured: boolean;
  available: boolean;
  position: number;
  stock: number | null;
};

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const db = publicDb();
  // Settings are read with the server-only client and filtered to public fields below.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [s, c, p] = await Promise.all([
    supabaseAdmin.from("store_settings").select("*").eq("id", 1).single(),
    db.from("categories").select("id,name,position,active").eq("active", true).order("position"),
    // Products are read server-side with a fixed column list so sold-out items still show as "Esgotado".
    supabaseAdmin
      .from("products")
      .select("id,category_id,name,description,price_cents,image_url,featured,available,position,stock")
      .order("position"),
  ]);
  if (s.error || c.error || p.error) {
    console.error(s.error, c.error, p.error);
    throw new Error("Não foi possível carregar o cardápio.");
  }
  const st = s.data;
  const settings: PublicSettings = {
    store_name: st.store_name,
    tagline: st.tagline,
    whatsapp_number: st.whatsapp_number,
    whatsapp_display: st.whatsapp_display,
    instagram_user: st.instagram_user,
    instagram_url: st.instagram_url,
    address_text: st.address_text,
    google_maps_url: st.google_maps_url,
    raio_maximo_km: Number(st.raio_maximo_km),
    limite_km_taxa_fixa: Number(st.limite_km_taxa_fixa),
    valor_taxa_fixa_cents: st.valor_taxa_fixa_cents,
    valor_por_km_adicional_cents: st.valor_por_km_adicional_cents,
    accept_pix: st.accept_pix,
    accept_card: st.accept_card,
    accept_cash: st.accept_cash,
    allow_pickup: st.allow_pickup,
    pix_test_mode: st.pix_test_mode,
    featured_enabled: st.featured_enabled,
    store_open: isStoreOpenNow(st.store_mode, st.open_time, st.close_time),
    store_mode: st.store_mode,
    open_time: st.open_time,
    close_time: st.close_time,
    eta_minutes: st.eta_minutes,
    cashback_percent: Number(st.cashback_percent),
    free_delivery_min_cents: st.free_delivery_min_cents,
    logo_url: st.logo_url,
    banner_url: st.banner_url,
    banner_enabled: st.banner_enabled,
    button_color: st.button_color,
    store_theme: st.store_theme,
  };
  return { settings, categories: c.data as Category[], products: p.data as Product[] };
});

export const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
  staleTime: 30_000,
});
