import { create } from "zustand";
import { persist } from "zustand/middleware";

type SessionState = {
  customerToken: string | null;
  adminToken: string | null;
  lastPhone: string | null;
  setCustomerToken: (t: string | null) => void;
  setAdminToken: (t: string | null) => void;
  setLastPhone: (p: string | null) => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      customerToken: null,
      adminToken: null,
      lastPhone: null,
      setCustomerToken: (customerToken) => set({ customerToken }),
      setAdminToken: (adminToken) => set({ adminToken }),
      setLastPhone: (lastPhone) => set({ lastPhone }),
    }),
    { name: "adega-session", skipHydration: true },
  ),
);
