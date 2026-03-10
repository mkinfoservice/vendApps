import { createContext, useContext, useState, type ReactNode } from "react";
import { usePrintListener } from "./usePrintListener";

type PrintStatus = { connected: boolean };

const PrintCtx = createContext<PrintStatus>({ connected: false });

export function usePrintStatus() {
  return useContext(PrintCtx);
}

export function PrintProvider({ children }: { children: ReactNode }) {
  const { connected } = usePrintListener();
  return <PrintCtx.Provider value={{ connected }}>{children}</PrintCtx.Provider>;
}
