import { useEffect, useId, useRef, useState } from "react";
import { BriefcaseBusiness, Building2, Fence, House, Loader2, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RESIDENCE_OPTIONS, type ResidenceType } from "@/lib/address";
import { cepLookup } from "@/lib/customer.functions";
import { maskCep } from "@/lib/format";
import { cn } from "@/lib/utils";

export type AddressDraft = {
  label: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
  residence_type: ResidenceType;
};

export const emptyAddress: AddressDraft = {
  label: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  reference: "",
  residence_type: "casa",
};

export function isAddressComplete(a: AddressDraft) {
  return /^\d{5}-?\d{3}$/.test(a.cep) && a.street.trim().length >= 2 && a.number.trim().length >= 1 && a.city.trim().length >= 2 && a.state.trim().length === 2;
}

const RESIDENCE_ICONS: Record<ResidenceType, LucideIcon> = {
  casa: House,
  apartamento: Building2,
  condominio: Fence,
  comercial: BriefcaseBusiness,
};

export function AddressForm({ value, onChange, showLabel = false }: { value: AddressDraft; onChange: (v: AddressDraft) => void; showLabel?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastCep = useRef("");
  const valueRef = useRef(value);
  valueRef.current = value;
  const groupId = useId();
  const set = (patch: Partial<AddressDraft>) => onChange({ ...value, ...patch });
  const highlightComplement = value.residence_type === "apartamento" || value.residence_type === "condominio";

  useEffect(() => {
    const digits = value.cep.replace(/\D/g, "");
    if (digits.length !== 8 || digits === lastCep.current) return;
    lastCep.current = digits;
    setLoading(true);
    setError(null);
    cepLookup({ data: { cep: digits } })
      .then((r) => {
        const current = valueRef.current;
        onChange({ ...current, cep: r.cep, street: r.street || current.street, neighborhood: r.neighborhood || current.neighborhood, city: r.city, state: r.state });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.cep]);

  return (
    <div className="grid grid-cols-6 gap-2.5">
      {showLabel && (
        <Input className="col-span-6 h-11" placeholder="Apelido (ex: Casa, Trabalho)" value={value.label} onChange={(e) => set({ label: e.target.value })} maxLength={40} />
      )}

      <fieldset className="col-span-6">
        <legend className="mb-2 text-sm font-bold">Tipo de imóvel / residência</legend>
        <RadioGroup
          aria-label="Tipo de imóvel / residência"
          value={value.residence_type}
          onValueChange={(residenceType) => set({ residence_type: residenceType as ResidenceType })}
          className="grid grid-cols-2 gap-2"
        >
          {RESIDENCE_OPTIONS.map((option) => {
            const Icon = RESIDENCE_ICONS[option.value];
            const selected = value.residence_type === option.value;
            return (
              <Label
                key={option.value}
                htmlFor={`${groupId}-${option.value}`}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors sm:text-sm",
                  selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50",
                )}
              >
                <RadioGroupItem id={`${groupId}-${option.value}`} value={option.value} />
                <Icon className="size-4 shrink-0" />
                <span>{option.label}</span>
              </Label>
            );
          })}
        </RadioGroup>
      </fieldset>

      <div className="relative col-span-3">
        <Input className="h-11" inputMode="numeric" placeholder="CEP" value={value.cep} onChange={(e) => set({ cep: maskCep(e.target.value) })} />
        {loading && <Loader2 className="absolute right-3 top-3 size-5 animate-spin text-muted-foreground" />}
      </div>
      <Input className="col-span-3 h-11" placeholder="Número" value={value.number} onChange={(e) => set({ number: e.target.value })} maxLength={20} />
      <Input className="col-span-6 h-11" placeholder="Rua" value={value.street} onChange={(e) => set({ street: e.target.value })} maxLength={160} />
      <div className="col-span-6 sm:col-span-3">
        {highlightComplement && <Label className="mb-1.5 block font-bold text-primary">Complemento / Bloco / Apto</Label>}
        <Input
          aria-label={highlightComplement ? "Complemento, bloco ou apartamento" : "Complemento"}
          className={cn("h-11 w-full", highlightComplement && "border-primary bg-primary/5 ring-1 ring-primary/30 placeholder:text-primary/70")}
          placeholder={highlightComplement ? "Bloco, Apto, Torre ou Casa" : "Complemento (opcional)"}
          value={value.complement}
          onChange={(e) => set({ complement: e.target.value })}
          maxLength={80}
        />
      </div>
      <Input className="col-span-6 h-11 sm:col-span-3" placeholder="Bairro" value={value.neighborhood} onChange={(e) => set({ neighborhood: e.target.value })} maxLength={80} />
      <Input className="col-span-4 h-11" placeholder="Cidade" value={value.city} onChange={(e) => set({ city: e.target.value })} maxLength={80} />
      <Input className="col-span-2 h-11 uppercase" placeholder="UF" value={value.state} onChange={(e) => set({ state: e.target.value.toUpperCase().slice(0, 2) })} />
      <Input className="col-span-6 h-11" placeholder="Ponto de referência" value={value.reference} onChange={(e) => set({ reference: e.target.value })} maxLength={160} />
      {error && <p className="col-span-6 text-sm text-destructive">{error}</p>}
    </div>
  );
}
