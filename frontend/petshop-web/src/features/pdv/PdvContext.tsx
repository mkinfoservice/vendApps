import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { CashSession, Sale } from "./api";
import { getCurrentSession, getSale } from "./api";

interface PdvState {
  session: CashSession | null;
  sale: Sale | null;
  loading: boolean;
}

interface PdvContextValue extends PdvState {
  refreshSession: () => Promise<void>;
  refreshSale: (saleId: string) => Promise<void>;
  setSale: (sale: Sale | null) => void;
  setSession: (session: CashSession | null) => void;
}

const PdvContext = createContext<PdvContextValue | null>(null);

export function PdvProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CashSession | null>(null);
  const [sale, setSale]       = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getCurrentSession();
      setSession(s);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSale = useCallback(async (saleId: string) => {
    const s = await getSale(saleId);
    setSale(s);
  }, []);

  return (
    <PdvContext.Provider
      value={{ session, sale, loading, refreshSession, refreshSale, setSale, setSession }}
    >
      {children}
    </PdvContext.Provider>
  );
}

export function usePdv(): PdvContextValue {
  const ctx = useContext(PdvContext);
  if (!ctx) throw new Error("usePdv must be used inside PdvProvider");
  return ctx;
}
