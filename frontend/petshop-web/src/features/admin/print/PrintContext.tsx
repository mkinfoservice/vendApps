import { createContext, useContext, type ReactNode } from "react";
import { usePrintListener } from "./usePrintListener";

type PrintStatus = {
  connected: boolean;
  printStation: boolean;
  togglePrintStation: () => void;
};

const PrintCtx = createContext<PrintStatus>({
  connected: false,
  printStation: false,
  togglePrintStation: () => {},
});

export function usePrintStatus() {
  return useContext(PrintCtx);
}

export function PrintProvider({ children }: { children: ReactNode }) {
  const { connected, printStation, togglePrintStation } = usePrintListener();
  return (
    <PrintCtx.Provider value={{ connected, printStation, togglePrintStation }}>
      {children}
    </PrintCtx.Provider>
  );
}
