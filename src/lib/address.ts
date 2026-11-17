export const RESIDENCE_TYPES = ["casa", "apartamento", "condominio", "comercial"] as const;

export type ResidenceType = (typeof RESIDENCE_TYPES)[number];

export const RESIDENCE_OPTIONS: Array<{ value: ResidenceType; label: string }> = [
  { value: "casa", label: "Casa" },
  { value: "apartamento", label: "Prédio / Apartamento" },
  { value: "condominio", label: "Condomínio" },
  { value: "comercial", label: "Comercial / Trabalho" },
];

export function residenceTypeLabel(value: string | null | undefined) {
  return RESIDENCE_OPTIONS.find((option) => option.value === value)?.label ?? "Não informado";
}

type StoredAddressLabel = {
  v: 1;
  label: string | null;
  residence_type: ResidenceType;
};

/**
 * Os endereços salvos não têm uma coluna própria para o tipo de imóvel.
 * Guardamos apelido e tipo juntos em label; pedidos continuam usando address.residence_type no JSONB.
 */
export function encodeAddressLabel(label: string | null, residenceType: ResidenceType) {
  const stored: StoredAddressLabel = { v: 1, label: label?.trim() || null, residence_type: residenceType };
  return JSON.stringify(stored);
}

export function decodeAddressLabel(raw: string | null): { label: string | null; residence_type: ResidenceType } {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredAddressLabel>;
      if (
        parsed.v === 1 &&
        typeof parsed.residence_type === "string" &&
        (RESIDENCE_TYPES as readonly string[]).includes(parsed.residence_type)
      ) {
        return {
          label: typeof parsed.label === "string" && parsed.label.trim() ? parsed.label : null,
          residence_type: parsed.residence_type as ResidenceType,
        };
      }
    } catch {
      // Endereços antigos guardam apenas o apelido em texto puro.
    }
  }
  return { label: raw || null, residence_type: "casa" };
}

export function addressForStorage<T extends { label: string | null; residence_type: ResidenceType }>(address: T) {
  const { label, residence_type, ...fields } = address;
  return { ...fields, label: encodeAddressLabel(label, residence_type) };
}
