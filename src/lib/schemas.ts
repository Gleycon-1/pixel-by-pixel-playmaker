import { z } from "zod";

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional().nullable(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido."),
  street: z.string().trim().min(2).max(160),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80).optional().nullable(),
  neighborhood: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().length(2),
  reference: z.string().trim().max(160).optional().nullable(),
});
export type AddressFormValues = z.infer<typeof addressSchema>;
