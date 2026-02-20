import { useNavigate } from "react-router-dom";
import { AdminNav } from "@/components/admin/AdminNav";
import { useDashboard } from "@/features/admin/dashboard/queries";
import type { ReactNode } from "react";

// ── Color tokens ─────────────────────────────────────────────────────────────

type IconColor = "green" | "amber" | "red" | "blue" | "purple" | "zinc";

const ACCENT: Record<IconColor, string> = {
  green:  "#10b981",
  amber:  "#f59e0b",
  red:    "#ef4444",
  blue:   "#3b82f6",
  purple: "#7c5cf8",
  zinc:   "#71717a",
};

const HOVER_BG: Record<IconColor, string> = {
  green:  "rgba(16,185,129,0.07)",
  amber:  "rgba(245,158,11,0.07)",
  red:    "rgba(239,68,68,0.07)",
  blue:   "rgba(59,130,246,0.07)",
  purple: "rgba(124,92,248,0.07)",
  zinc:   "rgba(113,113,122,0.05)",
};

const HOVER_BORDER: Record<IconColor, string> = {
  green:  "rgba(16,185,129,0.55)",
  amber:  "rgba(245,158,11,0.55)",
  red:    "rgba(239,68,68,0.55)",
  blue:   "rgba(59,130,246,0.55)",
  purple: "rgba(124,92,248,0.55)",
  zinc:   "rgba(113,113,122,0.35)",
};

const GLOW: Record<IconColor, string> = {
  green:  "0 0 28px rgba(16,185,129,0.22)",
  amber:  "0 0 28px rgba(245,158,11,0.22)",
  red:    "0 0 28px rgba(239,68,68,0.22)",
  blue:   "0 0 28px rgba(59,130,246,0.22)",
  purple: "0 0 28px rgba(124,92,248,0.22)",
  zinc:   "0 0 20px rgba(113,113,122,0.12)",
};

const ICON_BG: Record<IconColor, string> = {
  green:  "bg-emerald-500/15 text-emerald-400",
  amber:  "bg-amber-500/15 text-amber-400",
  red:    "bg-red-500/15 text-red-400",
  blue:   "bg-blue-500/15 text-blue-400",
  purple: "bg-purple-500/15 text-purple-400",
  zinc:   "bg-zinc-700/30 text-zinc-400",
};

const LABEL_COLOR: Record<IconColor, string> = {
  green:  "text-emerald-400",
  amber:  "text-amber-400",
  red:    "text-red-400",
  blue:   "text-blue-400",
  purple: "text-purple-400",
  zinc:   "text-zinc-400",
};

