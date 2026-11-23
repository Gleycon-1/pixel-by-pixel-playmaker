import { normalizeMobilePhone, normalizePhone } from "@/lib/rules";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/store/PageShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { loginCustomer, registerCustomer } from "@/lib/customer.functions";
import { maskPhoneInput, phoneDisplay } from "@/lib/format";
import { useSession } from "@/stores/session";
import { STORE_CONFIG } from "@/store.config";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => {
    const r = s["redirect"];
    return { redirect: typeof r === "string" && r.startsWith("/") ? r : undefined };
  },
  head: () => ({
    meta: [
      { title: `Entrar — ${STORE_CONFIG.storeName}` },
      { name: "description", content: "Entre com seu WhatsApp e PIN para pedir, acompanhar pedidos e usar seu cashback." },
      { property: "og:title", content: `Entrar — ${STORE_CONFIG.storeName}` },
      { property: "og:description", content: "Login rápido com WhatsApp e PIN de 4 dígitos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function PinField({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <InputOTP maxLength={4} value={value} onChange={onChange} inputMode="numeric" pattern="^[0-9]*$" autoFocus={autoFocus}>
      <InputOTPGroup className="gap-3">
        {[0, 1, 2, 3].map((i) => (
          <InputOTPSlot key={i} index={i} className="size-14 rounded-xl border border-input text-2xl font-bold" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setToken = useSession((s) => s.setCustomerToken);
  const setLastPhone = useSession((s) => s.setLastPhone);
  const login = useServerFn(loginCustomer);
  const register = useServerFn(registerCustomer);

  const [step, setStep] = useState<"phone" | "pin" | "register">("phone");
  const [phone, setPhone] = useState("");
  const [normalized, setNormalized] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = (token: string) => {
    setToken(token);
    setLastPhone(normalized);
    qc.invalidateQueries({ queryKey: ["me"] });
    toast.success("Tudo certo! Você está conectado.");
    navigate({ to: redirect ?? "/" });
  };

  const submitPhone = async () => {
    setError(null);
    setBusy(true);
    try {
      const p = normalizePhone(phone);
      if (!p) throw new Error("Número de WhatsApp inválido. Use DDD + número.");
      setNormalized(p);
      setStep("pin");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitPin = async () => {
    if (pin.length !== 4) return;
    setError(null);
    setBusy(true);
    try {
      const r = await login({ data: { phone: normalized, pin } });
      if (r.ok) return done(r.token);
      setPin("");
      if (r.locked) {
        const until = r.lockedUntil ? new Date(r.lockedUntil).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
        setError(`Acesso bloqueado por 15 minutos após 5 tentativas erradas${until ? ` (libera às ${until})` : ""}.`);
      } else {
        setError("WhatsApp ou PIN incorreto. Primeiro acesso? Crie seu cadastro abaixo.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startRegistration = () => {
    setError(null);
    if (!normalizeMobilePhone(normalized)) {
      setError("Digite um celular brasileiro válido, com DDD e sem sequências repetidas.");
      return;
    }
    setStep("register");
    setPin("");
  };

  const submitRegister = async () => {
    setError(null);
    if (!normalizeMobilePhone(normalized)) return setError("Digite um celular brasileiro válido, com DDD e sem sequências repetidas.");
    if (name.trim().length < 2) return setError("Informe seu nome.");
    if (pin.length !== 4) return setError("Crie um PIN de 4 números.");
    if (pin !== pin2) return setError("Os PINs não conferem.");
    setBusy(true);
    try {
      const r = await register({ data: { phone: normalized, name: name.trim(), pin } });
      done(r.token);
    } catch {
      setError("Não foi possível criar o cadastro. Se você já tem conta, entre com seu PIN.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Entrar">
      <div className="mx-auto max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            {step === "phone" ? <ShieldCheck className="size-7" /> : <Lock className="size-7" />}
          </span>
          <h2 className="text-2xl font-extrabold">
            {step === "phone" ? "Seu WhatsApp" : step === "pin" ? "Digite seu PIN" : "Criar cadastro"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "phone"
              ? "Use o número que você usa no WhatsApp. Sem senha complicada."
              : step === "pin"
                ? `Entrando como ${phoneDisplay(normalized)}`
                : `Primeiro pedido com ${phoneDisplay(normalized)}. Crie um PIN de 4 números para proteger seus dados e seu cashback.`}
          </p>
        </div>

        {step === "phone" && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitPhone();
            }}
          >
            <Input
              autoFocus
              inputMode="tel"
              placeholder="(11) 90000-0000"
              value={phone}
              onChange={(e) => setPhone(maskPhoneInput(e.target.value))}
              className="h-14 rounded-xl text-center text-xl font-bold"
            />
            <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy || phone.replace(/\D/g, "").length < 10}>
              {busy ? <Loader2 className="animate-spin" /> : "Continuar"}
            </Button>
          </form>
        )}

        {step === "pin" && (
          <form
            className="flex flex-col items-center gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submitPin();
            }}
          >
            <PinField value={pin} onChange={setPin} autoFocus />
            <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy || pin.length !== 4}>
              {busy ? <Loader2 className="animate-spin" /> : "Entrar"}
            </Button>
            <button type="button" className="text-sm font-bold text-primary underline" onClick={startRegistration}>
              Primeiro acesso? Criar cadastro
            </button>
            <button type="button" className="text-sm text-muted-foreground underline" onClick={() => { setStep("phone"); setPin(""); setError(null); }}>
              Trocar número
            </button>
          </form>
        )}

        {step === "register" && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submitRegister();
            }}
          >
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confira seu WhatsApp</p>
              <p className="mt-1 text-xl font-extrabold text-primary">{phoneDisplay(normalized)}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Digite o seu número real de WhatsApp (com DDD) — ele será usado para acompanhar o pedido e confirmar a entrega. Não enviaremos código.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Seu nome</label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Como podemos te chamar?" className="h-12 rounded-xl" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Crie um PIN de 4 números</label>
              <PinField value={pin} onChange={setPin} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Confirme o PIN</label>
              <PinField value={pin2} onChange={setPin2} />
            </div>
            <Button type="submit" variant="hero" size="xl" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : "Criar cadastro e continuar"}
            </Button>
            <button type="button" className="block w-full text-center text-sm text-muted-foreground underline" onClick={() => { setStep("phone"); setError(null); }}>
              Trocar número
            </button>
          </form>
        )}

        {error && <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</p>}
      </div>
    </PageShell>
  );
}
