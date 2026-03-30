import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, TriangleAlert, Package } from "lucide-react";
import {
  useCreateSupply,
  useDeleteSupply,
  useSupplies,
  useUpdateSupply,
  useWhatsappPreferences,
  useUpdateWhatsappPreferences,
} from "@/features/admin/supplies/queries";
import type { Supply, UpsertSupplyRequest } from "@/features/admin/supplies/api";

type SupplyFormState = {
  name: string;
  unit: string;
  category: string;
  stockQty: string;
  minQty: string;
  supplierName: string;
  notes: string;
  isActive: boolean;
};

const DEFAULT_FORM: SupplyFormState = {
  name: "",
  unit: "UN",
  category: "",
  stockQty: "0",
  minQty: "0",
  supplierName: "",
  notes: "",
  isActive: true,
};

function toPayload(form: SupplyFormState): UpsertSupplyRequest {
  return {
    name: form.name.trim(),
    unit: form.unit.trim() || "UN",
    category: form.category.trim() || null,
    stockQty: Number(form.stockQty || 0),
    minQty: Number(form.minQty || 0),
    supplierName: form.supplierName.trim() || null,
    notes: form.notes.trim() || null,
    isActive: form.isActive,
  };
}

function toForm(supply: Supply): SupplyFormState {
  return {
    name: supply.name,
    unit: supply.unit,
    category: supply.category ?? "",
    stockQty: String(supply.stockQty),
    minQty: String(supply.minQty),
    supplierName: supply.supplierName ?? "",
    notes: supply.notes ?? "",
    isActive: supply.isActive,
  };
}