const VALUE_COLOR: Record<IconColor, string> = {
  green:  "text-emerald-300",
  amber:  "text-amber-300",
  red:    "text-red-300",
  blue:   "text-blue-300",
  purple: "text-purple-300",
  zinc:   "text-zinc-100",
};

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color = "zinc",
  onClick,
}: {
  label: string;
  value: number | undefined;
  icon: string;
  color?: IconColor;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  const clickable = !!onClick;

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "rounded-2xl border text-left transition-all duration-200 overflow-hidden",
        clickable ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        borderTopWidth: "3px",
        borderTopColor: ACCENT[color],
      }}
      onMouseEnter={
        clickable
          ? (e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = HOVER_BG[color];
              el.style.borderColor = HOVER_BORDER[color];
              el.style.borderTopColor = ACCENT[color];
              el.style.boxShadow = GLOW[color];
              el.style.transform = "translateY(-2px)";
            }
          : undefined
      }
      onMouseLeave={
        clickable
          ? (e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = "var(--surface)";
              el.style.borderColor = "var(--border)";
              el.style.borderTopColor = ACCENT[color];
              el.style.boxShadow = "none";
              el.style.transform = "translateY(0)";
            }
          : undefined
      }
    >
      <div className="p-4">
        {/* Label — colored, uppercase, prominent */}
        <div className={`text-[11px] font-bold uppercase tracking-[0.1em] mb-3 ${LABEL_COLOR[color]}`}>
          {label}
        </div>

        {/* Value + Icon row */}
        <div className="flex items-end justify-between gap-2">
          <div className={`text-4xl font-extrabold tabular-nums leading-none ${VALUE_COLOR[color]}`}>
            {value ?? "—"}
          </div>
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${ICON_BG[color]}`}
          >
            {icon}
          </div>
        </div>
      </div>

      {/* Bottom accent strip (subtle) */}
      {clickable && (
        <div
          className="h-0.5 w-full opacity-30"
          style={{ backgroundColor: ACCENT[color] }}
        />
      )}
    </Tag>
  );
}

// ── Section Title ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-[11px] font-bold uppercase tracking-[0.14em] pt-7 pb-2 flex items-center gap-2"
      style={{ color: "var(--text-muted)" }}
    >
      <span className="h-px flex-1 opacity-30" style={{ backgroundColor: "var(--border)" }} />
      {children}
      <span className="h-px flex-1 opacity-30" style={{ backgroundColor: "var(--border)" }} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading, isError, dataUpdatedAt } = useDashboard();

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />

      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              Dashboard
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Visão operacional em tempo real
            </p>
          </div>
          {lastUpdated && (
            <span className="text-xs mt-1 shrink-0" style={{ color: "var(--text-muted)" }}>
              Atualizado às {lastUpdated}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="py-10 text-sm" style={{ color: "var(--text-muted)" }}>
            Carregando dados…
          </div>
        )}

        {isError && (
          <div className="mt-4 rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
            Erro ao carregar dashboard. Tente recarregar a página.
          </div>
        )}

        {data && (
          <>
            {/* ── Pedidos ─────────────────────────── */}
            <SectionTitle>Pedidos</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                icon="📥"
                label="Recebidos"
                value={data.orders.recebido}
                color="blue"
                onClick={() => navigate("/admin/orders?status=RECEBIDO")}
              />
              <StatCard
                icon="🍳"
                label="Em preparo"
                value={data.orders.emPreparo}
                color="amber"
                onClick={() => navigate("/admin/orders?status=EM_PREPARO")}
              />
              <StatCard
                icon="📦"
                label="Prontos p/ entrega"
                value={data.orders.prontoParaEntrega}
                color="purple"
                onClick={() => navigate("/admin/orders?status=PRONTO_PARA_ENTREGA")}
              />
              <StatCard
                icon="🚴"
                label="Saiu p/ entrega"
                value={data.orders.saiuParaEntrega}
                color="amber"
                onClick={() => navigate("/admin/orders?status=SAIU_PARA_ENTREGA")}
              />
              <StatCard
                icon="✅"
                label="Entregues"
                value={data.orders.entregue}
                color="green"
                onClick={() => navigate("/admin/orders?status=ENTREGUE")}
              />
              <StatCard
                icon="❌"
                label="Cancelados"
                value={data.orders.cancelado}
                color="red"
                onClick={() => navigate("/admin/orders?status=CANCELADO")}
              />
            </div>

            {/* ── Geocodificação ───────────────────── */}
            <SectionTitle>Prontos — geocodificação</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon="📍"
                label="Com coordenadas"
                value={data.readyOrdersWithCoords}
                color="green"
              />
              <StatCard
                icon="⚠️"
                label="Sem coordenadas"
                value={data.readyOrdersWithoutCoords}
                color={data.readyOrdersWithoutCoords > 0 ? "red" : "zinc"}
              />
            </div>

            {/* ── Rotas ───────────────────────────── */}
            <SectionTitle>Rotas</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                icon="🆕"
                label="Criadas"
                value={data.routes.criada}
                color="zinc"
                onClick={() => navigate("/admin/routes?status=Criada")}
              />
              <StatCard
                icon="📋"
                label="Atribuídas"
                value={data.routes.atribuida}
                color="blue"
                onClick={() => navigate("/admin/routes?status=Atribuida")}
              />
              <StatCard
                icon="▶️"
                label="Em andamento"
                value={data.routes.emAndamento}
                color="amber"
                onClick={() => navigate("/admin/routes?status=EmAndamento")}
              />
              <StatCard
                icon="🏁"
                label="Concluídas"
                value={data.routes.concluida}
                color="green"
                onClick={() => navigate("/admin/routes?status=Concluida")}
              />
              <StatCard
                icon="🚫"
                label="Canceladas"
                value={data.routes.cancelada}
                color="red"
                onClick={() => navigate("/admin/routes?status=Cancelada")}
              />
            </div>

            {/* ── Entregadores ─────────────────────── */}
            <SectionTitle>Entregadores</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon="👥"
                label="Total cadastrado"
                value={data.deliverers.total}
                color="zinc"
              />
              <StatCard
                icon="🟢"
                label="Ativos"
                value={data.deliverers.active}
                color="green"
              />
              <StatCard
                icon="🛵"
                label="Com rota ativa"
                value={data.deliverers.withActiveRoute}
                color="amber"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
