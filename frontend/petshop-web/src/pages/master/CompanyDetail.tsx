import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, LogOut, ChevronLeft, KeyRound, UserX, Plus } from "lucide-react";
import { clearMasterToken } from "@/features/master/auth/auth";
import {
  fetchCompany, updateCompany, suspendCompany, reactivateCompany, deleteCompany,
  fetchSettings, updateSettings,
  fetchAdmins, createAdmin, deactivateAdmin, resetAdminPassword,
  fetchWhatsapp, upsertWhatsapp,
  provisionCompany,
} from "@/features/master/companies/api";
import type { CompanyDetailDto, AdminUserDto } from "@/features/master/companies/types";

type Tab = "overview" | "settings" | "admins" | "whatsapp";

// ── Status badge ──────────────────────────────────────────────

function CompanyStatusBadge({ c }: { c: CompanyDetailDto }) {
  if (c.isDeleted)
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Deletada</span>;
  if (c.suspendedAtUtc)
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Suspensa</span>;
  if (!c.isActive)
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Inativa</span>;
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Ativa</span>;
}

// ── Overview Tab ──────────────────────────────────────────────

function OverviewTab({ company, onRefresh }: { company: CompanyDetailDto; onRefresh: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: company.name,
    plan: company.plan,
    planExpiresAtUtc: company.planExpiresAtUtc?.split("T")[0] ?? "",
  });
  const [editErr, setEditErr] = useState<string | null>(null);

  const [showSuspend, setShowSuspend]     = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendErr, setSuspendErr]       = useState<string | null>(null);

  const [showProvision, setShowProvision] = useState(false);
  const [pErr, setPErr]                   = useState<string | null>(null);
  const [pResult, setPResult]             = useState<string | null>(null);
  const [pForm, setPForm] = useState({
    adminUsername: "", adminPassword: "", adminEmail: "",
    supportWhatsappE164: "", depotAddress: "",
    deliveryReais: "", minOrderReais: "",
    enablePix: true, enableCard: true, enableCash: true,
    seedCategories: true, seedProducts: true, seedDeliverer: true,
  });

  const updateMut = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof updateCompany>[1] = {};
      if (editForm.name) body.name = editForm.name;
      if (editForm.plan) body.plan = editForm.plan;
      if (editForm.planExpiresAtUtc)
        body.planExpiresAtUtc = new Date(editForm.planExpiresAtUtc).toISOString();
      return updateCompany(company.id, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master", "company", company.id] });
      setEditing(false);
      setEditErr(null);
    },
    onError: (e: Error) => setEditErr(e.message),
  });

  const suspendMut = useMutation({
    mutationFn: () => suspendCompany(company.id, suspendReason || undefined),
    onSuccess: () => { onRefresh(); setShowSuspend(false); setSuspendReason(""); setSuspendErr(null); },
    onError: (e: Error) => setSuspendErr(e.message),
  });

  const reactivateMut = useMutation({
    mutationFn: () => reactivateCompany(company.id),
    onSuccess: () => onRefresh(),
    onError:   (e: Error) => alert(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteCompany(company.id),
    onSuccess: () => navigate("/master", { replace: true }),
    onError:   (e: Error) => alert(e.message),
  });

  const provisionMut = useMutation({
    mutationFn: () => provisionCompany(company.id, {
      adminUsername:    pForm.adminUsername,
      adminPassword:    pForm.adminPassword,
      adminEmail:       pForm.adminEmail       || undefined,
      supportWhatsappE164: pForm.supportWhatsappE164 || undefined,
      depotAddress:     pForm.depotAddress     || undefined,
      deliveryFixedCents: pForm.deliveryReais  ? Math.round(parseFloat(pForm.deliveryReais) * 100)  : undefined,
      minOrderCents:    pForm.minOrderReais     ? Math.round(parseFloat(pForm.minOrderReais)  * 100)  : undefined,
      enablePix:   pForm.enablePix,
      enableCard:  pForm.enableCard,
      enableCash:  pForm.enableCash,
      seedCategories: pForm.seedCategories,
      seedProducts:   pForm.seedProducts,
      seedDeliverer:  pForm.seedDeliverer,
    }),
    onSuccess: (res) => {
      setPResult(
        `✓ Provisionado — admin: ${res.adminUsername} | ${res.seededCategories} categorias, ` +
        `${res.seededProducts} produtos${res.seededDeliverer ? ", entregador padrão" : ""}`,
      );
      setPErr(null);
      qc.invalidateQueries({ queryKey: ["master", "company",  company.id] });
      qc.invalidateQueries({ queryKey: ["master", "admins",   company.id] });
      qc.invalidateQueries({ queryKey: ["master", "settings", company.id] });
    },
    onError: (e: Error) => setPErr(e.message),
  });

  const infoRows: [string, React.ReactNode][] = [
    ["ID",        <span key="id" className="font-mono text-xs text-gray-500">{company.id}</span>],
    ["Slug",      <code key="sl" className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{company.slug}</code>],
    ["Segmento",  company.segment],
    ["Plano",     company.plan],
    ["Expira em", company.planExpiresAtUtc
      ? new Date(company.planExpiresAtUtc).toLocaleDateString("pt-BR")
      : "—"],
    ["Admins",    String(company.adminCount)],
    ["Settings",  company.hasSettings ? "✓ Configurado" : "Não configurado"],
    ["WhatsApp",  company.hasWhatsapp  ? "✓ Integrado"  : "—"],
    ["Criado em", new Date(company.createdAtUtc).toLocaleDateString("pt-BR")],
    ...(company.suspendedReason
      ? [["Motivo suspensão", company.suspendedReason] as [string, string]]
      : []),
  ];

  return (
    <div className="space-y-5">
      {/* Info / edit card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nome</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Plano</label>
                <select
                  value={editForm.plan}
                  onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition bg-white"
                >
                  {["trial", "starter", "pro", "enterprise"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Expiração do plano</label>
              <input
                type="date"
                value={editForm.planExpiresAtUtc}
                onChange={(e) => setEditForm((f) => ({ ...f, planExpiresAtUtc: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
              />
            </div>
            {editErr && <p className="text-sm text-red-600">{editErr}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setEditErr(null); }}
                className="px-4 h-9 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => updateMut.mutate()}
                disabled={updateMut.isPending}
                className="px-4 h-9 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
              >
                {updateMut.isPending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
              {infoRows.map(([k, v]) => (
                <div key={String(k)} className="flex gap-2 items-baseline py-0.5">
                  <span className="text-gray-400 text-xs w-28 shrink-0">{k}</span>
                  <span className="text-gray-900 text-sm font-medium">{v}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="mt-4 text-sm font-semibold hover:underline"
              style={{ color: "#7c5cf8" }}
            >
              Editar nome / plano
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {!company.isDeleted && (
          company.suspendedAtUtc ? (
            <button
              onClick={() => reactivateMut.mutate()}
              disabled={reactivateMut.isPending}
              className="h-9 px-4 rounded-xl border border-green-300 text-sm font-semibold text-green-700 hover:bg-green-50 transition disabled:opacity-60"
            >
              {reactivateMut.isPending ? "Reativando…" : "Reativar empresa"}
            </button>
          ) : (
            <button
              onClick={() => setShowSuspend(true)}
              className="h-9 px-4 rounded-xl border border-amber-300 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition"
            >
              Suspender empresa
            </button>
          )
        )}

        {!company.isDeleted && (
          <button
            onClick={() => {
              if (window.confirm(`Deletar "${company.name}"? Esta ação é irreversível.`))
                deleteMut.mutate();
            }}
            disabled={deleteMut.isPending}
            className="h-9 px-4 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition disabled:opacity-60"
          >
            {deleteMut.isPending ? "Deletando…" : "Soft-delete"}
          </button>
        )}

        {!company.hasSettings && !company.isDeleted && (
          <button
            onClick={() => { setShowProvision(true); setPResult(null); setPErr(null); }}
            className="h-9 px-4 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
          >
            ⚡ Provisionar empresa
          </button>
        )}
      </div>

      {/* Suspend modal */}
      {showSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-black text-gray-900 mb-3">Suspender empresa</h3>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Motivo da suspensão (opcional)"
              className="w-full rounded-xl border border-gray-200 text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#7c5cf8] transition resize-none h-24"
            />
            {suspendErr && <p className="mt-2 text-sm text-red-600">{suspendErr}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowSuspend(false); setSuspendErr(null); }}
                className="flex-1 h-9 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => suspendMut.mutate()}
                disabled={suspendMut.isPending}
                className="flex-1 h-9 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 transition disabled:opacity-60"
              >
                {suspendMut.isPending ? "Suspendendo…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provision modal */}
      {showProvision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 my-4">
            <h3 className="text-base font-black text-gray-900 mb-4">⚡ Wizard de Provisionamento</h3>

            {pResult ? (
              <>
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 mb-4">
                  {pResult}
                </div>
                <button
                  onClick={() => { setShowProvision(false); setPResult(null); }}
                  className="w-full h-10 rounded-xl font-semibold text-sm text-white"
                  style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
                >
                  Fechar
                </button>
              </>
            ) : (
              <div className="space-y-4">
                {/* Admin fields */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Admin da empresa</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Usuário *</label>
                      <input
                        value={pForm.adminUsername}
                        onChange={(e) => setPForm((f) => ({ ...f, adminUsername: e.target.value }))}
                        className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                        placeholder="joao.admin"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Senha * (mín. 6)</label>
                      <input
                        type="password"
                        value={pForm.adminPassword}
                        onChange={(e) => setPForm((f) => ({ ...f, adminPassword: e.target.value }))}
                        className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">E-mail (opcional)</label>
                    <input
                      type="email"
                      value={pForm.adminEmail}
                      onChange={(e) => setPForm((f) => ({ ...f, adminEmail: e.target.value }))}
                      className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                      placeholder="joao@petshop.com"
                    />
                  </div>
                </div>

                {/* Basic settings */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Config básica</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Frete fixo (R$)</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={pForm.deliveryReais}
                        onChange={(e) => setPForm((f) => ({ ...f, deliveryReais: e.target.value }))}
                        className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                        placeholder="5.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pedido mínimo (R$)</label>
                      <input
                        type="number" min="0" step="0.01"
                        value={pForm.minOrderReais}
                        onChange={(e) => setPForm((f) => ({ ...f, minOrderReais: e.target.value }))}
                        className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                        placeholder="30.00"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">WhatsApp E.164 (opcional)</label>
                      <input
                        value={pForm.supportWhatsappE164}
                        onChange={(e) => setPForm((f) => ({ ...f, supportWhatsappE164: e.target.value }))}
                        className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                        placeholder="5511999999999"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex gap-5">
                    {(["enablePix", "enableCard", "enableCash"] as const).map((k) => (
                      <label key={k} className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pForm[k]}
                          onChange={(e) => setPForm((f) => ({ ...f, [k]: e.target.checked }))}
                          className="w-3.5 h-3.5 accent-purple-600"
                        />
                        {k === "enablePix" ? "PIX" : k === "enableCard" ? "Cartão" : "Dinheiro"}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Seed */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Seed de dados</p>
                  <div className="flex gap-5">
                    {(["seedCategories", "seedProducts", "seedDeliverer"] as const).map((k) => (
                      <label key={k} className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pForm[k]}
                          onChange={(e) => setPForm((f) => ({ ...f, [k]: e.target.checked }))}
                          className="w-3.5 h-3.5 accent-purple-600"
                        />
                        {k === "seedCategories" ? "Categorias" : k === "seedProducts" ? "Produtos" : "Entregador"}
                      </label>
                    ))}
                  </div>
                </div>

                {pErr && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
                    {pErr}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => { setShowProvision(false); setPErr(null); }}
                    className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => provisionMut.mutate()}
                    disabled={!pForm.adminUsername || !pForm.adminPassword || provisionMut.isPending}
                    className="flex-1 h-10 rounded-xl font-semibold text-sm text-white disabled:opacity-60 transition hover:brightness-110"
                    style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
                  >
                    {provisionMut.isPending ? "Provisionando…" : "⚡ Provisionar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────

function SettingsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ["master", "settings", companyId],
    queryFn:  () => fetchSettings(companyId),
    retry: false,
  });

  const [form, setForm] = useState({
    depotAddress: "", depotLatitude: "", depotLongitude: "", coverageRadiusKm: "",
    deliveryFixedReais: "", deliveryPerKmReais: "", minOrderReais: "",
    enablePix: true, enableCard: true, enableCash: true, pixKey: "",
    printEnabled: false, printLayout: "A4",
    supportWhatsappE164: "",
  });
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      depotAddress:       settings.depotAddress ?? "",
      depotLatitude:      settings.depotLatitude  != null ? String(settings.depotLatitude)  : "",
      depotLongitude:     settings.depotLongitude != null ? String(settings.depotLongitude) : "",
      coverageRadiusKm:   settings.coverageRadiusKm != null ? String(settings.coverageRadiusKm) : "",
      deliveryFixedReais: settings.deliveryFixedCents != null ? String(settings.deliveryFixedCents / 100) : "",
      deliveryPerKmReais: settings.deliveryPerKmCents != null ? String(settings.deliveryPerKmCents / 100) : "",
      minOrderReais:      settings.minOrderCents != null ? String(settings.minOrderCents / 100) : "",
      enablePix:          settings.enablePix,
      enableCard:         settings.enableCard,
      enableCash:         settings.enableCash,
      pixKey:             settings.pixKey ?? "",
      printEnabled:       settings.printEnabled,
      printLayout:        settings.printLayout ?? "A4",
      supportWhatsappE164: settings.supportWhatsappE164 ?? "",
    });
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () => updateSettings(companyId, {
      depotAddress:       form.depotAddress    || undefined,
      depotLatitude:      form.depotLatitude   ? parseFloat(form.depotLatitude)   : undefined,
      depotLongitude:     form.depotLongitude  ? parseFloat(form.depotLongitude)  : undefined,
      coverageRadiusKm:   form.coverageRadiusKm ? parseFloat(form.coverageRadiusKm) : undefined,
      deliveryFixedCents: form.deliveryFixedReais ? Math.round(parseFloat(form.deliveryFixedReais) * 100) : undefined,
      deliveryPerKmCents: form.deliveryPerKmReais ? Math.round(parseFloat(form.deliveryPerKmReais) * 100) : undefined,
      minOrderCents:      form.minOrderReais   ? Math.round(parseFloat(form.minOrderReais)   * 100) : undefined,
      enablePix:   form.enablePix,
      enableCard:  form.enableCard,
      enableCash:  form.enableCash,
      pixKey:      form.pixKey       || undefined,
      printEnabled: form.printEnabled,
      printLayout: form.printLayout  || undefined,
      supportWhatsappE164: form.supportWhatsappE164 || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master", "settings", companyId] });
      setSaveErr(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: Error) => setSaveErr(e.message),
  });

  type StrKey = keyof Pick<typeof form,
    "depotAddress" | "depotLatitude" | "depotLongitude" | "coverageRadiusKm" |
    "deliveryFixedReais" | "deliveryPerKmReais" | "minOrderReais" | "pixKey" |
    "printLayout" | "supportWhatsappE164"
  >;

  function textField(label: string, key: StrKey, opts?: { type?: string; placeholder?: string }) {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
        <input
          type={opts?.type ?? "text"}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={opts?.placeholder}
          className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
        />
      </div>
    );
  }

  type BoolKey = "enablePix" | "enableCard" | "enableCash" | "printEnabled";
  function toggle(label: string, key: BoolKey) {
    return (
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
          className="w-4 h-4 accent-purple-600"
        />
        {label}
      </label>
    );
  }

  if (isLoading) return <div className="py-10 text-center text-sm text-gray-400">Carregando…</div>;

  if (isError) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <p className="text-sm text-gray-500 mb-2">Settings não configuradas.</p>
      <p className="text-xs text-gray-400">Use o wizard ⚡ Provisionar na aba Overview.</p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Depósito</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            {textField("Endereço", "depotAddress", { placeholder: "Rua X, 123 — Bairro, Cidade" })}
          </div>
          {textField("Latitude",  "depotLatitude",  { type: "number", placeholder: "-23.550" })}
          {textField("Longitude", "depotLongitude", { type: "number", placeholder: "-46.633" })}
          {textField("Raio de cobertura (km)", "coverageRadiusKm", { type: "number", placeholder: "10" })}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Taxas e valores</p>
        <div className="grid grid-cols-3 gap-3">
          {textField("Frete fixo (R$)",    "deliveryFixedReais", { type: "number", placeholder: "5.00" })}
          {textField("Frete/km (R$)",      "deliveryPerKmReais", { type: "number", placeholder: "1.50" })}
          {textField("Pedido mínimo (R$)", "minOrderReais",      { type: "number", placeholder: "30.00" })}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Pagamento</p>
        <div className="flex gap-6 mb-3">
          {toggle("PIX",      "enablePix")}
          {toggle("Cartão",   "enableCard")}
          {toggle("Dinheiro", "enableCash")}
        </div>
        {textField("Chave PIX", "pixKey", { placeholder: "email@empresa.com ou CPF/CNPJ" })}
      </div>

      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Impressão</p>
        <div className="flex gap-6 mb-3">{toggle("Habilitar impressão", "printEnabled")}</div>
        <div className="flex gap-4">
          {["A4", "80mm"].map((v) => (
            <label key={v} className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="radio"
                value={v}
                checked={form.printLayout === v}
                onChange={() => setForm((f) => ({ ...f, printLayout: v }))}
                className="w-3.5 h-3.5 accent-purple-600"
              />
              {v}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">WhatsApp</p>
        {textField("Número E.164 (link de checkout)", "supportWhatsappE164", { placeholder: "5511999999999" })}
      </div>

      {saveErr && <p className="text-sm text-red-600">{saveErr}</p>}
      {saved   && <p className="text-sm text-green-600">✓ Configurações salvas!</p>}

      <button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="h-10 px-6 rounded-xl font-semibold text-sm text-white disabled:opacity-60 transition hover:brightness-110"
        style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
      >
        {saveMut.isPending ? "Salvando…" : "Salvar configurações"}
      </button>
    </div>
  );
}

// ── Admins Tab ────────────────────────────────────────────────

function AdminsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();

  const [includeInactive, setIncludeInactive] = useState(false);
  const [showCreate, setShowCreate]           = useState(false);
  const [newForm, setNewForm]                 = useState({ username: "", password: "", email: "" });
  const [newErr,  setNewErr]                  = useState<string | null>(null);
  const [resetTarget, setResetTarget]         = useState<AdminUserDto | null>(null);
  const [newPass,     setNewPass]             = useState("");
  const [resetErr,    setResetErr]            = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["master", "admins", companyId, includeInactive],
    queryFn:  () => fetchAdmins(companyId, includeInactive),
  });

  const createMut = useMutation({
    mutationFn: () => createAdmin(companyId, {
      username: newForm.username,
      password: newForm.password,
      email:    newForm.email || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master", "admins",  companyId] });
      qc.invalidateQueries({ queryKey: ["master", "company", companyId] });
      setShowCreate(false);
      setNewForm({ username: "", password: "", email: "" });
      setNewErr(null);
    },
    onError: (e: Error) => setNewErr(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: (adminId: string) => deactivateAdmin(companyId, adminId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master", "admins", companyId] }),
    onError:   (e: Error) => alert(e.message),
  });

  const resetMut = useMutation({
    mutationFn: () => resetAdminPassword(companyId, resetTarget!.id, newPass),
    onSuccess:  () => { setResetTarget(null); setNewPass(""); setResetErr(null); },
    onError:    (e: Error) => setResetErr(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="w-3.5 h-3.5 accent-purple-600"
          />
          Incluir inativos
        </label>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
          style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Novo admin
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-gray-400">Carregando…</div>
        ) : !data?.items.length ? (
          <div className="py-10 text-center text-sm text-gray-400">Nenhum admin cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">E-mail</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Último login</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.items.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">{u.username}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.email ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {u.lastLoginAtUtc
                      ? new Date(u.lastLoginAtUtc).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive
                      ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Ativo</span>
                      : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Inativo</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setResetTarget(u); setNewPass(""); setResetErr(null); }}
                        title="Redefinir senha"
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      {u.isActive && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Desativar "${u.username}"?`))
                              deactivateMut.mutate(u.id);
                          }}
                          title="Desativar"
                          className="w-7 h-7 rounded-lg border border-red-200 flex items-center justify-center hover:bg-red-50 transition"
                        >
                          <UserX className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create admin modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-black text-gray-900 mb-4">Novo admin</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Usuário *</label>
                <input
                  value={newForm.username}
                  onChange={(e) => setNewForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm font-mono outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                  placeholder="joao.admin"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Senha * (mín. 6)</label>
                <input
                  type="password"
                  value={newForm.password}
                  onChange={(e) => setNewForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">E-mail (opcional)</label>
                <input
                  type="email"
                  value={newForm.email}
                  onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
                  placeholder="joao@empresa.com"
                />
              </div>
            </div>
            {newErr && <p className="mt-2 text-sm text-red-600">{newErr}</p>}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowCreate(false); setNewErr(null); }}
                className="flex-1 h-9 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!newForm.username || !newForm.password || createMut.isPending}
                className="flex-1 h-9 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
              >
                {createMut.isPending ? "Criando…" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6">
            <h3 className="text-base font-black text-gray-900 mb-1">Redefinir senha</h3>
            <p className="text-xs text-gray-500 mb-4 font-mono">{resetTarget.username}</p>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition mb-2"
              placeholder="Nova senha (mín. 6)"
            />
            {resetErr && <p className="text-sm text-red-600 mb-2">{resetErr}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setResetTarget(null); setResetErr(null); }}
                className="flex-1 h-9 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => resetMut.mutate()}
                disabled={newPass.length < 6 || resetMut.isPending}
                className="flex-1 h-9 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
              >
                {resetMut.isPending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WhatsApp Tab ──────────────────────────────────────────────

function WhatsappTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["master", "whatsapp", companyId],
    queryFn:  () => fetchWhatsapp(companyId),
    retry: false,
  });

  const [form, setForm] = useState({
    mode: "link", wabaId: "", phoneNumberId: "",
    accessToken: "", webhookSecret: "", isActive: false,
  });
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      mode:          data.mode,
      wabaId:        data.wabaId          ?? "",
      phoneNumberId: data.phoneNumberId   ?? "",
      accessToken:   "",                           // never pre-fill
      webhookSecret: data.webhookSecret   ?? "",
      isActive:      data.isActive,
    });
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => upsertWhatsapp(companyId, {
      mode:          form.mode,
      wabaId:        form.wabaId        || undefined,
      phoneNumberId: form.phoneNumberId || undefined,
      accessToken:   form.accessToken   || undefined,
      webhookSecret: form.webhookSecret || undefined,
      isActive:      form.isActive,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master", "whatsapp", companyId] });
      qc.invalidateQueries({ queryKey: ["master", "company",  companyId] });
      setSaveErr(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: Error) => setSaveErr(e.message),
  });

  if (isLoading) return <div className="py-10 text-center text-sm text-gray-400">Carregando…</div>;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      {isError && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
          Nenhuma integração configurada. Preencha abaixo para criar.
        </div>
      )}

      {!isError && data && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Token armazenado:</span>
          {data.hasAccessToken
            ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✓ Sim</span>
            : <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Não</span>}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-2">Modo</label>
        <div className="flex gap-5">
          {["link", "cloud_api"].map((v) => (
            <label key={v} className="flex items-center gap-1.5 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="radio"
                value={v}
                checked={form.mode === v}
                onChange={() => setForm((f) => ({ ...f, mode: v }))}
                className="w-3.5 h-3.5 accent-purple-600"
              />
              {v === "link" ? "Link simples" : "Cloud API"}
            </label>
          ))}
        </div>
      </div>

      {form.mode === "cloud_api" && (
        <div className="space-y-3">
          {(["wabaId", "phoneNumberId", "webhookSecret"] as const).map((k) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                {k === "wabaId" ? "WABA ID" : k === "phoneNumberId" ? "Phone Number ID" : "Webhook Secret"}
              </label>
              <input
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Access Token{" "}
              <span className="font-normal text-gray-400">(deixe em branco para manter o atual)</span>
            </label>
            <input
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm((f) => ({ ...f, accessToken: e.target.value }))}
              className="w-full h-9 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8] transition"
            />
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          className="w-4 h-4 accent-purple-600"
        />
        Integração ativa
      </label>

      {saveErr && <p className="text-sm text-red-600">{saveErr}</p>}
      {saved   && <p className="text-sm text-green-600">✓ Integração salva!</p>}

      <button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="h-10 px-6 rounded-xl font-semibold text-sm text-white disabled:opacity-60 transition hover:brightness-110"
        style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
      >
        {saveMut.isPending ? "Salvando…" : "Salvar integração"}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview"  },
  { key: "settings", label: "Settings"  },
  { key: "admins",   label: "Admins"    },
  { key: "whatsapp", label: "WhatsApp"  },
];

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: company, isLoading, isError, refetch } = useQuery({
    queryKey: ["master", "company", id],
    queryFn:  () => fetchCompany(id!),
    enabled:  !!id,
  });

  function handleLogout() {
    clearMasterToken();
    window.location.href = "/master/login";
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["master", "company", id] });
    refetch();
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
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

      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* Back + title */}
        <div className="mb-5">
          <Link
            to="/master"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition mb-3"
          >
            <ChevronLeft className="w-4 h-4" />
            Empresas
          </Link>

          {isLoading ? (
            <div className="h-8 w-56 bg-gray-200 animate-pulse rounded-xl" />
          ) : isError ? (
            <p className="text-sm text-red-500">Empresa não encontrada.</p>
          ) : company && (
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-black text-gray-900">{company.name}</h1>
              <CompanyStatusBadge c={company} />
              <code className="text-xs bg-gray-100 px-2 py-1 rounded-lg text-gray-500">
                {company.slug}
              </code>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-5 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 h-9 rounded-lg text-sm font-semibold transition ${
                tab === t.key ? "text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
              style={tab === t.key
                ? { background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }
                : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {company && (
          <>
            {tab === "overview" && <OverviewTab company={company} onRefresh={refresh} />}
            {tab === "settings" && <SettingsTab companyId={company.id} />}
            {tab === "admins"   && <AdminsTab   companyId={company.id} />}
            {tab === "whatsapp" && <WhatsappTab  companyId={company.id} />}
          </>
        )}
      </main>
    </div>
  );
}
