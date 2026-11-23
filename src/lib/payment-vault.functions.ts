import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./session.server";

const withAdmin = <T extends z.ZodRawShape>(shape: T) => z.object({ token: z.string().min(10).max(200), ...shape });

export const adminRevealPaymentToken = createServerFn({ method: "POST" })
  .inputValidator((d) => withAdmin({ password: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { data: accessToken, error } = await supabaseAdmin.rpc("payment_vault_reveal", { p_password: data.password });
    if (error) throw new Error("Senha do cofre incorreta.");
    return { accessToken: (accessToken as string | null) ?? "" };
  });

export const adminSavePaymentToken = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    withAdmin({
      password: z.string().min(1).max(100),
      environment: z.enum(["test", "production"]),
      accessToken: z.string().trim().max(500),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { error } = await supabaseAdmin.rpc("payment_vault_save", {
      p_password: data.password,
      p_environment: data.environment,
      p_access_token: data.accessToken,
    });
    if (error) throw new Error(error.message.includes("Token incompatível") ? "Token incompatível com o ambiente escolhido." : "Senha do cofre incorreta ou dados inválidos.");
    return { ok: true };
  });

export const adminSetPaymentVaultPassword = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    withAdmin({
      currentPassword: z.string().max(100).nullable(),
      newPassword: z.string().min(8).max(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const { error } = await supabaseAdmin.rpc("payment_vault_set_password", {
      p_current: data.currentPassword ?? "",
      p_new: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
