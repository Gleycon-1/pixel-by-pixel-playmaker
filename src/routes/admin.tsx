import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ClipboardList, LogOut, Package, Receipt, Settings, ShoppingBasket, Bike, Loader2 } from "lucide-react";
import { STORE_CONFIG } from "@/store.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminCheck, adminLogin, adminLogout } from "@/lib/admin.functions";
import { useAdmin } from "@/components/admin/use-admin";
import { useHydrated } from "@/stores/hydration";
import { unlockAudio } from "@/components/admin/receipt";
import { OrdersBoard } from "@/components/admin/OrdersBoard";
import { PdvPanel } from "@/components/admin/PdvPanel";
import { CatalogPanel } from "@/components/admin/CatalogPanel";
import { CouriersPanel } from "@/components/admin/CouriersPanel";
import { ReportPanel } from "@/components/admin/ReportPanel";
import { SettingsPanel } from "@/components/admin/SettingsPanel";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: `Painel do lojista — ${STORE_CONFIG.storeName}` },
      { name: "description", content: "Painel administrativo da loja: pedidos, PDV, produtos e motoboys." },
      { property: "og:title", content: `Painel do lojista — ${STORE_CONFIG.storeName}` },
      { property: "og:description", content: "Painel administrativo da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminLogin() {
  const { setToken } = useAdmin();
  const login = useServerFn(adminLogin);
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          unlockAudio();
          setBusy(true);
          setErr(null);
          try {
            const r = await login({ data: { password: pwd } });
            if (r.ok) setToken(r.token);
            else setErr(r.message);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Erro ao entrar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <img src={STORE_CONFIG.logoUrl} alt="" className="mx-auto size-16 rounded-full" />
        <h1 className="text-center font-display text-2xl font-extrabold">Painel do lojista</h1>
        <Input type="password" placeholder="Senha do painel" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus aria-label="Senha do painel" />
        {err && <p className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy || !pwd}>
          {busy && <Loader2 className="animate-spin" />} Entrar
        </Button>
        <Link to="/" className="block text-center text-sm text-muted-foreground underline">Voltar para a loja</Link>
      </form>
    </div>
  );
}

const TABS = [
  { v: "orders", label: "Pedidos", icon: ClipboardList },
  { v: "pdv", label: "PDV", icon: ShoppingBasket },
  { v: "catalog", label: "Produtos", icon: Package },
  { v: "couriers", label: "Motoboys", icon: Bike },
  { v: "report", label: "Acerto", icon: Receipt },
  { v: "settings", label: "Config.", icon: Settings },
] as const;

function AdminPage() {
  const hydrated = useHydrated();
  const { token, setToken } = useAdmin();
  const check = useServerFn(adminCheck);
  const logout = useServerFn(adminLogout);
  const [tab, setTab] = useState<string>("orders");

  useEffect(() => {
    if (!token) return;
    check({ data: { token } }).then((r) => !r.ok && setToken(null)).catch(() => undefined);
  }, [token, check, setToken]);

  if (!hydrated) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!token) return <AdminLogin />;

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <img src={STORE_CONFIG.logoUrl} alt="" className="size-9 rounded-full" />
          <h1 className="font-display text-lg font-extrabold">Painel · {STORE_CONFIG.storeName}</h1>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={async () => {
              await logout({ data: { token } }).catch(() => undefined);
              setToken(null);
            }}
          >
            <LogOut /> Sair
          </Button>
        </div>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="mx-auto max-w-7xl px-4 pt-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {TABS.map((t) => (
            <TabsTrigger key={t.v} value={t.v} className="gap-1.5">
              <t.icon className="size-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="orders" forceMount className="data-[state=inactive]:hidden"><OrdersBoard /></TabsContent>
        <TabsContent value="pdv"><PdvPanel /></TabsContent>
        <TabsContent value="catalog"><CatalogPanel /></TabsContent>
        <TabsContent value="couriers"><CouriersPanel /></TabsContent>
        <TabsContent value="report"><ReportPanel /></TabsContent>
        <TabsContent value="settings"><SettingsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
