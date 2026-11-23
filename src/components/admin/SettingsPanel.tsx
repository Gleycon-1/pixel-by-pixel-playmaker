import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { adminChangePassword, adminGetSettings, adminSaveSettings } from "@/lib/admin.functions";
import { centsToInput, maskCep, parseMoneyInput } from "@/lib/format";
import { ADMIN_PASSWORD_REQUIREMENTS, isStrongAdminPassword } from "@/lib/admin-password";
import { useAdmin } from "./use-admin";
import { IdentitySettings } from "./IdentitySettings";
import { PaymentVaultPanel } from "./PaymentVaultPanel";

type S = Awaited<ReturnType<typeof adminGetSettings>>;
type Form = Record<string, string | boolean>;

const tIdentity = (value: string | boolean | undefined) => typeof value === "string" && value ? value : null;

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
  const [currentPwd, setCurrentPwd] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const { setToken, handleError } = useAdmin();

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
      require_delivery_pin: s.require_delivery_pin,
      logo_url: s.logo_url ?? "",
      banner_url: s.banner_url ?? "",
      banner_enabled: s.banner_enabled,
      button_color: s.button_color,
      store_theme: s.store_theme,
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
            require_delivery_pin: !!f["require_delivery_pin"],
            logo_url: t("logo_url"),
            banner_url: t("banner_url"),
            banner_enabled: !!f["banner_enabled"],
            button_color: str("button_color"),
            store_theme: str("store_theme") as "dark" | "light",
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
      <IdentitySettings
        values={{
          logo_url: tIdentity(f["logo_url"]),
          banner_url: tIdentity(f["banner_url"]),
          banner_enabled: !!f["banner_enabled"],
          button_color: str("button_color"),
          store_theme: str("store_theme") === "light" ? "light" : "dark",
        }}
        onChange={(patch) => {
          const { logo_url, banner_url, ...rest } = patch;
          setF({
            ...f,
            ...rest,
            ...(logo_url !== undefined ? { logo_url: logo_url ?? "" } : {}),
            ...(banner_url !== undefined ? { banner_url: banner_url ?? "" } : {}),
          });
        }}
      />
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">Operação</h2>
        <div className="grid grid-cols-3 gap-1">
          {(["open", "closed", "auto"] as const).map((m) => (
            <Button key={m} variant={f["store_mode"] === m ? "default" : "outline"} onClick={() => set("store_mode", m)}>
              {m === "open" ? "Aberta" : m === "closed" ? "Fechada" : "Automático"}
            </Button>
          ))}
        </div>
        {toggle("require_delivery_pin", "Exigir Código de Confirmação nas Entregas")}
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

      <PaymentVaultPanel
        configured={q.data.mp_configured}
        tokenSaved={q.data.payment_token_saved}
        passwordSet={q.data.payment_password_set}
        initialEnvironment={q.data.payment_environment}
      />
      <div className="flex flex-wrap items-start gap-3 lg:col-span-2">
        <Button size="lg" onClick={submit}>Salvar configurações</Button>
        <form
          className="ml-auto w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPwdError("");
            if (!currentPwd) {
              setPwdError("Informe a senha atual do painel.");
              return;
            }
            if (!isStrongAdminPassword(pwd)) {
              setPwdError("A nova senha ainda não atende a todos os requisitos abaixo.");
              return;
            }
            setPwdBusy(true);
            try {
              await changePwd({ data: { token, currentPassword: currentPwd, newPassword: pwd } });
              setCurrentPwd("");
              setPwd("");
              toast.success("Senha alterada! Entre novamente com a nova senha.");
              setToken(null);
            } catch (error) {
              const message = error instanceof Error ? error.message : "Não foi possível alterar a senha.";
              setPwdError(message);
              handleError(error);
            } finally {
              setPwdBusy(false);
            }
          }}
        >
          <h2 className="font-display text-lg font-extrabold">Senha de acesso ao painel</h2>
          <div>
            <Label htmlFor="currentpwd">Senha atual</Label>
            <Input id="currentpwd" type="password" autoComplete="current-password" value={currentPwd} onChange={(event) => { setCurrentPwd(event.target.value); setPwdError(""); }} />
          </div>
          <div>
            <Label htmlFor="newpwd">Nova senha do painel</Label>
            <Input id="newpwd" type="password" autoComplete="new-password" value={pwd} onChange={(event) => { setPwd(event.target.value); setPwdError(""); }} aria-describedby="admin-password-requirements" />
          </div>
          <ul id="admin-password-requirements" className="space-y-1 text-xs" aria-live="polite">
            {ADMIN_PASSWORD_REQUIREMENTS.map((requirement) => {
              const met = requirement.test(pwd);
              return (
                <li key={requirement.key} className={`flex items-center gap-2 ${met ? "text-success" : "text-muted-foreground"}`}>
                  {met ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
                  <span>{requirement.label}</span>
                  <span className="sr-only">{met ? "atendido" : "pendente"}</span>
                </li>
              );
            })}
          </ul>
          {pwdError && <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{pwdError}</p>}
          <Button type="submit" variant="outline" disabled={pwdBusy || !currentPwd || !isStrongAdminPassword(pwd)}>
            {pwdBusy && <Loader2 className="animate-spin" />} Alterar senha do painel
          </Button>
        </form>
      </div>
    </div>
  );
}
