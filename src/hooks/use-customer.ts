import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getMe } from "@/lib/customer.functions";
import { useSession } from "@/stores/session";
import { useHydrated } from "@/stores/hydration";

export function useMe() {
  const hydrated = useHydrated();
  const token = useSession((s) => s.customerToken);
  const setToken = useSession((s) => s.setCustomerToken);
  const q = useQuery({
    queryKey: ["me", token],
    queryFn: () => getMe({ data: { token: token! } }),
    enabled: hydrated && !!token,
    retry: false,
  });
  useEffect(() => {
    if (q.error && /Sess|login/i.test((q.error as Error).message)) setToken(null);
  }, [q.error, setToken]);
  return { ...q, token, hydrated, loggedIn: hydrated && !!token };
}