function SupplyModal({ supply, onClose }: { supply: Supply | null; onClose: () => void }) {
  const isNew = !supply;
  const [form, setForm] = useState<SupplyFormState>(supply ? toForm(supply) : DEFAULT_FORM);

  const createMut = useCreateSupply();
  const updateMut = useUpdateSupply();
  const pending = createMut.isPending || updateMut.isPending;

  async function handleSave() {
    const payload = toPayload(form);
    if (!payload.name) return;

    if (isNew) await createMut.mutateAsync(payload);
    else await updateMut.mutateAsync({ id: supply.id, payload });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border p-5 space-y-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>{isNew ? "Novo insumo" : "Editar insumo"}</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Materiais operacionais da empresa.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm" style={{ color: "var(--text)" }}>
            Nome
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }} />
          </label>
          <label className="text-sm" style={{ color: "var(--text)" }}>
            Unidade
            <input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }} />
          </label>
          <label className="text-sm" style={{ color: "var(--text)" }}>
            Categoria
            <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }} />
          </label>
          <label className="text-sm" style={{ color: "var(--text)" }}>
            Fornecedor
            <input value={form.supplierName} onChange={(e) => setForm((p) => ({ ...p, supplierName: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }} />
          </label>
          <label className="text-sm" style={{ color: "var(--text)" }}>
            Estoque atual
            <input type="number" step="0.001" value={form.stockQty} onChange={(e) => setForm((p) => ({ ...p, stockQty: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }} />
          </label>
          <label className="text-sm" style={{ color: "var(--text)" }}>
            Estoque minimo
            <input type="number" step="0.001" value={form.minQty} onChange={(e) => setForm((p) => ({ ...p, minQty: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }} />
          </label>
          <label className="text-sm md:col-span-2" style={{ color: "var(--text)" }}>
            Observacoes
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }} />
          </label>
        </div>

        <label className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
          Insumo ativo
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Cancelar</button>
          <button onClick={handleSave} disabled={pending || !form.name.trim()}
            className="px-4 py-2 text-sm rounded-lg font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: "var(--brand)" }}>
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuppliesPage() {
  const [search, setSearch] = useState("");
  const [showOnlyLow, setShowOnlyLow] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Supply | null | undefined>(undefined);

  const { data = [], isLoading } = useSupplies({
    search,
    lowStock: showOnlyLow,
    active: showInactive ? undefined : true,
  });

  const deleteMut = useDeleteSupply();
  const { data: waPrefs } = useWhatsappPreferences();
  const updateWaPrefs = useUpdateWhatsappPreferences();
  const [waMode, setWaMode] = useState<"none" | "own" | "platform">("none");
  const [ownerPhone, setOwnerPhone] = useState("");

  useEffect(() => {
    if (!waPrefs) return;
    setWaMode(waPrefs.whatsappMode);
    setOwnerPhone(waPrefs.ownerAlertPhone ?? "");
  }, [waPrefs]);

  const lowCount = useMemo(() => data.filter((s) => s.isLow).length, [data]);

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      {editing !== undefined && <SupplyModal supply={editing} onClose={() => setEditing(undefined)} />}

      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(59,130,246,0.15)" }}>
              <Package size={18} color="#3b82f6" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Insumos</h1>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{data.length} item(ns) cadastrados</p>
            </div>
          </div>
          <button onClick={() => setEditing(null)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--brand)" }}>
            <Plus size={16} /> Novo insumo
          </button>
        </div>

        {lowCount > 0 && (
          <div className="rounded-xl border px-4 py-3 flex items-center gap-2 text-sm" style={{ borderColor: "rgba(249,115,22,0.35)", backgroundColor: "rgba(249,115,22,0.08)", color: "#f97316" }}>
            <TriangleAlert size={16} />
            <span><strong>{lowCount}</strong> insumo(s) em nivel baixo. Reabastecimento recomendado.</span>
          </div>
        )}

        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Alerta no WhatsApp</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Defina se usa WhatsApp proprio, global da plataforma ou desativado.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm" style={{ color: "var(--text-muted)" }}>
              Modo
              <select value={waMode} onChange={(e) => setWaMode(e.target.value as "none" | "own" | "platform")}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}>
                <option value="none">Desativado</option>
                <option value="own">WhatsApp proprio</option>
                <option value="platform">WhatsApp global</option>
              </select>
            </label>
            <label className="text-sm md:col-span-2" style={{ color: "var(--text-muted)" }}>
              Telefone do proprietario para alerta
              <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="(11) 99999-9999"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }} />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={async () => {
                await updateWaPrefs.mutateAsync({ whatsappMode: waMode, ownerAlertPhone: ownerPhone.trim() || null });
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: "var(--brand)" }}
              disabled={updateWaPrefs.isPending}
            >
              {updateWaPrefs.isPending ? "Salvando..." : "Salvar preferencia"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={15} style={{ color: "var(--text-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome do insumo"
              className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)", color: "var(--text)" }}
            />
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--surface)" }}>
            <input type="checkbox" checked={showOnlyLow} onChange={(e) => setShowOnlyLow(e.target.checked)} />
            Apenas baixos
          </label>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--surface)" }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Incluir inativos
          </label>
        </div>

        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: "var(--surface-2)" }}>
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Insumo</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wide hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Categoria</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Atual</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Minimo</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>Carregando...</td></tr>
              )}
              {!isLoading && data.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--text-muted)" }}>Nenhum insumo encontrado.</td></tr>
              )}
              {data.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: "var(--text)" }}>{s.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.unit} {s.supplierName ? `- ${s.supplierName}` : ""}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" style={{ color: "var(--text-muted)" }}>{s.category || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: s.isLow ? "#f97316" : "var(--text)" }}>{s.stockQty.toLocaleString("pt-BR")} {s.unit}</td>
                  <td className="px-4 py-3 text-right" style={{ color: "var(--text-muted)" }}>{s.minQty.toLocaleString("pt-BR")} {s.unit}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(s)} className="p-2 rounded-lg hover:bg-[var(--surface-2)]" title="Editar">
                        <Pencil size={15} style={{ color: "var(--text-muted)" }} />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Excluir o insumo \"${s.name}\"?`)) return;
                          await deleteMut.mutateAsync(s.id);
                        }}
                        className="p-2 rounded-lg hover:bg-red-50"
                        title="Excluir"
                      >
                        <Trash2 size={15} color="#ef4444" />
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
