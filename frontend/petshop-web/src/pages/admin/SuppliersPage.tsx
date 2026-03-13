import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  listSuppliers, createSupplier, updateSupplier, deactivateSupplier,
  type SupplierDto,
} from "@/features/purchases/purchasesApi";
import { Truck, Plus, Pencil, Trash2, Search } from "lucide-react";

const EMPTY: Omit<SupplierDto, "id" | "isActive" | "createdAtUtc"> = {
  name: "", cnpj: null, email: null, phone: null, contactName: null, notes: null,
};

const INPUT = "border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand/30";

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
              <input className={`mt-1 ${INPUT}`} value={form.cnpj ?? ""} maxLength={14}
                onChange={e => set("cnpj", e.target.value)} placeholder="00000000000000" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Telefone</label>
              <input className={`mt-1 ${INPUT}`} value={form.phone ?? ""}
                onChange={e => set("phone", e.target.value)} />
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
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

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
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <Truck className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Fornecedores</h1>
              <p className="text-sm text-gray-500">{suppliers.length} cadastrado{suppliers.length !== 1 ? "s" : ""}</p>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)} />
            Inativos
          </label>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">CNPJ</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Contato</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Telefone</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Carregando...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Nenhum fornecedor encontrado.</td></tr>
              )}
              {filtered.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 transition ${!s.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{s.name}</p>
                    {s.email && <p className="text-xs text-gray-400">{s.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden sm:table-cell">
                    {s.cnpj ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                    {s.contactName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
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
