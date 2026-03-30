import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import {
  useMarkAllSupplyAlertsRead,
  useMarkSupplyAlertRead,
  useSupplyAlerts,
} from "@/features/admin/supplies/queries";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const SESSION_KEY = "supply-alert-popup-seen-v1";

export function SupplyAlertsPopup() {
  const { role } = useCurrentUser();
  const enabled = role === "admin" || role === "gerente";
  const { data = [], isLoading } = useSupplyAlerts(enabled);
  const markOne = useMarkSupplyAlertRead();
  const markAll = useMarkAllSupplyAlertsRead();

  const shouldShow = useMemo(() => {
    if (isLoading || data.length === 0) return false;
    const seenRaw = sessionStorage.getItem(SESSION_KEY);
    if (!seenRaw) return true;
    try {
      const seenIds = new Set<string>(JSON.parse(seenRaw));
      return data.some((a) => !seenIds.has(a.id));
    } catch {
      return true;
    }
  }, [data, isLoading]);

  if (!shouldShow) return null;

  async function handleReadAll() {
    await markAll.mutateAsync();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.map((a) => a.id)));
  }

  async function handleDismissSessionOnly() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.map((a) => a.id)));
  }

  async function handleMarkOne(alertId: string) {
    await markOne.mutateAsync(alertId);
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/35 flex items-center justify-center px-4">
      <div
        className="w-full max-w-2xl rounded-2xl border p-5"
        style={{ backgroundColor: "var(--surface)", borderColor: "rgba(249,115,22,0.45)" }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(249,115,22,0.14)" }}>
            <TriangleAlert color="#f97316" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold" style={{ color: "var(--text)" }}>Insumos com estoque baixo</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Confirme os alertas para manter o painel atualizado.</p>
          </div>
        </div>

        <div className="mt-4 space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {data.map((a) => (
            <div key={a.id} className="rounded-xl border px-3 py-2 flex items-start gap-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{a.title}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{a.message}</p>
              </div>
              <button
                onClick={() => handleMarkOne(a.id)}
                className="text-xs px-2 py-1 rounded-lg border"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Confirmar
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handleDismissSessionOnly}
            className="px-3 py-2 text-sm rounded-lg border"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Lembrar depois
          </button>
          <button
            onClick={handleReadAll}
            className="px-3 py-2 text-sm rounded-lg text-white font-semibold"
            style={{ backgroundColor: "#f97316" }}
          >
            Confirmar todos
          </button>
        </div>
      </div>
    </div>
  );
}
