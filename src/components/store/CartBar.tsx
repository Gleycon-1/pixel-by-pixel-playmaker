import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { money } from "@/lib/format";
import { cartTotals, useCart } from "@/stores/cart";
import { useHydrated } from "@/stores/hydration";

export function CartBar() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  if (!hydrated) return null;
  const { count, subtotalCents } = cartTotals(items);
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-5 z-40 px-4 pr-22" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <Link
        to="/carrinho"
        className="mx-auto flex h-14 max-w-md items-center gap-3 rounded-full bg-gradient-primary px-5 font-bold text-primary-foreground shadow-glow"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-background/20">
          <ShoppingBag className="size-4" />
        </span>
        <span className="text-sm">
          {count} {count === 1 ? "item" : "itens"}
        </span>
        <span className="ml-auto font-display text-lg">{money(subtotalCents)}</span>
      </Link>
    </div>
  );
}
