import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { fetchCustomer } from "@/features/admin/customers/api";
import { ArrowLeft, Pencil, Loader2, Phone, MapPin, FileText, ShoppingBag } from "lucide-react";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  RECEBIDO:    "Recebido",
  EM_PREPARO:  "Em preparo",
  SAIU:        "Saiu p/ entrega",
  ENTREGUE:    "Entregue",
  CANCELADO:   "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  RECEBIDO:    "bg-yellow-100 text-yellow-700",
  EM_PREPARO:  "bg-blue-100 text-blue-700",
  SAIU:        "bg-purple-100 text-purple-700",
  ENTREGUE:    "bg-green-100 text-green-700",
  CANCELADO:   "bg-red-100 text-red-700",
};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
        <AdminNav />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
        <AdminNav />
        <div className="flex items-center justify-center h-64 text-sm" style={{ color: "var(--text-muted)" }}>
          Cliente não encontrado.
        </div>
      </div>
    );
  }

  const fullAddress = [customer.address, customer.complement, customer.neighborhood, customer.city && `${customer.city}/${customer.state}`]
    .filter(Boolean).join(", ");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[--surface-2] transition"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              {customer.name}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Desde {formatDate(customer.createdAtUtc)}
            </p>
          </div>
          <button
            onClick={() => navigate(`/admin/atendimento/clientes/${id}/editar`)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold hover:bg-[--surface-2] transition"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            <Pencil size={14} />
            Editar
          </button>
        </div>

        <div className="space-y-4">
          {/* Contato */}
          <section className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Contato
            </h2>
            <Row icon={<Phone size={15} />} label="Telefone" value={customer.phone} />
            {customer.cpf && <Row icon={<FileText size={15} />} label="CPF" value={customer.cpf} />}
          </section>

          {/* Endereço */}
          {fullAddress && (
            <section className="rounded-2xl border p-5 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
              <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Endereço de entrega
              </h2>
              <Row icon={<MapPin size={15} />} label="Endereço" value={fullAddress} />
              {customer.cep && <Row icon={null} label="CEP" value={customer.cep} />}
              {customer.addressReference && <Row icon={null} label="Referência" value={customer.addressReference} />}
            </section>
          )}

          {/* Observações */}
          {customer.notes && (
            <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
              <h2 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                Observações
              </h2>
              <p className="text-sm" style={{ color: "var(--text)" }}>{customer.notes}</p>
            </section>
          )}

          {/* Histórico de pedidos */}
          <section className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
              <ShoppingBag size={15} style={{ color: "var(--text-muted)" }} />
              <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Últimos pedidos
              </h2>
            </div>
            {!customer.orders?.length ? (
              <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Nenhum pedido ainda.
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {customer.orders.map((o) => (
                  <li key={o.id}>
                    <button
                      onClick={() => navigate(`/admin/orders/${o.id}`)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[--surface-2] transition text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{o.publicId}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{formatDate(o.createdAtUtc)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                          {formatCents(o.totalCents)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }}>{icon}</span>}
      {!icon && <span className="w-[15px] shrink-0" />}
      <div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{value}</p>
      </div>
    </div>
  );
}
