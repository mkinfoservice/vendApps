import { Check, X, SkipForward, Clock, ArrowRight } from "lucide-react";
import type { DelivererStopDto } from "../types";

type Props = {
  stop: DelivererStopDto;
  isNext: boolean;
};

const statusConfig: Record<
  string,
  { icon: typeof Check; color: string; bg: string; label: string }
> = {
  Entregue: {
    icon: Check,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    label: "Entregue",
  },
  Falhou: {
    icon: X,
    color: "text-red-400",
    bg: "bg-red-500/20",
    label: "Falhou",
  },
  Ignorada: {
    icon: SkipForward,
    color: "text-zinc-400",
    bg: "bg-zinc-500/20",
    label: "Pulada",
  },
  Proxima: {
    icon: ArrowRight,
    color: "text-amber-400",
    bg: "bg-amber-500/20",
    label: "Agora",
  },
  Pendente: {
    icon: Clock,
    color: "text-zinc-500",
    bg: "bg-zinc-800",
    label: "Pendente",
  },
};

export function StopListItem({ stop, isNext }: Props) {
  const cfg = statusConfig[stop.status] ?? statusConfig.Pendente;
  const Icon = cfg.icon;

  return (
    <div
      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${
        isNext ? "bg-amber-500/10 border border-amber-500/30" : ""
      }`}
    >
      <div
        className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}
      >
        <Icon size={14} className={cfg.color} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">#{stop.sequence}</span>
          <span className="font-semibold text-sm truncate">
            {stop.customerName}
          </span>
          <span className={`text-xs font-medium ml-auto shrink-0 ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
        <div className="text-xs text-zinc-500 truncate">{stop.address}</div>
        {stop.failureReason && (
          <div className="text-xs text-red-400 mt-0.5">
            {stop.failureReason}
          </div>
        )}
      </div>
    </div>
  );
}
