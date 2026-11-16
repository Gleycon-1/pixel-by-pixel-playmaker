import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcDeliveryFee, haversineKm, type FreightResult } from "./rules";

const UA = "AdegaDeliveryApp/1.0 (white-label delivery; contato via whatsapp)";

export type AddressInput = {
  cep: string;
  street: string;
  number: string;
  neighborhood?: string | null;
  city: string;
  state: string;
};

export async function lookupCep(cep: string) {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) throw new Error("CEP inválido.");
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) throw new Error("Não foi possível consultar o CEP agora.");
  const j = (await res.json()) as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: unknown };
  if (j.erro) throw new Error("CEP não encontrado.");
  return {
    cep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
    street: j.logradouro ?? "",
    neighborhood: j.bairro ?? "",
    city: j.localidade ?? "",
    state: j.uf ?? "",
  };
}

async function nominatim(params: Record<string, string>) {
  const qs = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", ...params });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
    headers: { "User-Agent": UA, "Accept-Language": "pt-BR" },
  });
  if (!res.ok) return null;
  const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = arr?.[0];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon) };
}

async function photon(q: string) {
  const res = await fetch(
    `https://photon.komoot.io/api/?limit=1&lang=default&q=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": UA } },
  );
  if (!res.ok) return null;
  const j = (await res.json()) as { features?: Array<{ geometry: { coordinates: [number, number] } }> };
  const f = j.features?.[0];
  if (!f) return null;
  return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
}

export async function geocode(a: AddressInput): Promise<{ lat: number; lng: number } | null> {
  const key = `${a.street}|${a.number}|${a.city}|${a.state}`.toLowerCase().replace(/\s+/g, " ").trim();
  const { data: cached } = await supabaseAdmin.from("geocode_cache").select("lat,lng").eq("query", key).maybeSingle();
  if (cached) return { lat: cached.lat, lng: cached.lng };

  const attempts: Array<() => Promise<{ lat: number; lng: number } | null>> = [];
  if (a.street) {
    attempts.push(() => nominatim({ street: `${a.number} ${a.street}`, city: a.city, state: a.state, country: "Brasil" }));
    attempts.push(() => nominatim({ street: a.street, city: a.city, state: a.state, country: "Brasil" }));
    attempts.push(() => photon(`${a.street}, ${a.number}, ${a.city}, ${a.state}, Brasil`));
  }
  if (a.neighborhood) attempts.push(() => nominatim({ q: `${a.neighborhood}, ${a.city}, ${a.state}, Brasil` }));
  attempts.push(() => nominatim({ postalcode: a.cep, country: "Brasil" }));

  for (const tryIt of attempts) {
    try {
      const r = await tryIt();
      if (r && Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
        await supabaseAdmin.from("geocode_cache").upsert({ query: key, lat: r.lat, lng: r.lng });
        return r;
      }
    } catch (e) {
      console.error("geocode attempt failed", e);
    }
  }
  return null;
}

type Settings = {
  origin_cep: string;
  origin_lat: number | null;
  origin_lng: number | null;
  raio_maximo_km: number;
  limite_km_taxa_fixa: number;
  valor_taxa_fixa_cents: number;
  valor_por_km_adicional_cents: number;
};

export async function resolveOrigin(s: Settings) {
  if (s.origin_lat != null && s.origin_lng != null) return { lat: s.origin_lat, lng: s.origin_lng };
  const addr = await lookupCep(s.origin_cep);
  const pos = await geocode({ ...addr, number: "" });
  if (!pos) throw new Error("Não foi possível localizar o CEP base da loja.");
  await supabaseAdmin.from("store_settings").update({ origin_lat: pos.lat, origin_lng: pos.lng }).eq("id", 1);
  return pos;
}

export async function quoteDelivery(addr: AddressInput, s: Settings): Promise<FreightResult & { lat: number; lng: number }> {
  const [origin, dest] = await Promise.all([resolveOrigin(s), geocode(addr)]);
  if (!dest) throw new Error("Não conseguimos localizar esse endereço no mapa. Confira o número e o CEP.");
  const km = Math.round(haversineKm(origin, dest) * 100) / 100;
  return { ...calcDeliveryFee(km, s), lat: dest.lat, lng: dest.lng };
}
