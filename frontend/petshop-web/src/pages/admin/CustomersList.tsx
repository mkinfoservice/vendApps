import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { fetchCustomers } from "@/features/admin/customers/api";
import { UserPlus, Search, ChevronRight, Loader2 } from "lucide-react";

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

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            Clientes
          </h1>
          <button
            onClick={() => navigate("/admin/atendimento/clientes/novo")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 transition"
          >
            <UserPlus size={16} />
            Novo cliente
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
          />
        </div>

        {/* List */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : !data?.items.length ? (
            <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
              {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {data.items.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => navigate(`/admin/atendimento/clientes/${c.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[--surface-2] transition text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                        {c.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {c.phone}
                        {c.city && ` · ${c.city}${c.state ? `/${c.state}` : ""}`}
                      </p>
                    </div>
                    <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            <span>
              {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} de {data.total}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-[--surface-2] transition"
                style={{ borderColor: "var(--border)" }}
              >
                Anterior
              </button>
              <button
                disabled={page * data.pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40 hover:bg-[--surface-2] transition"
                style={{ borderColor: "var(--border)" }}
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
