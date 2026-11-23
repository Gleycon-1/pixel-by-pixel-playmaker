import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { adminRevealPaymentToken, adminSavePaymentToken, adminSetPaymentVaultPassword } from "@/lib/payment-vault.functions";
import { useAdmin } from "./use-admin";

export function PaymentVaultPanel({ configured, tokenSaved, passwordSet, initialEnvironment }: { configured: boolean; tokenSaved: boolean; passwordSet: boolean; initialEnvironment: string }) {
  const { token, run } = useAdmin();
  const qc = useQueryClient();
  const reveal = useServerFn(adminRevealPaymentToken);
  const save = useServerFn(adminSavePaymentToken);
  const changeVaultPassword = useServerFn(adminSetPaymentVaultPassword);
  const [environment, setEnvironment] = useState<"test" | "production">(initialEnvironment === "production" ? "production" : "test");
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => setEnvironment(initialEnvironment === "production" ? "production" : "test"), [initialEnvironment]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    void qc.invalidateQueries({ queryKey: ["catalog"] });
  };

  const unlock = async () => {
    if (!password) return;
    setBusy(true);
    const result = await run(() => reveal({ data: { token, password } }), "Cofre desbloqueado.");
    setBusy(false);
    if (result) {
      setAccessToken(result.accessToken);
      setVisible(true);
    }
  };

  const saveToken = async () => {
    setBusy(true);
    const result = await run(() => save({ data: { token, password, environment, accessToken: accessToken.trim() } }), accessToken.trim() ? "Token salvo com segurança." : "Token removido; o fallback do ambiente será usado.");
    setBusy(false);
    if (result) {
      setPassword("");
      setVisible(false);
      setAccessToken("");
      refresh();
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) return;
    setBusy(true);
    const result = await run(
      () => changeVaultPassword({ data: { token, currentPassword: passwordSet ? currentPassword : null, newPassword } }),
      passwordSet ? "Senha do token alterada." : "Senha exclusiva do cofre criada.",
    );
    setBusy(false);
    if (result) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPassword("");
      setAccessToken("");
      setVisible(false);
      refresh();
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 lg:col-span-2">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary"><LockKeyhole className="size-5" /></span>
        <div className="flex-1">
          <h2 className="font-display text-lg font-extrabold">Cofre do Access Token do Mercado Pago</h2>
          <p className="text-xs text-muted-foreground">O token nunca aparece na loja pública e fica oculto até a senha ser confirmada.</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${configured ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
          {configured ? "Configurado" : "Não configurado"}
        </span>
      </div>

      {!passwordSet ? (
        <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/5 p-3">
          <p className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4" /> Defina a senha inicial exclusiva do cofre</p>
          <p className="text-xs text-muted-foreground">Use pelo menos 8 caracteres. Ela será exigida para ver ou alterar o token.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label htmlFor="vault-initial">Nova senha do token</Label><Input id="vault-initial" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <div><Label htmlFor="vault-initial-confirm">Confirmar senha</Label><Input id="vault-initial-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && <p className="text-xs text-destructive">As senhas não conferem.</p>}
          <Button type="button" disabled={busy || newPassword.length < 8 || newPassword !== confirmPassword} onClick={changePassword}>Criar senha do cofre</Button>
        </div>
      ) : (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">Ambiente da API</legend>
            <RadioGroup value={environment} onValueChange={(v) => setEnvironment(v as "test" | "production")} className="grid-cols-2">
              <Label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 ${environment === "test" ? "border-primary bg-primary/10" : "border-border"}`}>
                <RadioGroupItem value="test" /> <span><b className="block text-sm">Teste / Sandbox</b><span className="text-xs text-muted-foreground">Token TEST-...</span></span>
              </Label>
              <Label className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 ${environment === "production" ? "border-primary bg-primary/10" : "border-border"}`}>
                <RadioGroupItem value="production" /> <span><b className="block text-sm">Produção / Definitivo</b><span className="text-xs text-muted-foreground">Token APP_USR-...</span></span>
              </Label>
            </RadioGroup>
          </fieldset>
          <div className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-2">
            <div>
              <Label htmlFor="vault-password">Senha do cofre</Label>
              <Input id="vault-password" type="password" autoComplete="current-password" placeholder="Obrigatória para desbloquear" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="mp-access-token">Access Token {tokenSaved && !visible ? "(salvo e oculto)" : ""}</Label>
              <div className="flex gap-2">
                <Input
                  id="mp-access-token"
                  type={visible ? "text" : "password"}
                  autoComplete="off"
                  placeholder={environment === "test" ? "TEST-..." : "APP_USR-..."}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  disabled={!visible && tokenSaved}
                />
                <Button type="button" variant="outline" size="icon" aria-label={visible ? "Bloquear token" : "Visualizar token"} disabled={busy || (!visible && !password)} onClick={() => visible ? (setVisible(false), setAccessToken("")) : void unlock()}>
                  {visible ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Para editar um token salvo, desbloqueie primeiro. Salvar vazio remove o token e usa o fallback.</p>
            </div>
          </div>
          <Button type="button" disabled={busy || !password || (!visible && tokenSaved)} onClick={saveToken}>Salvar ambiente e token</Button>
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-sm font-bold"><KeyRound className="mr-2 inline size-4" />Alterar senha do token</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div><Label htmlFor="vault-current">Senha atual</Label><Input id="vault-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
              <div><Label htmlFor="vault-new">Nova senha</Label><Input id="vault-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
              <div><Label htmlFor="vault-confirm">Confirmar nova</Label><Input id="vault-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && <p className="mt-2 text-xs text-destructive">As senhas não conferem.</p>}
            <Button type="button" variant="outline" className="mt-3" disabled={busy || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword} onClick={changePassword}>Alterar senha do token</Button>
          </details>
        </>
      )}
    </section>
  );
}
