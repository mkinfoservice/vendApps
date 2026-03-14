import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Phone, Users, UserPlus, ClipboardList, ArrowRight } from "lucide-react";

type HubItem = {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  description: string;
  to: string;
  highlight?: boolean;
};

const items: HubItem[] = [
  {
    icon: Phone,
    iconColor: "#ffffff",
    iconBg: "rgba(255,255,255,0.2)",
    label: "Montar pedido",
    description: "Atendimento por telefone — busca cliente, monta carrinho e confirma.",
    to: "/app/atendimento/pedido",
    highlight: true,
  },
  {
    icon: Users,
    iconColor: "#0ea5e9",
    iconBg: "rgba(14,165,233,0.12)",
    label: "Clientes",
    description: "Lista e busca de clientes cadastrados.",
    to: "/app/atendimento/clientes",
  },
  {
    icon: UserPlus,
    iconColor: "#10b981",
    iconBg: "rgba(16,185,129,0.12)",
    label: "Novo cliente",
    description: "Cadastrar um novo cliente na base.",
    to: "/app/atendimento/clientes/novo",
  },
  {
    icon: ClipboardList,
    iconColor: "#7c5cf8",
    iconBg: "rgba(124,92,248,0.12)",
    label: "Todos os pedidos",
    description: "Histórico completo de pedidos da loja.",
    to: "/app/pedidos",
  },
];

function HighlightCard({ item }: { item: HubItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="group flex items-center gap-5 rounded-2xl p-6 transition-all active:scale-[0.99] hover:-translate-y-0.5"
      style={{
        background: "linear-gradient(135deg, #7c5cf8 0%, #6d4df2 100%)",
        boxShadow: "0 4px 24px rgba(124,92,248,0.35)",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 8px 32px rgba(124,92,248,0.5)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 4px 24px rgba(124,92,248,0.35)";
      }}
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-white/20">
        <Icon size={28} color="#fff" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-lg font-bold text-white">{item.label}</p>
        <p className="text-sm mt-0.5 text-white/75">{item.description}</p>
      </div>
      <ArrowRight
        size={20}
        className="shrink-0 text-white/60 transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}

function ActionCard({ item }: { item: HubItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="group flex items-center gap-4 rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor =
          item.iconColor + "55";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${item.iconColor}18`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: item.iconBg }}
      >
        <Icon size={22} style={{ color: item.iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
          {item.label}
        </p>
        <p
          className="text-xs mt-0.5 leading-snug"
          style={{ color: "var(--text-muted)" }}
        >
          {item.description}
        </p>
      </div>
      <ArrowRight
        size={15}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "var(--text-muted)" }}
      />
    </Link>
  );
}

export default function AtendimentoHub() {
  const [highlight, ...rest] = items;

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
        <PageHeader
          title="Atendimento"
          subtitle="Central de atendimento ao cliente — pedidos e cadastros"
        />

        <div className="space-y-3">
          <HighlightCard item={highlight} />
          {rest.map((item) => (
            <ActionCard key={item.to} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
