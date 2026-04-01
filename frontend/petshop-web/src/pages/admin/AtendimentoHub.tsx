import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Coffee, Phone, Users, UserPlus, ClipboardList, ArrowRight } from "lucide-react";

const GC = { bg: "#FAF7F2", cream: "#F5EDE0", brown: "#6B4F3A", dark: "#1C1209", caramel: "#C8953A" };

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
    iconColor: GC.caramel,
    iconBg: "rgba(200,149,58,0.14)",
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
    iconColor: GC.brown,
    iconBg: "rgba(107,79,58,0.14)",
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
        background: `linear-gradient(135deg, ${GC.dark} 0%, #3D2314 100%)`,
        boxShadow: "0 4px 24px rgba(28,18,9,0.35)",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(28,18,9,0.5)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(28,18,9,0.35)";
      }}
    >
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: `rgba(200,149,58,0.25)` }}>
        <Icon size={28} style={{ color: GC.caramel }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-lg font-bold text-white">{item.label}</p>
        <p className="text-sm mt-0.5" style={{ color: "rgba(245,237,224,0.7)" }}>{item.description}</p>
      </div>
      <ArrowRight
        size={20}
        className="shrink-0 transition-transform group-hover:translate-x-1"
        style={{ color: `rgba(200,149,58,0.6)` }}
      />
    </Link>
  );
}

function ActionCard({ item }: { item: HubItem }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="group flex items-center gap-4 rounded-2xl border p-5 transition-all hover:-translate-y-0.5 active:scale-[0.99]"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,149,58,0.35)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(200,149,58,0.1)";
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
