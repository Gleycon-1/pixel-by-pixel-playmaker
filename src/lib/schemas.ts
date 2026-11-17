import { z } from "zod";
import { RESIDENCE_TYPES } from "./address";

/** Campo opcional que sempre sai como string | null (sem undefined). */
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const addressSchema = z.object({
  label: opt(40),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido."),
  street: z.string().trim().min(2).max(160),
  number: z.string().trim().min(1).max(20),
  complement: opt(80),
  neighborhood: opt(80),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().length(2),
  reference: opt(160),
});
export type AddressFormValues = z.infer<typeof addressSchema>;
