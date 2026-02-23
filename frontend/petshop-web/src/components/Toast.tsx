import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";

type ToastItem = { id: number; message: string };
type ToastContextType = { showToast: (message: string) => void };

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-20 left-0 right-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-sm font-semibold max-w-sm w-full"
            style={{ animation: "toast-slide-in 0.25s ease-out" }}
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#7c5cf8" }} />
            <span className="line-clamp-2">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
