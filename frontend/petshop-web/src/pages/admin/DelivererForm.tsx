import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminNav } from "@/components/admin/AdminNav";
import {
  useCreateDeliverer,
  useDeliverer,
  useUpdateDeliverer,
} from "@/features/admin/deliverers/queries";

type FormState = {
  name: string;
  phone: string;
  vehicle: string;
  isActive: boolean;
  pin: string;
};

const EMPTY: FormState = {
  name: "",
  phone: "",
  vehicle: "",
  isActive: true,
  pin: "",
};

export default function DelivererForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const create = useCreateDeliverer();
  const update = useUpdateDeliverer();

  const delivererQuery = useDeliverer(!isNew ? id! : "");
  const deliverer = delivererQuery.data;

  useEffect(() => {
    if (!isNew && deliverer) {
      setForm({
        name: deliverer.name ?? "",
        phone: deliverer.phone ?? "",
        vehicle: deliverer.vehicle ?? "",
        isActive: !!deliverer.isActive,
        pin: "",
      });
    }
  }, [deliverer, isNew]);

  function set(field: keyof FormState, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const isSaving = create.isPending || update.isPending;
  const isLoadingDeliverer = !isNew && delivererQuery.isLoading;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    if (!form.phone.trim()) { setError("Telefone é obrigatório."); return; }

    if (isNew) {
      if (!form.pin.trim() || form.pin.trim().length < 4) {
        setError("Informe um PIN com mínimo 4 dígitos numéricos.");
        return;
      }

      try {
        await create.mutateAsync({
          name: form.name.trim(),
          phone: form.phone.trim(),
          vehicle: form.vehicle.trim() || null,
          pin: form.pin.trim(),
          isActive: form.isActive,
        });
        navigate("/admin/deliverers");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao criar entregador.");
      }
      return;
    }

    try {
      await update.mutateAsync({
        id: id!,
        data: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          vehicle: form.vehicle.trim() || null,
          isActive: form.isActive,
        },
      });
      navigate("/admin/deliverers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar entregador.");
    }
  }

  return (
    <div className="min-h-dvh" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />

      <div className="mx-auto max-w-2xl px-4 pb-12 pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              {isNew ? "Novo entregador" : "Editar entregador"}
            </h1>
            {!isNew && deliverer && (
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {deliverer.name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/deliverers")}
            className="rounded-xl border px-3 py-2 text-xs transition hover:bg-[var(--surface)]"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Voltar
          </button>
        </div>

        {isLoadingDeliverer && (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            Carregando entregador...
          </div>
        )}

        {delivererQuery.isError && (
          <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
            Erro ao carregar entregador.
          </div>
        )}

        {!isLoadingDeliverer && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dados principais */}
            <section
              className="rounded-2xl border p-5 space-y-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
                Dados do entregador
              </div>

              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  Nome *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>

              {/* Telefone */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  Telefone *
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="(21) 99999-9999"
                  inputMode="tel"
                  className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>

              {/* Veículo */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  Veículo
                </label>
                <input
                  value={form.vehicle}
                  onChange={(e) => set("vehicle", e.target.value)}
                  placeholder="Ex: Moto Honda CG 160 — ABC-1234"
                  className="w-full h-10 rounded-xl border px-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  Status
                </label>
                <button
                  type="button"
                  onClick={() => set("isActive", !form.isActive)}
                  className="w-full h-10 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: form.isActive
                      ? "rgba(52,211,153,0.1)"
                      : "var(--surface-2)",
                    color: form.isActive ? "#34d399" : "var(--text-muted)",
                  }}
                >
                  {form.isActive ? "Ativo" : "Inativo"}
                </button>
              </div>
            </section>

            {/* Acesso — PIN só no create */}
            {isNew && (
              <section
                className="rounded-2xl border p-5 space-y-4"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
                  Acesso
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    PIN *
                  </label>
                  <input
                    value={form.pin}
                    onChange={(e) =>
                      set("pin", e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="Ex: 1234"
                    maxLength={6}
                    inputMode="numeric"
                    className="w-full h-10 rounded-xl border px-3.5 text-sm font-mono tracking-widest outline-none transition-all focus:ring-2 focus:ring-[#7c5cf8]/40"
                    style={{
                      backgroundColor: "var(--surface-2)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    4 a 6 dígitos. Usado no login do entregador (telefone + PIN).
                  </p>
                </div>
              </section>
            )}

            {/* Erro */}
            {error && (
              <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate("/admin/deliverers")}
                className="flex-1 h-11 rounded-2xl border text-sm font-semibold transition-all hover:bg-[var(--surface)]"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 h-11 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #7c5cf8 0%, #9b7efa 100%)" }}
              >
                {isSaving
                  ? "Salvando..."
                  : isNew
                  ? "Criar entregador"
                  : "Salvar alterações"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
