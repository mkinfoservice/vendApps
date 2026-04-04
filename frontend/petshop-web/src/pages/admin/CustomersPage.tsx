import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listCustomers } from "@/features/customers/customersApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import { Users, Search, ChevronRight, Pencil, Star } from "lucide-react";

function fmtCpf(cpf: string | null) {
  if (!cpf) return null;
  if (cpf.length === 11)
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  return cpf;
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  let timer: ReturnType<typeof setTimeout>;
  function onSearch(v: string) {
    setSearch(v);
    clearTimeout(timer);
    timer = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 350);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["customers", debouncedSearch, page],
    queryFn: () => listCustomers(page, debouncedSearch || undefined),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / 30)) : 1),
    [data],
  );

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        <PageHeader
          title="Clientes"
          subtitle={isLoading ? "Carregando..." : `${total} cliente${total !== 1 ? "s" : ""}`}
        />

        {/* Search */}
        <div
          className="rounded-2xl border p-4 mb-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              className="h-10 w-full rounded-xl border pl-9 pr-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
              style={{
                backgroundColor: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
              placeholder="Buscar por nome, CPF ou telefone..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>Telefone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>CPF</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>Cidade</th>
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
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "rgba(124,92,248,0.06)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      i % 2 === 0 ? "var(--surface)" : "var(--surface-2)")
                  }
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--text)" }}>{c.name}</td>
                  <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>
                    {c.phone}
                  </td>
                  <td className="px-4 py-3 text-xs hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                    {fmtCpf(c.cpf) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
                    {c.city ? `${c.city}/${c.state}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {(c as any).pointsBalance ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
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
