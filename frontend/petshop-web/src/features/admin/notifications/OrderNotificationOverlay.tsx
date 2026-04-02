import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ShoppingBag, Volume2, VolumeX, Settings } from "lucide-react";
import {
  playSound, loadSoundPrefs, saveSoundPrefs,
  SOUND_IDS, SOUND_LABELS,
  type SoundPrefs, type SoundId,
} from "./sounds";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrderNotif = {
  id: string;
  orderPublicId: string;
  customerName: string;
};

const DISMISS_MS = 8000;

// ── Single Toast ──────────────────────────────────────────────────────────────

function OrderToast({
  notif,
  onDismiss,
}: {
  notif: OrderNotif;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / DISMISS_MS) * 100);
      setProgress(pct);
      if (pct > 0) rafRef.current = requestAnimationFrame(tick);
      else onDismiss(notif.id);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [notif.id, onDismiss]);

  return (
    <div
      className="w-80 rounded-2xl border shadow-lg overflow-hidden animate-slide-in-right"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: "linear-gradient(135deg, #C8953A22, #A0723022)" }}
      >
        <ShoppingBag size={14} style={{ color: "#C8953A" }} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1" style={{ color: "#C8953A" }}>
          Novo pedido
        </span>
        <button
          type="button"
          onClick={() => onDismiss(notif.id)}
          className="w-5 h-5 flex items-center justify-center rounded-full transition hover:bg-black/10"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          {notif.customerName}
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Pedido <span className="font-bold">#{notif.orderPublicId}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            onDismiss(notif.id);
            navigate(`/app/pedidos/${notif.orderPublicId}`);
          }}
          className="w-full h-8 rounded-xl text-xs font-semibold text-white transition hover:brightness-110 active:scale-95"
          style={{ background: "linear-gradient(135deg, #C8953A, #A07230)" }}
        >
          Ver pedido →
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full" style={{ backgroundColor: "var(--border)" }}>
        <div
          className="h-full transition-none"
          style={{ width: `${progress}%`, backgroundColor: "#C8953A" }}
        />
      </div>
    </div>
  );
}

// ── Sound Settings Panel ──────────────────────────────────────────────────────

function SoundSettingsPanel({
  prefs,
  onChange,
  onClose,
}: {
  prefs: SoundPrefs;
  onChange: (p: SoundPrefs) => void;
  onClose: () => void;
}) {
  function set(partial: Partial<SoundPrefs>) {
    const next = { ...prefs, ...partial };
    onChange(next);
    saveSoundPrefs(next);
  }

  return (
    <div
      className="w-72 rounded-2xl border shadow-xl p-4 space-y-4 animate-slide-in-right"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
          Som das notificações
        </span>
        <button type="button" onClick={onClose}>
          <X size={14} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {/* Mute toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {prefs.enabled
            ? <Volume2 size={15} style={{ color: "var(--text-muted)" }} />
            : <VolumeX size={15} style={{ color: "var(--text-muted)" }} />}
          <span className="text-sm" style={{ color: "var(--text)" }}>
            {prefs.enabled ? "Som ativado" : "Mutado"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => set({ enabled: !prefs.enabled })}
          className={`relative w-10 h-5.5 rounded-full transition-colors`}
          style={{
            width: 40, height: 22,
            backgroundColor: prefs.enabled ? "#C8953A" : "var(--border)",
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform"
            style={{
              width: 18, height: 18,
              transform: prefs.enabled ? "translateX(18px)" : "translateX(0)",
            }}
          />
        </button>
      </div>

      {/* Volume */}
      {prefs.enabled && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Volume</span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{Math.round(prefs.volume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={prefs.volume}
            onChange={(e) => set({ volume: parseFloat(e.target.value) })}
            className="w-full accent-[#C8953A]"
          />
        </div>
      )}

      {/* Sound picker */}
      {prefs.enabled && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Som</span>
          <div className="grid grid-cols-5 gap-1.5">
            {SOUND_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  set({ soundId: id as SoundId });
                  playSound(id as SoundId, prefs.volume);
                }}
                className="h-8 rounded-xl text-xs font-semibold transition border"
                style={{
                  backgroundColor: prefs.soundId === id ? "#C8953A" : "var(--surface-2)",
                  color:           prefs.soundId === id ? "#fff"    : "var(--text-muted)",
                  borderColor:     prefs.soundId === id ? "#C8953A" : "var(--border)",
                }}
              >
                {SOUND_LABELS[id as SoundId]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overlay ───────────────────────────────────────────────────────────────────

export function OrderNotificationOverlay({
  notifications,
  onDismiss,
}: {
  notifications: OrderNotif[];
  onDismiss: (id: string) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<SoundPrefs>(loadSoundPrefs);

  return (
    <div
      className="fixed bottom-5 right-5 z-[9999] flex flex-col-reverse gap-2.5 items-end"
      style={{ pointerEvents: notifications.length === 0 && !showSettings ? "none" : "auto" }}
    >
      {/* Sound settings panel (shown above toasts) */}
      {showSettings && (
        <SoundSettingsPanel
          prefs={prefs}
          onChange={setPrefs}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Toasts */}
      {notifications.map((n) => (
        <OrderToast key={n.id} notif={n} onDismiss={onDismiss} />
      ))}

      {/* Persistent sound settings button — visible whenever there are toasts */}
      {notifications.length > 0 && !showSettings && (
        <button
          type="button"
          title="Configurar som"
          onClick={() => setShowSettings(true)}
          className="w-8 h-8 rounded-full flex items-center justify-center border shadow transition hover:scale-105"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {prefs.enabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>
      )}

      {/* Always-visible mini bell to open sound settings when no toasts */}
      {notifications.length === 0 && (
        <button
          type="button"
          title="Configurar som das notificações"
          onClick={() => setShowSettings((v) => !v)}
          className="w-7 h-7 rounded-full flex items-center justify-center border transition opacity-30 hover:opacity-80"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
            pointerEvents: "auto",
          }}
        >
          <Settings size={11} />
        </button>
      )}
    </div>
  );
}
