import { useEffect, useState } from "react";
import { useCart } from "./cart";
import { useSession } from "./session";

let hydrated = false;
const listeners = new Set<() => void>();

export async function hydrateStores() {
  if (hydrated) return;
  await Promise.all([useCart.persist.rehydrate(), useSession.persist.rehydrate()]);
  hydrated = true;
  listeners.forEach((l) => l());
}

/** true depois que carrinho e sessão foram lidos do aparelho (evita divergência com o servidor). */
export function useHydrated() {
  const [h, setH] = useState(hydrated);
  useEffect(() => {
    if (hydrated) {
      setH(true);
      return;
    }
    const l = () => setH(true);
    listeners.add(l);
    void hydrateStores();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return h;
}
