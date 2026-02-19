import { Phone, MessageCircle } from "lucide-react";
import type { DelivererStopDto } from "../types";
import { NavigationButtons } from "./NavigationButtons";

type Props = {
  stop: DelivererStopDto;
  routeId: string;
  onDelivered: () => void;
  onFailed: () => void;
  onSkipped: () => void;
  loading?: boolean;
};

export function NextStopCard({
  stop,
  routeId,
  onDelivered,
  onFailed,
  onSkipped,
  loading,
}: Props) {
  const phoneClean = stop.customerPhone.replace(/\D/g, "");

  return (
    <div className="rounded-2xl bg-zinc-900 border-2 border-amber-500/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-amber-400 uppercase">
          Proxima Parada
        </div>
        <div className="text-xs text-zinc-500">#{stop.sequence}</div>
      </div>

      <div>
        <div className="text-lg font-bold">{stop.customerName}</div>
        <div className="text-sm text-zinc-400">{stop.orderNumber}</div>
      </div>

      <div className="text-sm text-zinc-300">{stop.address}</div>

      {/* Contact buttons */}
      <div className="flex gap-2">
        {phoneClean && (
          <>
            <a
              href={`tel:${phoneClean}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
            >
              <Phone size={14} />
              Ligar
            </a>
            <a
              href={`https://wa.me/55${phoneClean}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
          </>
        )}
      </div>

      {/* Navigation */}
      <NavigationButtons routeId={routeId} />

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onDelivered}
          disabled={loading}
          className="flex-1 h-12 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-50"
        >
          Entregue
        </button>
        <button
          onClick={onFailed}
          disabled={loading}
          className="flex-1 h-12 rounded-xl bg-red-600 text-white font-bold text-sm disabled:opacity-50"
        >
          Falhou
        </button>
        <button
          onClick={onSkipped}
          disabled={loading}
          className="h-12 px-4 rounded-xl border border-zinc-600 text-zinc-300 font-semibold text-sm disabled:opacity-50"
        >
          Pular
        </button>
      </div>
    </div>
  );
}
