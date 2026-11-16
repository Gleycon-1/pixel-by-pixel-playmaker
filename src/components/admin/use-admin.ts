import { useCallback } from "react";
import { toast } from "sonner";
import { useSession } from "@/stores/session";

/** Token do painel + tratamento de sessão expirada. */
export function useAdmin() {
  const token = useSession((s) => s.adminToken) ?? "";
  const setToken = useSession((s) => s.setAdminToken);
  const handleError = useCallback(
    (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("ADMIN_UNAUTHORIZED")) {
        setToken(null);
        toast.error("Sessão do painel expirou. Entre novamente.");
        return;
      }
      toast.error(msg);
    },
    [setToken],
  );
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const r = await fn();
        if (success) toast.success(success);
        return r;
      } catch (e) {
        handleError(e);
        return undefined;
      }
    },
    [handleError],
  );
  return { token, setToken, handleError, run };
}
