import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listCustomers } from "@/features/customers/customersApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Users, Search, ChevronRight, Pencil, Star, Eye, EyeOff, Clock3, ShieldAlert } from "lucide-react";

function fmtCpfMasked(cpf: string | null, show: boolean) {
  if (!show || !cpf) return "***.***.***-**";
  if (cpf.length === 11)
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  return cpf;
}

function fmtPhone(phone: string | null) {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function fmtDate(value: string | null) {
  if (!value) return "Sem pedidos";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { role } = useCurrentUser();
  const canSeeSensitive = role === "admin" || role === "master_admin";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCpf, setShowCpf] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", debouncedSearch, page, showCpf, canSeeSensitive],
    queryFn: () => listCustomers(page, debouncedSearch || undefined, 30, showCpf && canSeeSensitive),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pagePoints = useMemo(() => items.reduce((sum, c) => sum + (c.pointsBalance ?? 0), 0), [items]);
  const withHistory = useMemo(() => items.filter((c) => (c.totalOrders ?? 0) > 0).length, [items]);
  const totalPages = useMemo(() => (data ? Math.max(1, Math.ceil(data.total / 30)) : 1), [data]);

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-6 space-y-4">
        <PageHeader
          title="Consulta de Clientes"
          subtitle={isLoading ? "Carregando..." : `${total} cliente${total !== 1 ? "s" : ""}`}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard icon={<Users size={15} />} label="Clientes na página" value={String(items.length)} />
          <StatCard icon={<Clock3 size={15} />} label="Com histórico" value={String(withHistory)} />
          <StatCard icon={<Star size={15} />} label="Pontos carregados" value={String(pagePoints)} accent="amber" />
        </div>

        <div className="rounded-2xl border p-4 space-y-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
              <input
                className="h-11 w-full rounded-xl border pl-9 pr-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/30"
                style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                placeholder="Buscar por nome, CPF ou telefone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              type="button"
              disabled={!canSeeSensitive}
              onClick={() => canSeeSensitive && setShowCpf((v) => !v)}
              className="h-11 px-4 rounded-xl border text-sm font-semibold inline-flex items-center gap-2 transition-all disabled:opacity-60"
              style={{
                borderColor: showCpf ? "rgba(5,150,105,.35)" : "var(--border)",
                color: showCpf ? "#047857" : "var(--text-muted)",
                backgroundColor: showCpf ? "rgba(5,150,105,.08)" : "var(--surface-2)",
              }}
            >
              {showCpf ? <Eye size={15} /> : <EyeOff size={15} />}
              {showCpf ? "CPF visível" : "Exibir CPF"}
            </button>
          </div>

          {!canSeeSensitive && (
            <div className="rounded-xl px-3 py-2 text-xs flex items-start gap-2"
              style={{ border: "1px solid rgba(245,158,11,.35)", backgroundColor: "rgba(245,158,11,.08)", color: "#92400e" }}>
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <span>
                LGPD ativa: CPF completo disponível apenas para perfil admin/master. Atendimento consulta cliente sem expor dado sensível.
              </span>
            </div>
          )}
        </div>

        <div className="rounded-2xl border overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Contato</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>CPF</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden xl:table-cell" style={{ color: "var(--text-muted)" }}>Histórico</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Pontos</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableSkeleton rows={8} cols={6} />}

              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Users}
                      title="Nenhum cliente encontrado"
                      description={debouncedSearch ? "Tente ajustar a busca." : "Nenhum cliente cadastrado ainda."}
                    />
                  </td>
                </tr>
              )}

              {items.map((c, i) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/app/atendimento/clientes/${c.id}`)}
                  className="cursor-pointer transition-colors"
                  style={{
                    backgroundColor: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <td className="px-4 py-3.5">
                    <p className="font-semibold" style={{ color: "var(--text)" }}>{c.name}</p>
                    <p className="text-xs mt-1 md:hidden" style={{ color: "var(--text-muted)" }}>{fmtPhone(c.phone)}</p>
                  </td>
                  <td className="px-4 py-3.5 text-xs hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                    {fmtPhone(c.phone)}
                  </td>
                  <td className="px-4 py-3.5 text-xs hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
                    {fmtCpfMasked(c.cpf, showCpf && canSeeSensitive)}
                  </td>
                  <td className="px-4 py-3.5 text-xs hidden xl:table-cell" style={{ color: "var(--text-muted)" }}>
                    <div className="space-y-0.5">
                      <p>{(c.totalOrders ?? 0) > 0 ? `${c.totalOrders} pedido(s)` : "Sem pedidos"}</p>
                      <p>Último: {fmtDate(c.lastOrderUtc)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "#d97706" }}>
                      <Star className="w-3.5 h-3.5" />
                      {c.pointsBalance ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/app/atendimento/clientes/${c.id}/editar`);
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors"
                        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                      >
                        <Pencil size={13} />
                      </button>
                      <ChevronRight size={15} style={{ color: "var(--text-muted)" }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent = "default" }: { label: string; value: string; icon: ReactNode; accent?: "default" | "amber" }) {
  const style = accent === "amber"
    ? { borderColor: "rgba(245,158,11,.35)", backgroundColor: "rgba(245,158,11,.08)", color: "#92400e" }
    : { borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text-muted)" };

  return (
    <div className="rounded-2xl border px-4 py-3" style={style}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider font-semibold">{label}</p>
        <span>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-black" style={{ color: accent === "amber" ? "#b45309" : "var(--text)" }}>{value}</p>
    </div>
  );
}

