import { useNavigate } from "react-router-dom";
import { AdminNav } from "@/components/admin/AdminNav";
import { Phone, Users, UserPlus, ClipboardList } from "lucide-react";

type HubItem = {
  icon: React.ReactNode;
  label: string;
  description: string;
  to: string;
  highlight?: boolean;
};

const items: HubItem[] = [
  {
    icon: <Phone size={28} />,
    label: "Montar pedido",
    description: "Atendimento por telefone — busca cliente, monta carrinho e confirma.",
    to: "/admin/atendimento/pedido",
    highlight: true,
  },
  {
    icon: <Users size={28} />,
    label: "Clientes",
    description: "Lista e busca de clientes cadastrados.",
    to: "/admin/atendimento/clientes",
  },
  {
    icon: <UserPlus size={28} />,
    label: "Novo cliente",
    description: "Cadastrar um novo cliente na base.",
    to: "/admin/atendimento/clientes/novo",
  },
  {
    icon: <ClipboardList size={28} />,
    label: "Todos os pedidos",
    description: "Histórico completo de pedidos da loja.",
    to: "/admin/orders",
  },
];

export default function AtendimentoHub() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text)" }}>Atendimento</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Central de atendimento ao cliente — pedidos telefônicos e cadastros.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map(item => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className={`text-left rounded-2xl border p-5 hover:brightness-105 active:scale-[0.99] transition flex items-start gap-4 ${
                item.highlight ? "bg-brand text-white border-brand" : ""
              }`}
              style={
                item.highlight
                  ? {}
                  : { borderColor: "var(--border)", backgroundColor: "var(--surface)" }
              }
            >
              <div className={item.highlight ? "text-white" : undefined} style={item.highlight ? {} : { color: "var(--brand, #7c5cf8)" }}>
                {item.icon}
              </div>
              <div>
                <p className={`font-bold text-sm ${item.highlight ? "text-white" : ""}`} style={item.highlight ? {} : { color: "var(--text)" }}>
                  {item.label}
                </p>
                <p className={`text-xs mt-1 ${item.highlight ? "text-white/80" : ""}`} style={item.highlight ? {} : { color: "var(--text-muted)" }}>
                  {item.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
