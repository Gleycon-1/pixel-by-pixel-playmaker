import { z } from "zod";

export const ADMIN_PASSWORD_REQUIREMENTS = [
  { key: "length", label: "No mínimo 8 caracteres", test: (value: string) => value.length >= 8 },
  { key: "uppercase", label: "Pelo menos 1 letra maiúscula", test: (value: string) => /[A-Z]/.test(value) },
  { key: "lowercase", label: "Pelo menos 1 letra minúscula", test: (value: string) => /[a-z]/.test(value) },
  { key: "number", label: "Pelo menos 1 número", test: (value: string) => /[0-9]/.test(value) },
  { key: "special", label: "Pelo menos 1 caractere especial", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export function isStrongAdminPassword(value: string) {
  return ADMIN_PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(value));
}

export const strongAdminPasswordSchema = z
  .string()
  .min(8, "A nova senha deve ter no mínimo 8 caracteres.")
  .max(100, "A nova senha deve ter no máximo 100 caracteres.")
  .regex(/[A-Z]/, "A nova senha deve ter pelo menos 1 letra maiúscula.")
  .regex(/[a-z]/, "A nova senha deve ter pelo menos 1 letra minúscula.")
  .regex(/[0-9]/, "A nova senha deve ter pelo menos 1 número.")
  .regex(/[^A-Za-z0-9]/, "A nova senha deve ter pelo menos 1 caractere especial.")
  .refine((value) => value !== "adega2026", "Escolha uma senha diferente da inicial.");
