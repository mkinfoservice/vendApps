import { ShieldCheck, Truck, RefreshCw, Lock, Award } from "lucide-react";

const BADGES = [
  { icon: ShieldCheck, label: "Compra segura" },
  { icon: Lock,        label: "Dados protegidos" },
  { icon: Truck,       label: "Entrega rápida" },
  { icon: RefreshCw,   label: "Troca fácil" },
  { icon: Award,       label: "Loja oficial" },
];

export function TrustBar() {
  return (
    <div className="mt-5 flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
      {BADGES.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl border border-[var(--border)] hover:-translate-y-0.5 transition-all duration-200 cursor-default"
          style={{ background: "var(--surface-2)" }}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--brand)" }} />
          <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
