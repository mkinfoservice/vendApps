import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { usePrintListener, type PrintOrderPayload } from "./usePrintListener";
import { OrderNotificationOverlay, type OrderNotif } from "@/features/admin/notifications/OrderNotificationOverlay";
import { loadSoundPrefs, playSound } from "@/features/admin/notifications/sounds";

// ── Print context ─────────────────────────────────────────────────────────────

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

// ── Provider ──────────────────────────────────────────────────────────────────

export function PrintProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<OrderNotif[]>([]);

  const handleNewOrder = useCallback((payload: PrintOrderPayload) => {
    const notif: OrderNotif = {
      id:            `${payload.orderId}-${Date.now()}`,
      orderPublicId: payload.publicId,
      customerName:  payload.customerName || "Cliente",
    };

    setNotifications((prev) => [...prev, notif]);

    const prefs = loadSoundPrefs();
    if (prefs.enabled) playSound(prefs.soundId, prefs.volume);
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const { connected, printStation, togglePrintStation } = usePrintListener(handleNewOrder);

  return (
    <PrintCtx.Provider value={{ connected, printStation, togglePrintStation }}>
      {children}
      <OrderNotificationOverlay notifications={notifications} onDismiss={dismiss} />
    </PrintCtx.Provider>
  );
}
