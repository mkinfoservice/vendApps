import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCustomer, createCustomer, updateCustomer } from "@/features/admin/customers/api";
import type { UpsertCustomerRequest } from "@/features/admin/customers/types";
import { ArrowLeft, Loader2 } from "lucide-react";

// ── Masks ─────────────────────────────────────────────────────────────────────
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}
function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function unmask(v: string) { return v.replace(/\D/g, ""); }

type FormState = { name: string; phone: string; cpf: string };

const EMPTY: FormState = { name: "", phone: "", cpf: "" };

export default function CustomerForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!customer) return;
    setForm({
      name: customer.name,
      phone: maskPhone(customer.phone ?? ""),
      cpf: maskCPF(customer.cpf ?? ""),
    });
  }, [customer]);

  const createMut = useMutation({
    mutationFn: createCustomer,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      navigate(`/app/atendimento/clientes/${data.id}`);
    },
    onError: (e: Error) => setError(e.message ?? "Erro ao criar cliente."),
  });

  const updateMut = useMutation({
    mutationFn: (body: UpsertCustomerRequest) => updateCustomer(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", id] });
      navigate(`/app/atendimento/clientes/${id}`);
    },
    onError: (e: Error) => setError(e.message ?? "Erro ao atualizar cliente."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: UpsertCustomerRequest = {
      name: form.name.trim(),
      phone: unmask(form.phone) || undefined,
      cpf: unmask(form.cpf) || undefined,
    };
    if (isEdit) updateMut.mutate(payload);
    else createMut.mutate(payload);
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  if (isEdit && isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <main className="mx-auto max-w-lg px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[--surface-2] transition"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            {isEdit ? "Editar cliente" : "Novo cliente"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Dados do cliente</h2>

            <Field label="Nome *">
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo"
                className={inputClass}
                style={inputStyle}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Telefone">
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))}
                  placeholder="(21) 99999-9999"
                  className={inputClass}
                  style={inputStyle}
                />
              </Field>
              <Field label="CPF">
                <input
                  value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))}
                  placeholder="000.000.000-00"
                  className={inputClass}
                  style={inputStyle}
                />
              </Field>
            </div>
          </section>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3 rounded-xl border text-sm font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? "Salvar alterações" : "Cadastrar cliente"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

const inputClass = "w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30";
const inputStyle = { borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}
