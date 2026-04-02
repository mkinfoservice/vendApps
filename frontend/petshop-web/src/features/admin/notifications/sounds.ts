export type SoundId = "ding" | "duplo" | "alerta" | "suave" | "chamada";

export const SOUND_LABELS: Record<SoundId, string> = {
  ding:    "Ding",
  duplo:   "Duplo",
  alerta:  "Alerta",
  suave:   "Suave",
  chamada: "Chamada",
};

export const SOUND_IDS: SoundId[] = ["ding", "duplo", "alerta", "suave", "chamada"];

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === "closed") ctx = new AudioContext();
  return ctx;
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  vol: number,
  type: OscillatorType = "sine",
) {
  const osc  = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + duration);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.05);
}

export function playSound(id: SoundId, volume: number) {
  try {
    const ac = getCtx();
    if (ac.state === "suspended") ac.resume();
    const v = Math.max(0.001, Math.min(1, volume));

    switch (id) {
      case "ding":
        tone(ac, 880, 0,    0.7, v);
        break;
      case "duplo":
        tone(ac, 880, 0,    0.25, v);
        tone(ac, 1100, 0.3, 0.35, v);
        break;
      case "alerta":
        tone(ac, 660, 0,    0.1, v, "square");
        tone(ac, 660, 0.15, 0.1, v, "square");
        tone(ac, 880, 0.3,  0.2, v, "square");
        break;
      case "suave":
        tone(ac, 528, 0, 1.2, v * 0.6);
        break;
      case "chamada":
        tone(ac, 523, 0,    0.15, v);
        tone(ac, 659, 0.18, 0.15, v);
        tone(ac, 784, 0.36, 0.3,  v);
        break;
    }
  } catch {
    // ignore — browser pode bloquear sem interação do usuário
  }
}

// ── Prefs ────────────────────────────────────────────────────────────────────

export type SoundPrefs = {
  enabled: boolean;
  soundId: SoundId;
  volume: number; // 0-1
};

const SOUND_PREFS_KEY = "vapp:notif-sound";

export const DEFAULT_SOUND_PREFS: SoundPrefs = {
  enabled: true,
  soundId: "ding",
  volume:  0.6,
};

export function loadSoundPrefs(): SoundPrefs {
  try {
    const raw = localStorage.getItem(SOUND_PREFS_KEY);
    return raw ? { ...DEFAULT_SOUND_PREFS, ...JSON.parse(raw) } : DEFAULT_SOUND_PREFS;
  } catch {
    return DEFAULT_SOUND_PREFS;
  }
}

export function saveSoundPrefs(prefs: SoundPrefs) {
  localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(prefs));
}
