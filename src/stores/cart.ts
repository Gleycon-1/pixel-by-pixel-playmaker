import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = { productId: string; name: string; priceCents: number; imageUrl: string | null; qty: number };

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const found = s.items.find((i) => i.productId === item.productId);
          if (found)
            return { items: s.items.map((i) => (i.productId === item.productId ? { ...i, qty: Math.min(99, i.qty + qty) } : i)) };
          return { items: [...s.items, { ...item, qty }] };
        }),
      setQty: (productId, qty) =>
        set((s) => ({
          items: qty <= 0 ? s.items.filter((i) => i.productId !== productId) : s.items.map((i) => (i.productId === productId ? { ...i, qty: Math.min(99, qty) } : i)),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
      replace: (items) => set({ items }),
    }),
    { name: "adega-cart", skipHydration: true },
  ),
);

export function cartTotals(items: CartItem[]) {
  return {
    count: items.reduce((a, i) => a + i.qty, 0),
    subtotalCents: items.reduce((a, i) => a + i.qty * i.priceCents, 0),
  };
}
