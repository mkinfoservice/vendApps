import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Pencil } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";
import { useDeleteDeliverer, useDeliverers } from "@/features/admin/deliverers/queries";
import type { DelivererResponse } from "@/features/admin/deliverers/type";

function normalizePhone(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function Initials({ name }: { name: string }) {
  const letters = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-black select-none"
      style={{ backgroundColor: "rgba(124,92,248,0.15)", color: "#7c5cf8" }}
    >
      {letters || "?"}
    </div>
  );
}

export default function DeliverersList() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  const isActiveParam =
    activeFilter === "" ? undefined : activeFilter === "true";

  const { data, isLoading, isError } = useDeliverers(
    isActiveParam === undefined ? undefined : { isActive: isActiveParam }
  );

  const del = useDeleteDeliverer();

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter((d: DelivererResponse) => {
      const name = (d.name ?? "").toLowerCase();
      const phone = normalizePhone(d.phone ?? "");
      const qPhone = normalizePhone(q);
      return name.includes(q) || (qPhone && phone.includes(qPhone));
    });
  }, [data, search]);

  function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (!confirm(`Excluir entregador "${name}"?`)) return;
    del.mutate(id, {
      onError: (err) =>
        alert(err instanceof Error ? err.message : "Erro ao excluir entregador."),
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
              Entregadores
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {isLoading ? "Carregando..." : `${filtered.length} entregador(es)`}
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/deliverers/new")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
          >
            <Plus size={16} />
            Novo entregador
          </button>
        </div>

        {/* Filters */}
        <div
          className="rounded-2xl border p-4 mb-4 flex flex-col sm:flex-row gap-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <input
            className="h-10 flex-1 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
            style={{
              backgroundColor: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="h-10 rounded-xl border px-3.5 text-sm outline-none"
            style={{
              backgroundColor: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            value={activeFilter}
            onChange={(e) =>
              setActiveFilter(e.target.value as "" | "true" | "false")
            }
          >
            <option value="">Todos os status</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </div>

        {/* Error */}
        {isError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400 mb-4">
            Erro ao carregar entregadores. Tente recarregar a página.
          </div>
        )}

        {/* Table */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider w-12"
                  style={{ color: "var(--text-muted)" }}
                />
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Entregador
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell"
                  style={{ color: "var(--text-muted)" }}
                >
                  Telefone
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell"
                  style={{ color: "var(--text-muted)" }}
                >
                  Veículo
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Status
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Carregando entregadores...
                  </td>
                </tr>
              )}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Nenhum entregador encontrado.
                  </td>
                </tr>
              )}

              {filtered.map((d, i) => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/admin/deliverers/${d.id}`)}
                  className="cursor-pointer transition-colors"
                  style={{
                    backgroundColor:
                      i % 2 === 0 ? "var(--surface)" : "var(--surface-2)",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(124,92,248,0.06)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      i % 2 === 0 ? "var(--surface)" : "var(--surface-2)")
                  }
                >
                  {/* Avatar */}
                  <td className="px-3 py-2.5 w-12">
                    <Initials name={d.name} />
                  </td>

                  {/* Nome */}
                  <td className="px-4 py-2.5">
                    <span
                      className="font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      {d.name}
                    </span>
                    <div
                      className="sm:hidden text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {d.phone || "—"}
                    </div>
                  </td>

                  {/* Telefone */}
                  <td
                    className="px-4 py-2.5 hidden sm:table-cell"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {d.phone || "—"}
                  </td>

                  {/* Veículo */}
                  <td
                    className="px-4 py-2.5 hidden md:table-cell"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {d.vehicle || "—"}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2.5 text-center">
                    {d.isActive ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400">
                        Ativo
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">
                        Inativo
                      </span>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="px-4 py-2.5 text-center">
                    <div
                      className="flex items-center justify-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        title="Editar"
                        onClick={() => navigate(`/admin/deliverers/${d.id}`)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-2)]"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#7c5cf8")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--text-muted)")
                        }
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        title="Excluir"
                        onClick={(e) => handleDelete(e, d.id, d.name)}
                        disabled={del.isPending}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-900/20"
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#f87171")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--text-muted)")
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
