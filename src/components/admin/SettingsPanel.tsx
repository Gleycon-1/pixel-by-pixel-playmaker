import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { adminChangePassword, adminGetSettings, adminSaveSettings } from "@/lib/admin.functions";
import { centsToInput, maskCep, parseMoneyInput } from "@/lib/format";
import { useAdmin } from "./use-admin";

type S = Awaited<ReturnType<typeof adminGetSettings>>;
type Form = Record<string, string | boolean>;

const TEXT: [keyof S, string][] = [
  ["store_name", "Nome da adega"],
  ["tagline", "Frase de destaque"],
  ["whatsapp_number", "WhatsApp (só números com 55)"],
  ["whatsapp_display", "WhatsApp exibido"],
  ["instagram_user", "Instagram (@)"],
  ["instagram_url", "Link do Instagram"],
  ["address_text", "Endereço"],
  ["google_maps_url", "Link do Google Maps"],
];

export function SettingsPanel() {
  const { token, run } = useAdmin();
  const qc = useQueryClient();
  const get = useServerFn(adminGetSettings);
  const save = useServerFn(adminSaveSettings);
  const changePwd = useServerFn(adminChangePassword);
  const q = useQuery({ queryKey: ["admin-settings"], queryFn: () => get({ data: { token } }) });
  const [f, setF] = useState<Form | null>(null);
  const [pwd, setPwd] = useState("");

  useEffect(() => {
    const s = q.data;
    if (!s || f) return;
    const form: Form = {};
    TEXT.forEach(([k]) => (form[k] = (s[k] as string | null) ?? ""));
    Object.assign(form, {
      origin_cep: maskCep(s.origin_cep),
      raio_maximo_km: String(s.raio_maximo_km).replace(".", ","),
      limite_km_taxa_fixa: String(s.limite_km_taxa_fixa).replace(".", ","),
      valor_taxa_fixa: centsToInput(s.valor_taxa_fixa_cents),
      valor_km: centsToInput(s.valor_por_km_adicional_cents),
      free_min: centsToInput(s.free_delivery_min_cents),
      cashback_percent: String(s.cashback_percent).replace(".", ","),
      eta_minutes: String(s.eta_minutes),
      open_time: s.open_time,
      close_time: s.close_time,
      store_mode: s.store_mode,
      accept_pix: s.accept_pix,
      accept_card: s.accept_card,
      accept_cash: s.accept_cash,
      allow_pickup: s.allow_pickup,
      pix_test_mode: s.pix_test_mode,
      featured_enabled: s.featured_enabled,
    });
    setF(form);
  }, [q.data, f]);

  if (!f || !q.data) return <p className="pt-4 text-sm text-muted-foreground">Carregando…</p>;
  const str = (k: string) => String(f[k] ?? "");
  const num = (k: string) => Number(str(k).replace(",", "."));
  const set = (k: string, v: string | boolean) => setF({ ...f, [k]: v });

  const submit = async () => {
    const t = (k: string) => (str(k).trim() ? str(k).trim() : null);
    const ok = await run(
      () =>
        save({
          data: {
            token,
            store_name: t("store_name"),
            tagline: t("tagline"),
            whatsapp_number: t("whatsapp_number"),
            whatsapp_display: t("whatsapp_display"),
            instagram_user: t("instagram_user"),
            instagram_url: t("instagram_url"),
            address_text: t("address_text"),
            google_maps_url: t("google_maps_url"),
            origin_cep: str("origin_cep"),
            raio_maximo_km: num("raio_maximo_km"),
            limite_km_taxa_fixa: num("limite_km_taxa_fixa"),
            valor_taxa_fixa_cents: parseMoneyInput(str("valor_taxa_fixa")),
            valor_por_km_adicional_cents: parseMoneyInput(str("valor_km")),
            free_delivery_min_cents: parseMoneyInput(str("free_min")),
            cashback_percent: num("cashback_percent"),
            eta_minutes: Math.round(num("eta_minutes")),
            open_time: str("open_time"),
            close_time: str("close_time"),
            store_mode: str("store_mode") as "open" | "closed" | "auto",
            accept_pix: !!f["accept_pix"],
            accept_card: !!f["accept_card"],
            accept_cash: !!f["accept_cash"],
            allow_pickup: !!f["allow_pickup"],
            pix_test_mode: !!f["pix_test_mode"],
            featured_enabled: !!f["featured_enabled"],
          },
        }),
      "Configurações salvas!",
    );
    if (ok) {
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
      void qc.invalidateQueries({ queryKey: ["catalog"] });
    }
  };

  // funções (não componentes) para não remontar os inputs a cada tecla
  const field = (k: string, label: string, rest: React.ComponentProps<typeof Input> = {}) => (
    <div key={k}><Label htmlFor={k}>{label}</Label><Input id={k} value={str(k)} onChange={(e) => set(k, e.target.value)} {...rest} /></div>
  );
  const toggle = (k: string, label: string) => (
    <label key={k} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm font-semibold">
      {label} <Switch checked={!!f[k]} onCheckedChange={(v) => set(k, v)} />
    </label>
  );

  return (
    <div className="grid gap-4 pt-2 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">Operação</h2>
        <div className="grid grid-cols-3 gap-1">
          {(["open", "closed", "auto"] as const).map((m) => (
            <Button key={m} variant={f["store_mode"] === m ? "default" : "outline"} onClick={() => set("store_mode", m)}>
              {m === "open" ? "Aberta" : m === "closed" ? "Fechada" : "Automático"}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {field("open_time", "Abre às", { type: "time" })}
          {field("close_time", "Fecha às", { type: "time" })}
          {field("eta_minutes", "Entrega (min)", { inputMode: "numeric" })}
        </div>
        {toggle("accept_pix", "Aceitar Pix")}
        {toggle("accept_card", "Aceitar maquininha")}
        {toggle("accept_cash", "Aceitar dinheiro")}
        {toggle("allow_pickup", "Permitir retirada na loja")}
        {toggle("featured_enabled", 'Mostrar vitrine "Destaques"')}
        {toggle("pix_test_mode", "Pix em modo teste (botão Simular Aprovação)")}
        {!q.data.mp_configured && <p className="text-xs text-muted-foreground">Mercado Pago ainda não configurado — use o modo teste.</p>}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">Frete e cashback</h2>
        <div className="grid grid-cols-2 gap-2">
          {field("origin_cep", "CEP base da loja", { onChange: (e) => set("origin_cep", maskCep(e.target.value)) })}
          {field("raio_maximo_km", "Raio máximo (km)", { inputMode: "decimal" })}
          {field("limite_km_taxa_fixa", "Taxa fixa até (km)", { inputMode: "decimal" })}
          {field("valor_taxa_fixa", "Taxa fixa (R$)", { inputMode: "decimal" })}
          {field("valor_km", "Por km adicional (R$)", { inputMode: "decimal" })}
          {field("free_min", "Frete grátis a partir de (R$, 0 = desligado)", { inputMode: "decimal" })}
          {field("cashback_percent", "Cashback (%)", { inputMode: "decimal" })}
        </div>
        <h2 className="pt-2 font-display text-lg font-extrabold">Dados da adega</h2>
        {TEXT.map(([k, label]) => field(k as string, label))}
      </section>

      <div className="flex flex-wrap items-end gap-3 lg:col-span-2">
        <Button size="lg" onClick={submit}>Salvar configurações</Button>
        <div className="ml-auto flex items-end gap-2">
          <div><Label htmlFor="newpwd">Nova senha do painel</Label><Input id="newpwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
          <Button variant="outline" disabled={pwd.length < 6} onClick={async () => (await run(() => changePwd({ data: { token, newPassword: pwd } }), "Senha alterada!")) && setPwd("")}>Alterar</Button>
        </div>
      </div>
    </div>
  );
}
