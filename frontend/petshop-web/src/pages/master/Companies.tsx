import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, LogOut, Plus, Search,
  Building2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { clearMasterToken } from "@/features/master/auth/auth";
import { fetchCompanies, createCompany } from "@/features/master/companies/api";
import type { CompanyListItem } from "@/features/master/companies/types";

// ── Status / Plan badges ───────────────────────────────────────

function StatusBadge({ c }: { c: CompanyListItem }) {
  if (c.isDeleted)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Deletada</span>;
  if (c.suspendedAtUtc)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Suspensa</span>;
  if (!c.isActive)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Inativa</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Ativa</span>;
}

const PLAN_COLORS: Record<string, string> = {
  trial:      "bg-gray-100 text-gray-600",
  starter:    "bg-blue-100 text-blue-700",
  pro:        "bg-purple-100 text-purple-700",
  enterprise: "bg-yellow-100 text-yellow-700",
};

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_COLORS[plan] ?? "bg-gray-100 text-gray-600"}`}>
      {plan}
    </span>
  );
}

// ── Status filter tabs ─────────────────────────────────────────

const STATUS_FILTERS = [
  { label: "Todas",    value: "" },
  { label: "Ativas",   value: "active" },
  { label: "Suspensas",value: "suspended" },
  { label: "Inativas", value: "inactive" },
  { label: "Deletadas",value: "deleted" },
];

// ── Page ──────────────────────────────────────────────────────

const PAGE_SIZE = 15;

export default function Companies() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState("");
  const [page,   setPage]     = useState(1);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", segment: "petshop", plan: "trial" });
  const [createErr, setCreateErr]   = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["master", "companies", { search, status, page }],
    queryFn:  () => fetchCompanies({
      search:   search || undefined,
      status:   status || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
  });

  const createMut = useMutation({
    mutationFn: () => createCompany(form),
    onSuccess: (company) => {
      qc.invalidateQueries({ queryKey: ["master", "companies"] });
      setShowCreate(false);
      setForm({ name: "", slug: "", segment: "petshop", plan: "trial" });
      setCreateErr(null);
      navigate(`/master/companies/${company.id}`);
    },
    onError: (err: Error) => setCreateErr(err.message),
  });

  function handleLogout() {
    clearMasterToken();
    window.location.href = "/master/login";
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" style={{ color: "#7c5cf8" }} />
            <span className="font-black text-gray-900 text-sm">Master Admin</span>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-6">

        {/* Title + action */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-gray-900">Empresas</h1>
            {data && (
              <p className="text-sm text-gray-500 mt-0.5">
                {data.total} empresa{data.total !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl font-semibold text-sm text-white transition hover:brightness-110 active:scale-95"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            <Plus className="w-4 h-4" />
            Nova Empresa
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por nome ou slug…"
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
            />
          </div>

          <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => { setStatus(f.value); setPage(1); }}
                className={`px-3 h-8 rounded-lg text-xs font-semibold transition ${
                  status === f.value ? "text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
                style={status === f.value
                  ? { background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }
                  : {}}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-gray-400">Carregando…</div>
          ) : error ? (
            <div className="py-16 text-center text-sm text-red-500">
              Erro ao carregar empresas.
            </div>
          ) : !data?.items.length ? (
            <div className="py-16 text-center">
              <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Nenhuma empresa encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Empresa</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Slug</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Plano</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Admins</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Config</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.items.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{c.name}</td>
                      <td className="px-4 py-3.5 text-gray-500 font-mono text-xs">{c.slug}</td>
                      <td className="px-4 py-3.5"><PlanBadge plan={c.plan} /></td>
                      <td className="px-4 py-3.5"><StatusBadge c={c} /></td>
                      <td className="px-4 py-3.5 text-center text-gray-700">{c.adminCount}</td>
                      <td className="px-4 py-3.5 text-center">
                        {c.hasSettings
                          ? <span className="text-green-500 text-xs font-bold">✓</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/master/companies/${c.id}`}
                          className="text-sm font-semibold hover:underline"
                          style={{ color: "#7c5cf8" }}
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Create Company Modal ──────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-black text-gray-900 mb-4">Nova Empresa</h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nome *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                  placeholder="Petshop do João"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Slug *{" "}
                  <span className="font-normal text-gray-400 text-xs">
                    (URL única — letras minúsculas, números e hífens)
                  </span>
                </label>
                <input
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                  placeholder="petshop-joao"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Segmento</label>
                  <input
                    value={form.segment}
                    onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                    placeholder="petshop"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Plano</label>
                  <select
                    value={form.plan}
                    onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition bg-white"
                  >
                    <option value="trial">trial</option>
                    <option value="starter">starter</option>
                    <option value="pro">pro</option>
                    <option value="enterprise">enterprise</option>
                  </select>
                </div>
              </div>
            </div>

            {createErr && (
              <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                {createErr}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowCreate(false); setCreateErr(null); }}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!form.name || !form.slug || createMut.isPending}
                className="flex-1 h-10 rounded-xl font-semibold text-sm text-white transition hover:brightness-110 active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
              >
                {createMut.isPending ? "Criando…" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
