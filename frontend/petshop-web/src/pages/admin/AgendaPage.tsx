import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import type {
  ServiceTypeDto,
  ServiceAppointmentDto,
  AppointmentStatus,
} from "@/features/agenda/agendaApi";
import {
  listServiceTypes,
  createServiceType,
  updateServiceType,
  deleteServiceType,
  listAppointments,
  createAppointment,
  updateAppointment,
  checkInAppointment,
  startAppointment,
  doneAppointment,
  cancelAppointment,
  noShowAppointment,
  deleteAppointment,
} from "@/features/agenda/agendaApi";

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay(); // 0=Dom
  const diff = day === 0 ? -6 : 1 - day; // segunda = início
  r.setDate(r.getDate() + diff);
  return r;
}

function fmtTime(iso: string): string {
  return iso.slice(11, 16); // "HH:MM" de "2026-03-13T10:00:00"
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function brl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
}

function whatsappUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  Scheduled:  { label: "Agendado",   color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  CheckedIn:  { label: "Chegou",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  InProgress: { label: "Em serviço", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  Done:       { label: "Concluído",  color: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  Cancelled:  { label: "Cancelado",  color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
  NoShow:     { label: "Não veio",   color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
};

// ── AppointmentCard ────────────────────────────────────────────────────────────

function AppointmentCard({
  appt,
  onSelect,
  compact = false,
}: {
  appt: ServiceAppointmentDto;
  onSelect: () => void;
  compact?: boolean;
}) {
  const s = STATUS[appt.status];
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl border p-3 transition-all hover:ring-2 hover:ring-[#7c5cf8]/40"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
              {fmtTime(appt.scheduledAt)}
            </span>
            {!compact && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ color: s.color, backgroundColor: s.bg }}
              >
                {s.label}
              </span>
            )}
          </div>
          <div className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
            {appt.petName}
            {appt.petBreed && (
              <span className="font-normal text-xs ml-1" style={{ color: "var(--text-muted)" }}>
                ({appt.petBreed})
              </span>
            )}
          </div>
          {!compact && (
            <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
              {appt.serviceTypeName} · {appt.customerName}
            </div>
          )}
          {compact && (
            <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {appt.serviceTypeName}
            </div>
          )}
        </div>
        {!compact && (
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-emerald-400">{brl(appt.priceCents)}</div>
          </div>
        )}
        {compact && (
          <span
            className="w-2 h-2 rounded-full shrink-0 mt-1"
            style={{ backgroundColor: s.color }}
          />
        )}
      </div>
    </button>
  );
}

// ── AppointmentDetailModal ─────────────────────────────────────────────────────

function AppointmentDetailModal({
  appt: initialAppt,
  onClose,
  onEdit,
  onRefresh,
  onDelete,
}: {
  appt: ServiceAppointmentDto;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: (updated: ServiceAppointmentDto) => void;
  onDelete: () => void;
}) {
  const [appt, setAppt] = useState(initialAppt);
  const [loading, setLoading] = useState(false);
  const s = STATUS[appt.status];

  async function transition(fn: () => Promise<ServiceAppointmentDto>) {
    setLoading(true);
    try {
      const updated = await fn();
      setAppt(updated);
      onRefresh(updated);
    } finally {
      setLoading(false);
    }
  }

  const isActive = appt.status !== "Done" && appt.status !== "Cancelled" && appt.status !== "NoShow";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <div className="font-bold text-base" style={{ color: "var(--text)" }}>
              {appt.petName}
              {appt.petBreed && (
                <span className="font-normal text-sm ml-1.5" style={{ color: "var(--text-muted)" }}>
                  ({appt.petBreed})
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {appt.serviceTypeName} · {fmtDate(appt.scheduledAt)} às {fmtTime(appt.scheduledAt)}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: s.color, backgroundColor: s.bg }}
            >
              {s.label}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <div className="text-xs mb-0.5 font-medium" style={{ color: "var(--text-muted)" }}>
                Cliente
              </div>
              <div style={{ color: "var(--text)" }}>{appt.customerName}</div>
            </div>
            {appt.customerPhone && (
              <div>
                <div className="text-xs mb-0.5 font-medium" style={{ color: "var(--text-muted)" }}>
                  Telefone
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: "var(--text)" }}>{appt.customerPhone}</span>
                  {isActive && (
                    <a
                      href={whatsappUrl(
                        appt.customerPhone,
                        `Olá ${appt.customerName}! Lembrando do agendamento de ${appt.serviceTypeName} para ${appt.petName} em ${fmtDate(appt.scheduledAt)} às ${fmtTime(appt.scheduledAt)}.`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                      style={{ backgroundColor: "rgba(37,211,102,0.12)", color: "#25d366" }}
                    >
                      WA
                    </a>
                  )}
                </div>
              </div>
            )}
            {appt.operatorName && (
              <div>
                <div className="text-xs mb-0.5 font-medium" style={{ color: "var(--text-muted)" }}>
                  Profissional
                </div>
                <div style={{ color: "var(--text)" }}>{appt.operatorName}</div>
              </div>
            )}
            <div>
              <div className="text-xs mb-0.5 font-medium" style={{ color: "var(--text-muted)" }}>
                Valor
              </div>
              <div className="font-bold text-emerald-400">{brl(appt.priceCents)}</div>
            </div>
          </div>

          {appt.notes && (
            <div
              className="rounded-xl px-3 py-2 text-sm italic"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
            >
              {appt.notes}
            </div>
          )}

          {/* Status action buttons */}
          {appt.status === "Scheduled" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => transition(() => checkInAppointment(appt.id))}
                disabled={loading}
                className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
              >
                ✓ Check-in
              </button>
              <button
                onClick={() => transition(() => cancelAppointment(appt.id))}
                disabled={loading}
                className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => transition(() => noShowAppointment(appt.id))}
                disabled={loading}
                className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "rgba(107,114,128,0.08)", color: "#6b7280" }}
              >
                Não veio
              </button>
            </div>
          )}

          {appt.status === "CheckedIn" && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => transition(() => startAppointment(appt.id))}
                disabled={loading}
                className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "rgba(167,139,250,0.12)", color: "#a78bfa" }}
              >
                ▶ Iniciar serviço
              </button>
              <button
                onClick={() => transition(() => cancelAppointment(appt.id))}
                disabled={loading}
                className="flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}
              >
                Cancelar
              </button>
            </div>
          )}

          {appt.status === "InProgress" && (
            <button
              onClick={() => transition(() => doneAppointment(appt.id))}
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#10b981" }}
            >
              ✓ Concluir serviço
            </button>
          )}

          {appt.status === "Done" && appt.financialEntryId && (
            <div
              className="text-xs rounded-xl px-3 py-2 text-center"
              style={{ backgroundColor: "rgba(16,185,129,0.08)", color: "#10b981" }}
            >
              Lançamento financeiro gerado automaticamente.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onDelete}
            className="text-sm px-3 py-1.5 rounded-lg font-semibold"
            style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}
          >
            Excluir
          </button>
          <button
            onClick={onEdit}
            className="text-sm px-3 py-1.5 rounded-lg font-semibold"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--text)" }}
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AppointmentFormModal ───────────────────────────────────────────────────────

