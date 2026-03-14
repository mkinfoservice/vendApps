import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchCustomer, createCustomer, updateCustomer } from "@/features/admin/customers/api";
import type { UpsertCustomerRequest } from "@/features/admin/customers/types";
import { ArrowLeft, Loader2, MapPin, Search } from "lucide-react";

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
function maskCEP(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}
function unmask(v: string) { return v.replace(/\D/g, ""); }

// Fix leaflet default icon (webpack/vite issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type LatLng = { lat: number; lng: number };

type FormState = UpsertCustomerRequest & {
  neighborhood?: string;
  city?: string;
  state?: string;
};

const EMPTY: FormState = {
  name: "", phone: "", cpf: "", cep: "",
  address: "", complement: "", addressReference: "", notes: "",
};

// ── CEP lookup via ViaCEP (client-side, sem custo de backend) ─────────────────
async function lookupCep(cep: string): Promise<{
  logradouro: string; bairro: string; localidade: string; uf: string;
} | null> {
  const cleaned = cep.replace(/\D/g, "");
  if (cleaned.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch { return null; }
}

// ── Nominatim geocode (client-side, sem API key) ──────────────────────────────
async function geocodeAddress(query: string): Promise<LatLng | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

// ── Draggable marker component ────────────────────────────────────────────────
function DraggableMarker({ position, onChange }: { position: LatLng; onChange: (p: LatLng) => void }) {
  useMapEvents({
    click(e) { onChange({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{ dragend: (e) => { const m = e.target; onChange(m.getLatLng()); } }}
    />
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CustomerForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMsg, setCepMsg] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [showMap, setShowMap] = useState(false);

  // ── Load existing customer ─────────────────────────────────────────────────
  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!customer) return;
    setForm({
      name: customer.name,
      phone: maskPhone(customer.phone),
      cpf: maskCPF(customer.cpf ?? ""),
      cep: maskCEP(customer.cep ?? ""),
      address: customer.address ?? "",
      complement: customer.complement ?? "",
      addressReference: customer.addressReference ?? "",
      notes: customer.notes ?? "",
      neighborhood: customer.neighborhood ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
    });
    if (customer.latitude && customer.longitude) {
      setPin({ lat: customer.latitude, lng: customer.longitude });
      setShowMap(true);
    }
  }, [customer]);

  // ── CEP auto-fill ─────────────────────────────────────────────────────────
  const handleCepBlur = useCallback(async () => {
    const cep = unmask(form.cep ?? "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    setCepMsg(null);
    const data = await lookupCep(cep);
    setCepLoading(false);
    if (!data) { setCepMsg("CEP não encontrado."); return; }
    setCepMsg(`${data.localidade}/${data.uf}`);
    setForm(f => ({
      ...f,
      address: f.address || data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf,
    }));
    // Geocodifica automaticamente
    handleGeocode(cep, data.logradouro, data.bairro, data.localidade, data.uf);
  }, [form.cep]);

  // ── Geocoding ──────────────────────────────────────────────────────────────
  async function handleGeocode(
    cep?: string, logradouro?: string, bairro?: string, cidade?: string, uf?: string
  ) {
    const c = cep ?? unmask(form.cep ?? "");
    const parts = [
      logradouro ?? form.address,
      bairro ?? form.neighborhood,
      cidade ?? form.city,
      uf ?? form.state,
      "Brasil",
    ].filter(Boolean);
    if (!parts.length && !c) return;

    setGeoLoading(true);
    const query = parts.join(", ") || `CEP ${c}, Brasil`;
    const coords = await geocodeAddress(query);
    setGeoLoading(false);

    if (coords) {
      setPin(coords);
      setShowMap(true);
    } else {
      setShowMap(true); // abre mapa mesmo sem resultado para ajuste manual
    }
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
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
      phone: unmask(form.phone),
      cpf: unmask(form.cpf ?? "") || undefined,
      cep: unmask(form.cep ?? "") || undefined,
      address: form.address?.trim() || undefined,
      complement: form.complement?.trim() || undefined,
      addressReference: form.addressReference?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      latitude: pin?.lat ?? undefined,
      longitude: pin?.lng ?? undefined,
    };
    if (isEdit) updateMut.mutate(payload);
    else createMut.mutate(payload);
  }

  const isSaving = createMut.isPending || updateMut.isPending;
  const defaultCenter: LatLng = pin ?? { lat: -22.9068, lng: -43.1729 }; // Rio de Janeiro

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

          {/* Dados pessoais */}
          <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Dados pessoais</h2>
            <Field label="Nome *" required>
              <input required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo" className={inputClass} style={inputStyle} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Telefone *" required>
                <input required value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))}
                  placeholder="(21) 99999-9999" className={inputClass} style={inputStyle} />
              </Field>
              <Field label="CPF (opcional)">
                <input value={form.cpf ?? ""}
                  onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))}
                  placeholder="000.000.000-00" className={inputClass} style={inputStyle} />
              </Field>
            </div>
          </section>

          {/* Endereço */}
          <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Endereço de entrega</h2>

            {/* CEP com auto-fill */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Field label="CEP">
                  <div className="relative">
                    <input
                      value={form.cep ?? ""}
                      onChange={e => { setForm(f => ({ ...f, cep: maskCEP(e.target.value) })); setCepMsg(null); }}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      maxLength={9}
                      className={inputClass}
                      style={inputStyle}
                    />
                    {cepLoading && (
                      <Loader2 size={13} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                    )}
                  </div>
                </Field>
                {cepMsg && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{cepMsg}</p>
                )}
              </div>
              <div className="col-span-2">
                <Field label="Logradouro + número">
                  <input value={form.address ?? ""}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Rua das Flores, 123" className={inputClass} style={inputStyle} />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Complemento">
                <input value={form.complement ?? ""}
                  onChange={e => setForm(f => ({ ...f, complement: e.target.value }))}
                  placeholder="Apto 201, Bloco B..." className={inputClass} style={inputStyle} />
              </Field>
              <Field label="Referência">
                <input value={form.addressReference ?? ""}
                  onChange={e => setForm(f => ({ ...f, addressReference: e.target.value }))}
                  placeholder="Portão azul, próximo ao mercado..." className={inputClass} style={inputStyle} />
              </Field>
            </div>

            {/* Bairro / Cidade preenchidos via ViaCEP (readonly) */}
            {(form.neighborhood || form.city) && (
              <div className="flex gap-2 text-xs px-1" style={{ color: "var(--text-muted)" }}>
                {form.neighborhood && <span>Bairro: <strong>{form.neighborhood}</strong></span>}
                {form.city && <span>· Cidade: <strong>{form.city}/{form.state}</strong></span>}
              </div>
            )}

            {/* Botão geocodificar + abrir mapa */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleGeocode()}
                disabled={geoLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold hover:bg-[--surface-2] transition disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                {geoLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Search size={14} />}
                Buscar localização
              </button>
              {(pin || showMap) && (
                <button
                  type="button"
                  onClick={() => setShowMap(s => !s)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold hover:bg-[--surface-2] transition"
                  style={{ borderColor: "var(--border)", color: pin ? "var(--brand, #7c5cf8)" : "var(--text-muted)" }}
                >
                  <MapPin size={14} />
                  {showMap ? "Ocultar mapa" : "Ver mapa"}
                  {pin && <span className="text-xs">✓</span>}
                </button>
              )}
            </div>

            {/* Mini-mapa com pin arrastável */}
            {showMap && (
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)", height: 280 }}>
                <p className="text-xs px-3 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "var(--surface-2)" }}>
                  Clique no mapa ou arraste o pino para ajustar a localização exata.
                  {pin && <span className="ml-2 font-mono">{pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}</span>}
                </p>
                <MapContainer
                  center={defaultCenter}
                  zoom={pin ? 16 : 13}
                  style={{ height: "100%", width: "100%" }}
                  key={`${defaultCenter.lat},${defaultCenter.lng}`}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <DraggableMarker
                    position={pin ?? defaultCenter}
                    onChange={setPin}
                  />
                </MapContainer>
              </div>
            )}
          </section>

          {/* Observações */}
          <section className="rounded-2xl border p-5 space-y-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Observações</h2>
            <textarea
              value={form.notes ?? ""}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
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
const inputStyle = { borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" };

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
