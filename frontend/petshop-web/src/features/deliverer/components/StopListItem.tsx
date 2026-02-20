import { Check, X, SkipForward, Clock, ArrowRight } from "lucide-react";
import type { DelivererStopDto } from "../types";

type Props = {
  stop: DelivererStopDto;
  isNext: boolean;
};

const STATUS_CONFIG: Record<
  string,
  { Icon: typeof Check; iconColor: string; iconBg: string; badge: string; label: string }
> = {
  Entregue: {
    Icon: Check,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/20",
    badge: "bg-emerald-500/20 text-emerald-400",
    label: "Entregue",
  },
  Falhou: {
    Icon: X,
    iconColor: "text-red-400",
    iconBg: "bg-red-500/20",
    badge: "bg-red-500/20 text-red-400",
    label: "Falhou",
  },
  Ignorada: {
    Icon: SkipForward,
    iconColor: "text-zinc-400",
    iconBg: "bg-zinc-700/40",
    badge: "bg-zinc-700/40 text-zinc-400",
    label: "Pulada",
  },
  Proxima: {
    Icon: ArrowRight,
    iconColor: "text-[#9b7efa]",
    iconBg: "bg-[#7c5cf8]/20",
    badge: "bg-[#7c5cf8]/20 text-[#9b7efa]",
    label: "Agora",
  },
  Pendente: {
    Icon: Clock,
    iconColor: "text-zinc-500",
    iconBg: "bg-zinc-700/30",
    badge: "bg-zinc-700/30 text-zinc-500",
    label: "Pendente",
  },
};

export function StopListItem({ stop, isNext }: Props) {
  const cfg = STATUS_CONFIG[stop.status] ?? STATUS_CONFIG.Pendente;
  const Icon = cfg.Icon;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3"
      style={
        isNext
          ? { backgroundColor: "rgba(124,92,248,0.08)", borderLeft: "3px solid #7c5cf8" }
          : undefined
      }
    >
      {/* Status icon */}
      <div
        className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cfg.iconBg}`}
      >
        <Icon size={13} className={cfg.iconColor} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
            #{stop.sequence}
          </span>
          <span className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
            {stop.customerName}
          </span>
          <span className={`text-[11px] font-semibold ml-auto shrink-0 px-2 py-0.5 rounded-full ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
          {stop.address}
        </div>
        {stop.failureReason && (
          <div className="text-xs mt-0.5 text-red-400">{stop.failureReason}</div>
        )}
      </div>
    </div>
  );
}
