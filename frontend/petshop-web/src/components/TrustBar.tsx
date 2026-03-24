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
    <div className="mt-5 flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
      {BADGES.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl bg-white border border-gray-100 shadow-sm"
        >
          <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">{label}</span>
        </div>
      ))}
    </div>
  );
}
