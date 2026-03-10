import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { fetchCustomer, createCustomer, updateCustomer } from "@/features/admin/customers/api";
import type { UpsertCustomerRequest } from "@/features/admin/customers/types";
import { ArrowLeft, Loader2 } from "lucide-react";

type FormState = UpsertCustomerRequest;

const EMPTY: FormState = {
  name: "", phone: "", cpf: "", cep: "",
  address: "", complement: "", addressReference: "", notes: "",
};

export default function CustomerForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit  = !!id;
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
    if (customer) {
      setForm({
        name:             customer.name,
        phone:            customer.phone,
        cpf:              customer.cpf ?? "",
        cep:              customer.cep ?? "",
        address:          customer.address ?? "",
        complement:       customer.complement ?? "",
        addressReference: customer.addressReference ?? "",
        notes:            customer.notes ?? "",
      });
    }
  }, [customer]);

  const createMut = useMutation({
    mutationFn: createCustomer,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      navigate(`/admin/atendimento/clientes/${data.id}`);
    },
    onError: async (e: unknown) => {
      const res = e as Response;
      const body = await res.json?.().catch(() => ({}));
      setError(body?.error ?? "Erro ao criar cliente.");
    },
  });

  const updateMut = useMutation({
    mutationFn: (body: UpsertCustomerRequest) => updateCustomer(id!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", id] });
      navigate(`/admin/atendimento/clientes/${id}`);
    },
    onError: async (e: unknown) => {
      const res = e as Response;
      const body = await res.json?.().catch(() => ({}));
      setError(body?.error ?? "Erro ao atualizar cliente.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: UpsertCustomerRequest = {
      name:  form.name.trim(),
      phone: form.phone.trim(),
      cpf:   form.cpf?.trim() || undefined,
      cep:   form.cep?.trim() || undefined,
      address:          form.address?.trim() || undefined,
      complement:       form.complement?.trim() || undefined,
      addressReference: form.addressReference?.trim() || undefined,
      notes:            form.notes?.trim() || undefined,
    };
    if (isEdit) updateMut.mutate(payload);
    else createMut.mutate(payload);
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  if (isEdit && isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
        <AdminNav />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[--surface-2] transition"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              {isEdit ? "Editar cliente" : "Novo cliente"}
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Dados pessoais */}
          <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Dados pessoais
            </h2>
            <Field label="Nome *" required>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo"
                className={inputClass}
                style={inputStyle}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Telefone *" required>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(21) 99999-9999"
                  className={inputClass}
                  style={inputStyle}
                />
              </Field>
              <Field label="CPF (opcional)">
                <input
                  value={form.cpf ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                  className={inputClass}
                  style={inputStyle}
                />
              </Field>
            </div>
          </section>

          {/* Endereço */}
          <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Endereço de entrega
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <Field label="CEP">
                <input
                  value={form.cep ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))}
                  placeholder="00000-000"
                  className={inputClass}
                  style={inputStyle}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Endereço (logradouro + número)">
                  <input
                    value={form.address ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Rua das Flores, 123"
                    className={inputClass}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
            <Field label="Complemento">
              <input
                value={form.complement ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))}
                placeholder="Apto 201, Bloco B..."
                className={inputClass}
                style={inputStyle}
              />
            </Field>
            <Field label="Referência">
              <input
                value={form.addressReference ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, addressReference: e.target.value }))}
                placeholder="Próximo ao mercado, portão azul..."
                className={inputClass}
                style={inputStyle}
              />
            </Field>
          </section>

          {/* Observações */}
          <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              Observações
            </h2>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Informações adicionais sobre o cliente..."
              rows={3}
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
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
const inputStyle = {
  borderColor: "var(--border)",
  backgroundColor: "var(--bg)",
  color: "var(--text)",
};

function Field({ label, required, children }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
