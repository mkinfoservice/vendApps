import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCustomers } from "@/features/admin/customers/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import { UserPlus, Search, ChevronRight, Pencil, Users } from "lucide-react";

export default function CustomersList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const isPhone = /^[\d\s()+-]+$/.test(search) && search.replace(/\D/g, "").length >= 4;

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, page],
    queryFn: () =>
      fetchCustomers({
        ...(isPhone ? { phone: search } : { name: search }),
        page,
        pageSize: 20,
      }),
    placeholderData: (prev) => prev,
  });

  const total = data?.total ?? 0;
  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1),
    [data],
  );

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        <PageHeader
          title="Clientes"
          subtitle={isLoading ? "Carregando..." : `${total} cliente${total !== 1 ? "s" : ""}`}
          actions={
            <button
              type="button"
              onClick={() => navigate("/app/atendimento/clientes/novo")}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
            >
              <UserPlus size={15} />
              Novo cliente
            </button>
          }
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
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone…"
              className="h-10 w-full rounded-xl border pl-9 pr-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
              style={{
                backgroundColor: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
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
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Cidade</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableSkeleton rows={6} cols={4} />}

              {!isLoading && (!data?.items.length) && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={Users}
                      title="Nenhum cliente encontrado"
                      description={search ? "Tente outro nome ou telefone." : "Cadastre o primeiro cliente pelo botão acima."}
                    />
                  </td>
                </tr>
              )}

              {data?.items.map((c, i) => (
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
                  <td className="px-4 py-3.5">
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{c.name}</span>
                    <div className="sm:hidden text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.phone}</div>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                    {c.phone}
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                    {c.city ? `${c.city}${c.state ? `/${c.state}` : ""}` : "—"}
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
