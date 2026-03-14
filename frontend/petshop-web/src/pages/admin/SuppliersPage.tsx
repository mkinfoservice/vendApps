import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSuppliers, createSupplier, updateSupplier, deactivateSupplier,
  type SupplierDto,
} from "@/features/purchases/purchasesApi";
import { Truck, Plus, Pencil, Trash2, Search } from "lucide-react";

// ── Masks ──────────────────────────────────────────────────────────────────────

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

// ── Constants ──────────────────────────────────────────────────────────────────

const EMPTY: Omit<SupplierDto, "id" | "isActive" | "createdAtUtc"> = {
  name: "", cnpj: null, email: null, phone: null, contactName: null, notes: null,
};

const INPUT = "bg-white text-gray-900 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30";

function SupplierModal({
  supplier,
  onClose,
}: { supplier: SupplierDto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isNew = supplier === null;
  const [form, setForm] = useState<Omit<SupplierDto, "id" | "isActive" | "createdAtUtc">>(
    supplier
      ? { name: supplier.name, cnpj: supplier.cnpj, email: supplier.email,
          phone: supplier.phone, contactName: supplier.contactName, notes: supplier.notes }
      : { ...EMPTY }
  );
  const [cnpjDisplay, setCnpjDisplay] = useState(maskCNPJ(supplier?.cnpj ?? ""));
  const [phoneDisplay, setPhoneDisplay] = useState(maskPhone(supplier?.phone ?? ""));
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof typeof form, v: string) {
    setForm(p => ({ ...p, [k]: v || null }));
  }

  const mut = useMutation({
    mutationFn: () =>
      isNew ? createSupplier(form) : updateSupplier(supplier!.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); onClose(); },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">{isNew ? "Novo fornecedor" : "Editar fornecedor"}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nome *</label>
            <input className={`mt-1 ${INPUT}`} value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">CNPJ</label>
              <input className={`mt-1 ${INPUT}`} value={cnpjDisplay} placeholder="00.000.000/0000-00"
                onChange={e => {
                  const m = maskCNPJ(e.target.value);
                  setCnpjDisplay(m);
                  set("cnpj", m.replace(/\D/g, ""));
                }} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Telefone</label>
              <input className={`mt-1 ${INPUT}`} value={phoneDisplay} placeholder="(11) 99999-9999"
                onChange={e => {
                  const m = maskPhone(e.target.value);
                  setPhoneDisplay(m);
                  set("phone", m.replace(/\D/g, ""));
                }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">E-mail</label>
            <input className={`mt-1 ${INPUT}`} type="email" value={form.email ?? ""}
              onChange={e => set("email", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contato</label>
            <input className={`mt-1 ${INPUT}`} value={form.contactName ?? ""}
              onChange={e => set("contactName", e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Observações</label>
            <textarea className={`mt-1 ${INPUT} resize-none`} rows={2} value={form.notes ?? ""}
              onChange={e => set("notes", e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancelar</button>
          <button
            disabled={!form.name || mut.isPending}
            onClick={() => mut.mutate()}
            className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition disabled:opacity-40"
          >
            {mut.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editSupplier, setEditSupplier] = useState<SupplierDto | null | undefined>(undefined);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", showInactive],
    queryFn:  () => listSuppliers(showInactive),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.cnpj ?? "").includes(search)
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      {editSupplier !== undefined && (
        <SupplierModal
          supplier={editSupplier}
          onClose={() => setEditSupplier(undefined)}
        />
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(124,92,248,0.12)" }}>
              <Truck className="w-5 h-5" style={{ color: "#7c5cf8" }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Fornecedores</h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{suppliers.length} cadastrado{suppliers.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button
            onClick={() => setEditSupplier(null)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            Novo
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>
            <input type="checkbox" checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)} />
            Inativos
          </label>
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "var(--surface-2)" }}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>CNPJ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Contato</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Telefone</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center" style={{ color: "var(--text-muted)" }}>Carregando...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center" style={{ color: "var(--text-muted)" }}>Nenhum fornecedor encontrado.</td></tr>
              )}
              {filtered.map(s => (
                <tr key={s.id} className={`transition border-t ${!s.isActive ? "opacity-50" : ""}`}
                  style={{ borderColor: "var(--border)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--surface-2)"}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = ""}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: "var(--text)" }}>{s.name}</p>
                    {s.email && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.email}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>
                    {s.cnpj ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                    {s.contactName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                    {s.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditSupplier(s)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {s.isActive && (
                        <button
                          onClick={() => {
                            if (confirm(`Desativar "${s.name}"?`))
                              deactivateMut.mutate(s.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition"
                          title="Desativar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
