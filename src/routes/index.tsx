import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, RotateCcw, Sparkles, Wallet } from "lucide-react";
import { useMemo } from "react";
import { catalogQuery } from "@/lib/catalog.functions";
import { storeInfo, waLink } from "@/lib/store-info";
import { STORE_CONFIG } from "@/store.config";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductCard } from "@/components/store/ProductCard";
import { CartBar } from "@/components/store/CartBar";
import { FloatingWhatsApp } from "@/components/store/FloatingWhatsApp";
import { InstagramIcon, WhatsAppIcon } from "@/components/store/icons";
import { useMe } from "@/hooks/use-customer";
import { useCart } from "@/stores/cart";
import { money } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${STORE_CONFIG.storeName} — Bebidas geladas no delivery` },
      { name: "description", content: `${STORE_CONFIG.tagline}. Cervejas, destilados, combos e copões com entrega rápida.` },
      { property: "og:title", content: `${STORE_CONFIG.storeName} — Bebidas geladas no delivery` },
      { property: "og:description", content: STORE_CONFIG.tagline },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);
  const { settings, categories, products } = data;
  const info = storeInfo(settings);

  const featured = useMemo(() => products.filter((p) => p.featured), [products]);
  const sections = useMemo(
    () =>
      categories
        .map((c) => ({ category: c, items: products.filter((p) => p.category_id === c.id) }))
        .filter((s) => s.items.length > 0),
    [categories, products],
  );

  return (
    <div className="min-h-screen pb-32">
      <StoreHeader name={info.name} logoUrl={info.logoUrl} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <img
          src={info.bannerUrl}
          alt=""
          width={1600}
          height={800}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-4 px-4 pb-6 pt-24 sm:pt-36">
          <span
            className={
              settings.store_open
                ? "w-fit rounded-full bg-success px-3 py-1 text-xs font-bold uppercase tracking-wide text-success-foreground"
                : "w-fit rounded-full bg-destructive px-3 py-1 text-xs font-bold uppercase tracking-wide text-destructive-foreground"
            }
          >
            {settings.store_open ? `● Aberto · entrega em até ${settings.eta_minutes} min` : "Fechado no momento"}
          </span>
          <h1 className="max-w-xl font-display text-4xl font-extrabold leading-[0.95] sm:text-6xl">{info.name}</h1>
          <p className="max-w-md text-base text-foreground/80 sm:text-lg">{info.tagline}</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar">
            <a
              href={waLink(info.whatsappNumber, `Olá, ${info.name}! Gostaria de fazer um pedido.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-2 rounded-full bg-whatsapp px-4 py-2.5 text-sm font-bold text-whatsapp-foreground"
            >
              <WhatsAppIcon className="size-4" /> {info.whatsappDisplay}
            </a>
            <a
              href={info.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2.5 text-sm font-semibold backdrop-blur"
            >
              <InstagramIcon className="size-4" /> {info.instagramUser}
            </a>
            <a
              href={info.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2.5 text-sm font-semibold backdrop-blur"
            >
              <MapPin className="size-4 text-primary" /> {info.addressText}
            </a>
          </div>
        </div>
      </section>

      <CustomerStrip />

      {/* Category chips */}
      {sections.length > 0 && (
        <nav className="sticky top-16 z-30 border-b border-border bg-background/90 py-3 backdrop-blur-xl">
          <div className="snap-row mx-auto max-w-5xl">
            {settings.featured_enabled && featured.length > 0 && (
              <a href="#destaques" className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                ⚡ Destaques
              </a>
            )}
            {sections.map((s) => (
              <a
                key={s.category.id}
                href={`#cat-${s.category.id}`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:border-primary"
              >
                {s.category.name}
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* DESTAQUES */}
      {settings.featured_enabled && featured.length > 0 && (
        <section id="destaques" className="mx-auto max-w-5xl scroll-mt-32 pt-6">
          <div className="flex items-center gap-2 px-4 pb-3">
            <Sparkles className="size-5 text-primary" />
            <h2 className="text-2xl font-extrabold">Destaques</h2>
          </div>
          <div className="snap-row pb-2">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} size="lg" />
            ))}
          </div>
        </section>
      )}

      {sections.map((s) => (
        <section key={s.category.id} id={`cat-${s.category.id}`} className="mx-auto max-w-5xl scroll-mt-32 pt-7">
          <h2 className="px-4 pb-3 text-xl font-extrabold">{s.category.name}</h2>
          <div className="snap-row pb-2">
            {s.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ))}

      <footer className="mx-auto mt-12 max-w-5xl px-4 text-sm text-muted-foreground">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-lg font-extrabold text-foreground">{info.name}</p>
          <a href={info.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-start gap-2 hover:text-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" /> {info.addressText}
          </a>
          <p className="mt-3 text-xs">
            Entregamos em até {settings.raio_maximo_km} km. Venda proibida para menores de 18 anos. Beba com moderação.
          </p>
        </div>
        <p className="py-6 text-center text-xs">
          <Link to="/admin" className="hover:text-foreground">
            Área do lojista
          </Link>
        </p>
      </footer>

      <CartBar />
      <FloatingWhatsApp />
    </div>
  );
}

function CustomerStrip() {
  const { data, loggedIn } = useMe();
  const replace = useCart((s) => s.replace);
  const navigate = useNavigate();
  const { data: catalog } = useSuspenseQuery(catalogQuery);
  if (!loggedIn || !data) return null;
  const last = data.lastDelivered;

  const reorder = () => {
    if (!last) return;
    const items = last.order_items
      .map((it) => {
        const p = catalog.products.find((x) => x.id === it.product_id);
        if (!p || !p.available) return null;
        return { productId: p.id, name: p.name, priceCents: p.price_cents, imageUrl: p.image_url, qty: it.quantity };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (!items.length) {
      toast.error("Os itens do último pedido estão esgotados.");
      return;
    }
    if (items.length < last.order_items.length) toast.message("Alguns itens estão esgotados e ficaram de fora.");
    replace(items);
    navigate({ to: "/carrinho" });
  };

  return (
    <section className="mx-auto max-w-5xl px-4 pt-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <Wallet className="size-5 text-accent" />
          <div>
            <p className="text-xs text-muted-foreground">Olá, {data.customer.name.split(" ")[0]}! Seu cashback</p>
            <p className="font-display text-lg font-extrabold text-accent">{money(data.customer.cashback_cents)}</p>
          </div>
        </div>
        {last && (
          <button
            onClick={reorder}
            className="flex flex-1 items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-left transition-colors hover:bg-primary/15"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <RotateCcw className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold">Pedir de novo</span>
              <span className="block truncate text-xs text-muted-foreground">
                {last.order_items.map((i) => `${i.quantity}x ${i.name}`).join(" · ")}
              </span>
            </span>
            <span className="font-display font-extrabold text-primary">{money(last.subtotal_cents)}</span>
          </button>
        )}
      </div>
    </section>
  );
}
