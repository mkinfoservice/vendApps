import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, Printer } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  clearToken,
  decodeTokenPayload,
  getToken,
} from "@/features/admin/auth/auth";
import { usePrintStatus } from "@/features/admin/print/PrintContext";
import { APP_MODULES } from "@/config/modules";

function useBreadcrumbLabel(): string | null {
  const { pathname } = useLocation();
  if (pathname === "/app") return null;
  const match = APP_MODULES.find(
    (m) => pathname === m.route || pathname.startsWith(m.route + "/"),
  );
  return match?.label ?? null;
}

export function AppHeader() {
  const navigate = useNavigate();
  const breadcrumb = useBreadcrumbLabel();
  const { connected, printStation } = usePrintStatus();

  const payload = decodeTokenPayload(getToken());
  const username = payload?.sub ?? "Usuário";
  const initials = username.slice(0, 2).toUpperCase();

  function handleLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-sm"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mx-auto max-w-[1600px] px-4 h-14 flex items-center gap-3">
        {/* Logo + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link
            to="/app"
            className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-white text-xs font-black select-none">
              V
            </div>
            <span
              className="text-sm font-bold hidden sm:block"
              style={{ color: "var(--text)" }}
            >
              vendApps
            </span>
          </Link>

          {breadcrumb && (
            <>
              <ChevronRight
                size={14}
                className="shrink-0"
                style={{ color: "var(--border)" }}
              />
              <span
                className="text-sm font-semibold truncate"
                style={{ color: "var(--text)" }}
              >
                {breadcrumb}
              </span>
            </>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Print badge */}
          <Link
            to="/admin/print"
            title={
              printStation
                ? connected
                  ? "Estação de impressão ativa"
                  : "Estação offline"
                : connected
                  ? "Impressão conectada"
                  : "Impressão offline"
            }
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold select-none transition-opacity hover:opacity-80"
            style={{
              backgroundColor: printStation
                ? connected
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(239,68,68,0.10)"
                : "rgba(113,113,122,0.10)",
              color: printStation
                ? connected
                  ? "#10b981"
                  : "#f87171"
                : "var(--text-muted)",
            }}
          >
            {printStation ? (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: connected ? "#10b981" : "#f87171",
                  boxShadow: connected ? "0 0 6px #10b981" : "none",
                }}
              />
            ) : (
              <Printer size={12} className="shrink-0" />
            )}
            <span className="hidden sm:inline">
              {printStation
                ? connected
                  ? "Estação"
                  : "Offline"
                : "Impressão"}
            </span>
          </Link>

          <ThemeToggle />

          {/* User avatar */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 select-none"
            style={{ backgroundColor: "var(--brand)" }}
            title={username}
          >
            {initials}
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "rgba(239,68,68,0.1)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--text-muted)";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "transparent";
            }}
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
