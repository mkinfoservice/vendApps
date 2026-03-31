import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Coffee, LogOut, Printer } from "lucide-react";
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
      className="sticky top-0 z-40 border-b"
      style={{ backgroundColor: "#1C1209", borderColor: "rgba(200,149,58,0.2)" }}
    >
      <div className="mx-auto max-w-[1600px] px-4 h-14 flex items-center gap-3">
        {/* Logo + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link
            to="/app"
            className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #C8953A, #A07230)" }}>
              <Coffee size={14} className="text-white" />
            </div>
            <span className="text-sm font-black hidden sm:block" style={{ color: "#C8953A" }}>
              vendApps
            </span>
          </Link>

          {breadcrumb && (
            <>
              <ChevronRight size={14} className="shrink-0" style={{ color: "rgba(200,149,58,0.4)" }} />
              <span className="text-sm font-semibold truncate" style={{ color: "rgba(245,237,224,0.85)" }}>
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
                ? connected ? "Estação de impressão ativa" : "Estação offline"
                : connected ? "Impressão conectada" : "Impressão offline"
            }
            className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold select-none transition-opacity hover:opacity-80"
            style={{
              backgroundColor: printStation
                ? connected ? "rgba(16,185,129,0.18)" : "rgba(239,68,68,0.15)"
                : "rgba(255,255,255,0.08)",
              color: printStation
                ? connected ? "#34d399" : "#f87171"
                : "rgba(245,237,224,0.45)",
            }}
          >
            {printStation ? (
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: connected ? "#34d399" : "#f87171",
                         boxShadow: connected ? "0 0 6px #34d399" : "none" }} />
            ) : (
              <Printer size={12} className="shrink-0" />
            )}
            <span className="hidden sm:inline">
              {printStation ? (connected ? "Estação" : "Offline") : "Impressão"}
            </span>
          </Link>

          <ThemeToggle />

          {/* User avatar */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 select-none"
            style={{ background: "linear-gradient(135deg, #C8953A, #A07230)", color: "#fff" }}
            title={username}
          >
            {initials}
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "rgba(245,237,224,0.4)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(245,237,224,0.4)";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
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
