import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { fetchCustomer } from "@/features/admin/customers/api";
import { getCustomerLoyalty, adjustPoints, type LoyaltyTxnDto } from "@/features/customers/customersApi";
import { ArrowLeft, Pencil, Loader2, Phone, MapPin, FileText, ShoppingBag, Star, Plus, Minus } from "lucide-react";

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

function AdjustModal({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [pts, setPts] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () => adjustPoints(customerId, parseInt(pts), reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customer-loyalty", customerId] }); onClose(); },
    onError: (e: Error) => setErr(e.message),
  });
  const ok = !isNaN(parseInt(pts)) && parseInt(pts) !== 0 && reason.trim().length >= 3;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold">Ajuste manual de pontos</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Pontos (+acúmulo / −débito)</label>
            <input type="number" className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
              value={pts} onChange={e => setPts(e.target.value)} placeholder="ex: 100 ou -50" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Motivo *</label>
            <input className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full"
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">Cancelar</button>
          <button disabled={!ok || mut.isPending} onClick={() => mut.mutate()}
            className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 disabled:opacity-40 transition">
            {mut.isPending ? "..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showAdjust, setShowAdjust] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id!),
    enabled: !!id,
  });

  const { data: loyalty } = useQuery({
    queryKey: ["customer-loyalty", id],
    queryFn: () => getCustomerLoyalty(id!),
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
      {showAdjust && <AdjustModal customerId={id!} onClose={() => setShowAdjust(false)} />}
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

          {/* Fidelidade */}
          {loyalty && (
            <section className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <Star size={15} className="text-amber-400 fill-amber-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Fidelidade</h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-amber-600">{loyalty.pointsBalance.toLocaleString("pt-BR")} pts</span>
                  <button onClick={() => setShowAdjust(true)}
                    className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition">Ajuste</button>
                </div>
              </div>
              <div className="px-5 py-3 flex gap-6 text-sm border-b" style={{ borderColor: "var(--border)" }}>
                <div><p className="text-xs" style={{ color: "var(--text-muted)" }}>Compras PDV</p><p className="font-semibold">{loyalty.totalOrders}</p></div>
                <div><p className="text-xs" style={{ color: "var(--text-muted)" }}>Total gasto</p><p className="font-semibold">{formatCents(loyalty.totalSpentCents)}</p></div>
                <div><p className="text-xs" style={{ color: "var(--text-muted)" }}>Última compra</p><p className="font-semibold">{loyalty.lastOrderUtc ? formatDate(loyalty.lastOrderUtc) : "—"}</p></div>
              </div>
              {loyalty.transactions.length > 0 && (
                <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {loyalty.transactions.slice(0, 5).map((t: LoyaltyTxnDto) => (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${t.points > 0 ? "bg-green-100" : "bg-red-100"}`}>
                        {t.points > 0 ? <Plus size={12} className="text-green-600" /> : <Minus size={12} className="text-red-500" />}
                      </span>
                      <span className="flex-1 truncate text-xs" style={{ color: "var(--text)" }}>{t.description}</span>
                      <span className={`text-xs font-semibold ${t.points > 0 ? "text-green-700" : "text-red-600"}`}>
                        {t.points > 0 ? "+" : ""}{t.points}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
