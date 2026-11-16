import { Link } from "@tanstack/react-router";
import { ClipboardList, ShoppingBag, User } from "lucide-react";
import { useCart, cartTotals } from "@/stores/cart";
import { useHydrated } from "@/stores/hydration";
import { useSession } from "@/stores/session";

export function StoreHeader({ name, logoUrl }: { name: string; logoUrl: string }) {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const token = useSession((s) => s.customerToken);
  const count = hydrated ? cartTotals(items).count : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <img src={logoUrl} alt={name} width={40} height={40} className="size-10 shrink-0 rounded-xl object-cover" />
          <span className="truncate font-display text-lg font-extrabold leading-none">{name}</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link
            to={hydrated && token ? "/pedidos" : "/entrar"}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Meus pedidos"
          >
            <ClipboardList className="size-5" />
          </Link>
          <Link
            to={hydrated && token ? "/conta" : "/entrar"}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Minha conta"
          >
            <User className="size-5" />
          </Link>
          <Link
            to="/carrinho"
            className="relative flex h-10 items-center gap-2 rounded-full bg-primary px-4 font-bold text-primary-foreground shadow-glow"
            aria-label="Carrinho"
          >
            <ShoppingBag className="size-4" />
            <span className="text-sm">{count}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
