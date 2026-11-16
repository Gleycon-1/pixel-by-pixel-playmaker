import { createFileRoute, Link } from "@tanstack/react-router";
import { STORE_CONFIG } from "@/store.config";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Painel do lojista — ${STORE_CONFIG.storeName}` },
      { name: "description", content: "Painel administrativo da loja." },
      { property: "og:title", content: `Painel do lojista — ${STORE_CONFIG.storeName}` },
      { property: "og:description", content: "Painel administrativo da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-extrabold">Painel do lojista</h1>
        <p className="mt-2 text-muted-foreground">O painel completo ainda está sendo finalizado.</p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 font-bold text-primary-foreground">
          Voltar para a loja
        </Link>
      </div>
    </div>
  );
}
