import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ToggleLeft, ToggleRight, Trash2, Download } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";
import { useAdminProducts, useToggleProductStatus, useDeleteProduct } from "@/features/admin/products/queries";
import { SyncModal } from "@/features/admin/sync/SyncModal";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5082";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function imageUrl(url: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
}

export default function ProductsList() {
  const navigate = useNavigate();

  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [active, setActive]     = useState<"" | "true" | "false">("");
  const [showSync, setShowSync] = useState(false);

  const productsQuery = useAdminProducts({
    page,
    pageSize: 20,
    search: search || undefined,
    active: active === "" ? undefined : active === "true",
  });

  const toggle = useToggleProductStatus();
  const remove = useDeleteProduct();

  const totalPages = useMemo(() => {
    if (!productsQuery.data) return 1;
    return Math.max(1, Math.ceil(productsQuery.data.total / productsQuery.data.pageSize));
  }, [productsQuery.data]);

  const items  = productsQuery.data?.items ?? [];
  const total  = productsQuery.data?.total ?? 0;

  function handleToggle(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    toggle.mutate(id);
  }

  function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (!confirm(`Excluir "${name}"?`)) return;
    remove.mutate(id, {
      onError: (err) => alert(err instanceof Error ? err.message : "Erro ao excluir produto."),
    });
  }

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />

      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              Produtos
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {productsQuery.isLoading ? "Carregando..." : `${total} produto(s)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSync(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold transition-all hover:bg-[var(--surface)]"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <Download size={15} />
              Importar
            </button>
            <button
              onClick={() => navigate("/admin/products/new")}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
            >
              <Plus size={16} />
              Novo produto
            </button>
          </div>
        </div>

        {/* Filters */}
        <div
          className="rounded-2xl border p-4 mb-4 flex flex-col sm:flex-row gap-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <input
            className="h-10 flex-1 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            placeholder="Buscar por nome, código interno ou código de barras..."
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
          <select
            className="h-10 rounded-xl border px-3.5 text-sm outline-none"
            style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            value={active}
            onChange={(e) => { setPage(1); setActive(e.target.value as "" | "true" | "false"); }}
          >
            <option value="">Todos os status</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </div>

        {/* Error */}
        {productsQuery.isError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400 mb-4">
            Erro ao carregar produtos. Tente recarregar a página.
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider w-12" style={{ color: "var(--text-muted)" }} />
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Produto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Categoria</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>Preço</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>Custo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>Margem</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden xl:table-cell" style={{ color: "var(--text-muted)" }}>Estoque</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden xl:table-cell" style={{ color: "var(--text-muted)" }}>Atualizado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {productsQuery.isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Carregando produtos...
                  </td>
                </tr>
              )}
              {!productsQuery.isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Nenhum produto encontrado.
                  </td>
                </tr>
              )}
              {items.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/admin/products/${p.id}`)}
                  className="cursor-pointer transition-colors"
                  style={{
                    backgroundColor: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(124,92,248,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? "var(--surface)" : "var(--surface-2)")}
                >
                  {/* Thumb */}
                  <td className="px-3 py-2.5 w-12">
                    <div
                      className="w-10 h-10 rounded-xl overflow-hidden shrink-0"
                      style={{ backgroundColor: "var(--surface-2)" }}
                    >
                      {imageUrl(p.imageUrl) ? (
                        <img
                          src={imageUrl(p.imageUrl)!}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-[10px] font-black" style={{ color: "var(--text-muted)" }}>
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Nome + status */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: "var(--text)" }}>{p.name}</span>
                      {!p.isActive && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-900/30 text-red-400">
                          Inativo
                        </span>
                      )}
                    </div>
                    {p.internalCode && (
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Cód: {p.internalCode}
                      </div>
                    )}
                    <div className="md:hidden text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {p.categoryName ?? "—"}
                    </div>
                  </td>

                  {/* Categoria */}
                  <td className="px-4 py-2.5 hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                    {p.categoryName ?? "—"}
                  </td>

                  {/* Preço */}
                  <td className="px-4 py-2.5 text-right hidden sm:table-cell font-semibold" style={{ color: "var(--text)" }}>
                    {formatBRL(p.priceCents)}
                  </td>

                  {/* Custo */}
                  <td className="px-4 py-2.5 text-right hidden lg:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatBRL(p.costCents)}
                  </td>

                  {/* Margem */}
                  <td className="px-4 py-2.5 text-right hidden lg:table-cell text-xs font-semibold" style={{ color: p.marginPercent >= 30 ? "#4ade80" : p.marginPercent >= 10 ? "#facc15" : "#f87171" }}>
                    {Number(p.marginPercent).toFixed(1)}%
                  </td>

                  {/* Estoque */}
                  <td className="px-4 py-2.5 text-right hidden xl:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                    {Number(p.stockQty).toFixed(0)} {p.unit}
                  </td>

                  {/* Data */}
                  <td className="px-4 py-2.5 text-right hidden xl:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatDate(p.updatedAtUtc)}
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        title={p.isActive ? "Desativar" : "Ativar"}
                        onClick={(e) => handleToggle(e, p.id)}
                        disabled={toggle.isPending}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-2)]"
                        style={{ color: p.isActive ? "#4ade80" : "var(--text-muted)" }}
                      >
                        {p.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <button
                        title="Excluir"
                        onClick={(e) => handleDelete(e, p.id, p.name)}
                        disabled={remove.isPending}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-900/20"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <button
            className="h-9 px-4 rounded-xl border text-sm font-medium transition-all disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Página {page} de {totalPages}
          </span>
          <button
            className="h-9 px-4 rounded-xl border text-sm font-medium transition-all disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
          </button>
        </div>
      </div>

      {showSync && <SyncModal onClose={() => setShowSync(false)} />}
    </div>
  );
}