function AppointmentFormModal({
  initial,
  serviceTypes,
  defaultDate,
  onClose,
  onSaved,
}: {
  initial?: ServiceAppointmentDto;
  serviceTypes: ServiceTypeDto[];
  defaultDate: string;
  onClose: () => void;
  onSaved: (appt: ServiceAppointmentDto) => void;
}) {
  const activeTypes = serviceTypes.filter((t) => t.isActive);

  const [serviceTypeId, setServiceTypeId] = useState(
    initial?.serviceTypeId ?? activeTypes[0]?.id ?? ""
  );
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduledAt.slice(0, 16) ?? `${defaultDate}T09:00`
  );
  const [petName, setPetName] = useState(initial?.petName ?? "");
  const [petBreed, setPetBreed] = useState(initial?.petBreed ?? "");
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone ?? "");
  const [operatorName, setOperatorName] = useState(initial?.operatorName ?? "");
  const [priceStr, setPriceStr] = useState(
    initial ? (initial.priceCents / 100).toFixed(2).replace(".", ",") : ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleServiceTypeChange(id: string) {
    setServiceTypeId(id);
    if (!initial) {
      const st = activeTypes.find((t) => t.id === id);
      if (st && st.defaultPriceCents > 0) {
        setPriceStr((st.defaultPriceCents / 100).toFixed(2).replace(".", ","));
      }
    }
  }

  function parsePriceCents(): number {
    return Math.round(parseFloat(priceStr.replace(",", ".")) * 100) || 0;
  }

  async function handleSave() {
    if (!serviceTypeId || !scheduledAt || !petName.trim() || !customerName.trim()) {
      setError("Preencha os campos obrigatórios.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        serviceTypeId,
        scheduledAt: scheduledAt + ":00",
        petName: petName.trim(),
        petBreed: petBreed.trim() || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        operatorName: operatorName.trim() || undefined,
        priceCents: parsePriceCents(),
        notes: notes.trim() || undefined,
      };
      const saved = initial
        ? await updateAppointment(initial.id, body)
        : await createAppointment(body);
      onSaved(saved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8]/30";
  const inputStyle = {
    backgroundColor: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--text)",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>
            {initial ? "Editar agendamento" : "Novo agendamento"}
          </h2>
          <button onClick={onClose} className="p-1" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Service type */}
          <div>
            <label
              className="text-xs font-semibold mb-1 block"
              style={{ color: "var(--text-muted)" }}
            >
              Tipo de serviço *
            </label>
            <select
              value={serviceTypeId}
              onChange={(e) => handleServiceTypeChange(e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              {activeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.category ? ` (${t.category})` : ""}
                </option>
              ))}
              {activeTypes.length === 0 && (
                <option disabled value="">
                  Nenhum tipo cadastrado
                </option>
              )}
            </select>
          </div>

          {/* Date + time */}
          <div>
            <label
              className="text-xs font-semibold mb-1 block"
              style={{ color: "var(--text-muted)" }}
            >
              Data e hora *
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {/* Pet */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                className="text-xs font-semibold mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                Nome do pet *
              </label>
              <input
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="Rex"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className="text-xs font-semibold mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                Raça
              </label>
              <input
                value={petBreed}
                onChange={(e) => setPetBreed(e.target.value)}
                placeholder="Labrador"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Customer */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                className="text-xs font-semibold mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                Nome do cliente *
              </label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="João Silva"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className="text-xs font-semibold mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                Telefone
              </label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Operator + price */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                className="text-xs font-semibold mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                Profissional
              </label>
              <input
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="Ana"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className="text-xs font-semibold mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                Valor (R$)
              </label>
              <input
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="0,00"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              className="text-xs font-semibold mb-1 block"
              style={{ color: "var(--text-muted)" }}
            >
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Alergia a determinado produto..."
              className={`${inputCls} resize-none`}
              style={inputStyle}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div
          className="flex justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: "#7c5cf8" }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ServiceTypesModal ──────────────────────────────────────────────────────────

function ServiceTypesModal({
  serviceTypes,
  onClose,
  onRefresh,
}: {
  serviceTypes: ServiceTypeDto[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editSt, setEditSt] = useState<ServiceTypeDto | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDuration, setFormDuration] = useState("60");
  const [formPrice, setFormPrice] = useState("0,00");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditSt(null);
    setFormName("");
    setFormCategory("");
    setFormDuration("60");
    setFormPrice("0,00");
    setFormActive(true);
    setShowForm(true);
  }

  function openEdit(st: ServiceTypeDto) {
    setEditSt(st);
    setFormName(st.name);
    setFormCategory(st.category ?? "");
    setFormDuration(String(st.durationMinutes));
    setFormPrice((st.defaultPriceCents / 100).toFixed(2).replace(".", ","));
    setFormActive(st.isActive);
    setShowForm(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        durationMinutes: parseInt(formDuration) || 60,
        defaultPriceCents:
          Math.round(parseFloat(formPrice.replace(",", ".")) * 100) || 0,
        category: formCategory.trim() || undefined,
        isActive: formActive,
      };
      if (editSt) {
        await updateServiceType(editSt.id, body);
      } else {
        await createServiceType(body);
      }
      onRefresh();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteServiceType(id);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao excluir.");
    }
  }

  const inputCls =
    "w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[#7c5cf8]/30";
  const inputStyle = {
    backgroundColor: "var(--surface-2)",
    borderColor: "var(--border)",
    color: "var(--text)",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-xl"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>
            {showForm ? (editSt ? "Editar serviço" : "Novo serviço") : "Tipos de serviço"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        {!showForm ? (
          <>
            <div className="px-5 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {serviceTypes.length === 0 && (
                <p
                  className="text-sm text-center py-8"
                  style={{ color: "var(--text-muted)" }}
                >
                  Nenhum tipo cadastrado.
                </p>
              )}
              {serviceTypes.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl border"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
                >
                  <div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: st.isActive ? "var(--text)" : "var(--text-muted)" }}
                    >
                      {st.name}
                      {!st.isActive && (
                        <span className="text-xs ml-1 text-red-400">(inativo)</span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {st.category ? `${st.category} · ` : ""}
                      {st.durationMinutes}min · {brl(st.defaultPriceCents)}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(st)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ backgroundColor: "var(--surface)", color: "var(--text-muted)" }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(st.id)}
                      className="text-xs px-2 py-1 rounded-lg text-red-400"
                      style={{ backgroundColor: "rgba(239,68,68,0.08)" }}
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <button
                onClick={openCreate}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: "#7c5cf8" }}
              >
                + Novo tipo
              </button>
            </div>
          </>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <div>
              <label
                className="text-xs font-semibold mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                Nome *
              </label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Banho e Tosa"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  className="text-xs font-semibold mb-1 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Categoria
                </label>
                <input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Banho e Tosa"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label
                  className="text-xs font-semibold mb-1 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Duração (min)
                </label>
                <input
                  type="number"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label
                className="text-xs font-semibold mb-1 block"
                style={{ color: "var(--text-muted)" }}
              >
                Preço padrão (R$)
              </label>
              <input
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="0,00"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            {editSt && (
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text)" }}>
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 accent-[#7c5cf8]"
                />
                Ativo
              </label>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
              >
                Voltar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#7c5cf8" }}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DayView ────────────────────────────────────────────────────────────────────

function DayView({
  date,
  appointments,
  onSelectAppt,
}: {
  date: Date;
  appointments: ServiceAppointmentDto[];
  onSelectAppt: (a: ServiceAppointmentDto) => void;
}) {
  const dateStr = toDateStr(date);
  const dayAppts = appointments
    .filter((a) => a.scheduledAt.startsWith(dateStr))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  if (dayAppts.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="text-4xl mb-3">📅</div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum agendamento para este dia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {dayAppts.map((a) => (
        <AppointmentCard key={a.id} appt={a} onSelect={() => onSelectAppt(a)} />
      ))}
    </div>
  );
}

// ── WeekView ───────────────────────────────────────────────────────────────────

function WeekView({
  weekStart,
  appointments,
  onSelectAppt,
  onSelectDay,
}: {
  weekStart: Date;
  appointments: ServiceAppointmentDto[];
  onSelectAppt: (a: ServiceAppointmentDto) => void;
  onSelectDay: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayStr = toDateStr(new Date());

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dateStr = toDateStr(day);
        const dayAppts = appointments
          .filter((a) => a.scheduledAt.startsWith(dateStr))
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
        const isToday = dateStr === todayStr;

        return (
          <div key={dateStr} className="min-h-[180px]">
            <button
              onClick={() => onSelectDay(day)}
              className="w-full text-center py-1.5 mb-2 rounded-lg transition-colors"
              style={{
                backgroundColor: isToday ? "#7c5cf8" : "transparent",
                color: isToday ? "#fff" : "var(--text-muted)",
              }}
            >
              <div className="text-[10px] font-semibold uppercase hidden sm:block">
                {day.toLocaleDateString("pt-BR", { weekday: "short" })}
              </div>
              <div
                className="text-lg font-bold leading-tight"
                style={{ color: isToday ? "#fff" : "var(--text)" }}
              >
                {day.getDate()}
              </div>
              {dayAppts.length > 0 && (
                <div
                  className="text-[10px] font-semibold"
                  style={{ color: isToday ? "rgba(255,255,255,0.8)" : "var(--text-muted)" }}
                >
                  {dayAppts.length}
                </div>
              )}
            </button>

            <div className="space-y-1">
              {dayAppts.slice(0, 3).map((a) => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  onSelect={() => onSelectAppt(a)}
                  compact
                />
              ))}
              {dayAppts.length > 3 && (
                <button
                  onClick={() => onSelectDay(day)}
                  className="w-full text-center text-[10px] py-1 rounded-lg"
                  style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
                >
                  +{dayAppts.length - 3} mais
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ListView ───────────────────────────────────────────────────────────────────

function ListView({
  appointments,
  onSelectAppt,
}: {
  appointments: ServiceAppointmentDto[];
  onSelectAppt: (a: ServiceAppointmentDto) => void;
}) {
  const grouped = appointments.reduce<Record<string, ServiceAppointmentDto[]>>((acc, a) => {
    const date = a.scheduledAt.slice(0, 10);
    (acc[date] = acc[date] || []).push(a);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort();

  if (dates.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Nenhum agendamento no período.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {dates.map((date) => (
        <div key={date}>
          <div
            className="text-xs font-semibold uppercase tracking-wider mb-2 capitalize"
            style={{ color: "var(--text-muted)" }}
          >
            {fmtDate(date)} ·{" "}
            {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" })}
          </div>
          <div className="space-y-2">
            {grouped[date]
              .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
              .map((a) => (
                <AppointmentCard key={a.id} appt={a} onSelect={() => onSelectAppt(a)} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AgendaPage ─────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<"day" | "week" | "list">("day");
  const [selectedAppt, setSelectedAppt] = useState<ServiceAppointmentDto | null>(null);
  const [editAppt, setEditAppt] = useState<ServiceAppointmentDto | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { from, to } = useMemo(() => {
    if (view === "day") {
      const d = toDateStr(currentDate);
      return { from: d, to: d };
    }
    if (view === "week") {
      const mon = startOfWeek(currentDate);
      return { from: toDateStr(mon), to: toDateStr(addDays(mon, 6)) };
    }
    // list: próximos 30 dias + 7 passados
    return { from: toDateStr(addDays(currentDate, -7)), to: toDateStr(addDays(currentDate, 30)) };
  }, [view, currentDate]);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["agenda-appointments", from, to],
    queryFn: () => listAppointments({ from, to }),
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["agenda-service-types"],
    queryFn: listServiceTypes,
  });

  function handleApptUpdated(updated: ServiceAppointmentDto) {
    queryClient.setQueryData<ServiceAppointmentDto[]>(
      ["agenda-appointments", from, to],
      (old) => old?.map((a) => (a.id === updated.id ? updated : a)) ?? [updated]
    );
  }

  function handleApptSaved() {
    queryClient.invalidateQueries({ queryKey: ["agenda-appointments"] });
    setShowForm(false);
    setEditAppt(null);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteAppointment(confirmDelete);
      queryClient.setQueryData<ServiceAppointmentDto[]>(
        ["agenda-appointments", from, to],
        (old) => old?.filter((a) => a.id !== confirmDelete) ?? []
      );
      setSelectedAppt(null);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  function navigate(n: number) {
    if (view === "day") setCurrentDate(addDays(currentDate, n));
    else if (view === "week") setCurrentDate(addDays(currentDate, n * 7));
    else setCurrentDate(addDays(currentDate, n * 30));
  }

  function headerTitle(): string {
    if (view === "day") {
      const isToday = toDateStr(currentDate) === toDateStr(new Date());
      return isToday
        ? "Hoje, " +
            currentDate.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
        : currentDate.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
    }
    if (view === "week") {
      const mon = startOfWeek(currentDate);
      const sun = addDays(mon, 6);
      return `${mon.getDate()}/${mon.getMonth() + 1} – ${sun.getDate()}/${sun.getMonth() + 1}/${sun.getFullYear()}`;
    }
    return "Lista";
  }

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />

      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              Agenda
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Agendamentos de banho, tosa e serviços veterinários
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowServices(true)}
              className="px-3 py-2 rounded-xl text-sm font-semibold border transition-colors"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--text-muted)",
              }}
            >
              ⚙ Serviços
            </button>
            <button
              onClick={() => {
                setEditAppt(null);
                setShowForm(true);
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#7c5cf8" }}
            >
              + Agendar
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* View toggle */}
          <div
            className="flex rounded-xl overflow-hidden border"
            style={{ borderColor: "var(--border)" }}
          >
            {(["day", "week", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-4 h-9 text-sm font-medium transition-all"
                style={{
                  backgroundColor: view === v ? "#7c5cf8" : "var(--surface)",
                  color: view === v ? "#fff" : "var(--text-muted)",
                }}
              >
                {v === "day" ? "Dia" : v === "week" ? "Semana" : "Lista"}
              </button>
            ))}
          </div>

          {/* Navigation */}
          {view !== "list" && (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigate(-1)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center border text-sm transition-colors hover:bg-[--surface-2]"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  ‹
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 h-9 rounded-xl border text-sm font-medium transition-colors hover:bg-[--surface-2]"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  Hoje
                </button>
                <button
                  onClick={() => navigate(1)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center border text-sm transition-colors hover:bg-[--surface-2]"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  ›
                </button>
              </div>
              <span
                className="text-sm font-semibold capitalize"
                style={{ color: "var(--text)" }}
              >
                {headerTitle()}
              </span>
            </>
          )}

          {/* Appointment count badge */}
          {appointments.length > 0 && (
            <span
              className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "rgba(124,92,248,0.12)", color: "#9b7efa" }}
            >
              {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="py-10 text-sm" style={{ color: "var(--text-muted)" }}>
            Carregando...
          </div>
        )}

        {/* Views */}
        {!isLoading && (
          <>
            {view === "day" && (
              <DayView
                date={currentDate}
                appointments={appointments}
                onSelectAppt={setSelectedAppt}
              />
            )}
            {view === "week" && (
              <WeekView
                weekStart={startOfWeek(currentDate)}
                appointments={appointments}
                onSelectAppt={setSelectedAppt}
                onSelectDay={(d) => {
                  setCurrentDate(d);
                  setView("day");
                }}
              />
            )}
            {view === "list" && (
              <ListView appointments={appointments} onSelectAppt={setSelectedAppt} />
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedAppt && (
        <AppointmentDetailModal
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onEdit={() => {
            setEditAppt(selectedAppt);
            setSelectedAppt(null);
            setShowForm(true);
          }}
          onRefresh={(updated) => {
            handleApptUpdated(updated);
            setSelectedAppt(updated);
          }}
          onDelete={() => {
            setConfirmDelete(selectedAppt.id);
            setSelectedAppt(null);
          }}
        />
      )}

      {/* Form modal */}
      {showForm && (
        <AppointmentFormModal
          initial={editAppt ?? undefined}
          serviceTypes={serviceTypes}
          defaultDate={toDateStr(currentDate)}
          onClose={() => {
            setShowForm(false);
            setEditAppt(null);
          }}
          onSaved={handleApptSaved}
        />
      )}

      {/* Service types modal */}
      {showServices && (
        <ServiceTypesModal
          serviceTypes={serviceTypes}
          onClose={() => setShowServices(false)}
          onRefresh={() =>
            queryClient.invalidateQueries({ queryKey: ["agenda-service-types"] })
          }
        />
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div
            className="w-full max-w-sm rounded-2xl shadow-xl p-6"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <p className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>
              Confirma a exclusão deste agendamento?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#ef4444" }}
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
