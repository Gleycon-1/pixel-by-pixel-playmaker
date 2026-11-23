import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { catalogQuery } from "@/lib/catalog.functions";
import { StoreThemeStyle } from "./StoreThemeStyle";

export function PageShell({ title, back = "/", children, action }: { title: string; back?: "/" | "/conta" | "/pedidos" | "/carrinho"; children: ReactNode; action?: ReactNode }) {
  const { data } = useQuery(catalogQuery);
  return (
    <div className={`min-h-screen pb-32 ${data?.settings.store_theme === "light" ? "store-theme-light" : ""}`}>
      {data && <StoreThemeStyle settings={data.settings} />}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
          <Link to={back} className="flex size-10 items-center justify-center rounded-full hover:bg-muted" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="truncate text-xl font-extrabold">{title}</h1>
          <div className="ml-auto">{action}</div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pt-5">{children}</main>
    </div>
  );
}
