import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/catalog.functions";
import { money } from "@/lib/format";
import { useCart } from "@/stores/cart";
import { useHydrated } from "@/stores/hydration";
import { cn } from "@/lib/utils";

export function ProductCard({ product, size = "md" }: { product: Product; size?: "md" | "lg" }) {
  const hydrated = useHydrated();
  const qty = useCart((s) => s.items.find((i) => i.productId === product.id)?.qty ?? 0);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const shownQty = hydrated ? qty : 0;
  const soldOut = !product.available;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-gradient-card shadow-card",
        size === "lg" ? "w-56 sm:w-64" : "w-40 sm:w-48",
        soldOut && "opacity-60",
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            width={400}
            height={400}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-4xl font-extrabold text-muted-foreground">
            {product.name.slice(0, 1)}
          </div>
        )}
        {soldOut && (
          <span className="absolute left-2 top-2 rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold uppercase text-destructive-foreground">
            Esgotado
          </span>
        )}
        {product.featured && !soldOut && size === "lg" && (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold uppercase text-primary-foreground">
            Destaque
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className={cn("line-clamp-2 font-sans font-bold leading-snug", size === "lg" ? "text-base" : "text-sm")}>
          {product.name}
        </h3>
        {product.description && size === "lg" && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-display text-lg font-extrabold text-primary">{money(product.price_cents)}</span>
          {shownQty > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-muted p-0.5">
              <button
                className="flex size-7 items-center justify-center rounded-full bg-secondary"
                onClick={() => setQty(product.id, shownQty - 1)}
                aria-label="Diminuir"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-bold">{shownQty}</span>
              <button
                className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
                onClick={() => setQty(product.id, shownQty + 1)}
                aria-label="Aumentar"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              disabled={soldOut}
              onClick={() => {
                add({ productId: product.id, name: product.name, priceCents: product.price_cents, imageUrl: product.image_url });
                toast.success(`${product.name} no carrinho`, { duration: 1500 });
              }}
              className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow transition-transform active:scale-90 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
              aria-label={`Adicionar ${product.name}`}
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
