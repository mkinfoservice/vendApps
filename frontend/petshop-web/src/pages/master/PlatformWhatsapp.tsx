import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, LogOut, ChevronLeft } from "lucide-react";
import { clearMasterToken } from "@/features/master/auth/auth";
import { fetchPlatformWhatsapp, upsertPlatformWhatsapp } from "@/features/master/companies/api";

export default function PlatformWhatsappPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["master", "platform-whatsapp"],
    queryFn:  fetchPlatformWhatsapp,
    retry: false,
  });

  const [wabaId,    setWabaId]    = useState("");
  const [phoneId,   setPhoneId]   = useState("");
  const [token,     setToken]     = useState("");
  const [langCode,  setLangCode]  = useState("pt_BR");
  const [isActive,  setIsActive]  = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [err,       setErr]       = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setWabaId(data.wabaId    ?? "");
    setPhoneId(data.phoneNumberId ?? "");
    setLangCode(data.templateLanguageCode ?? "pt_BR");
    setIsActive(data.isActive);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => upsertPlatformWhatsapp({
      wabaId:               wabaId.trim()  || undefined,
      phoneNumberId:        phoneId.trim() || undefined,
      accessToken:          token.trim()   || undefined,
      templateLanguageCode: langCode.trim() || "pt_BR",
      isActive,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["master", "platform-whatsapp"] });
      setToken("");
      setErr(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e: Error) => setErr(e.message),
  });

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
            onClick={() => { clearMasterToken(); window.location.href = "/master/login"; }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-6">
        <div className="mb-5">
          <Link
            to="/master"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition mb-3"
          >
            <ChevronLeft className="w-4 h-4" />
            Empresas
          </Link>
          <h1 className="text-xl font-black text-gray-900">WhatsApp da Plataforma</h1>
          <p className="text-sm text-gray-500 mt-1">
            Conta global usada por empresas que escolhem o modo <strong>Plataforma</strong>.
            Gerencie via Meta Business Manager / Cloud API.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-sm text-gray-400">Carregando…</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">

            {/* Status badge */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">Status atual:</span>
              {data?.isActive
                ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Ativa</span>
                : <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Inativa</span>}
              {data?.hasAccessToken
                ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Token configurado</span>
                : <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Sem token</span>}
            </div>

            {/* WABA ID */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">WABA ID</label>
              <input
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder="123456789012345"
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {/* Phone Number ID */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Phone Number ID</label>
              <input
                value={phoneId}
                onChange={(e) => setPhoneId(e.target.value)}
                placeholder="123456789012345"
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {/* Access Token */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Access Token{data?.hasAccessToken ? " (deixe em branco para manter)" : ""}
              </label>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type="password"
                placeholder={data?.hasAccessToken ? "••••••••••••" : "EAAxxxxxxxx..."}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            {/* Language code */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Idioma padrão dos templates</label>
              <select
                value={langCode}
                onChange={(e) => setLangCode(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white text-gray-800 focus:outline-none"
              >
                <option value="pt_BR">pt_BR — Português (Brasil)</option>
                <option value="en_US">en_US — English (US)</option>
                <option value="es_AR">es_AR — Español (Argentina)</option>
              </select>
            </div>

            {/* Ativo */}
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-purple-600"
              />
              Habilitar para uso pelas empresas
            </label>

            {err   && <p className="text-sm text-red-600">{err}</p>}
            {saved && <p className="text-sm text-green-600">✓ Configuração salva!</p>}

            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="h-10 px-6 rounded-xl font-semibold text-sm text-white disabled:opacity-60 transition hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #7c5cf8, #6d4df2)" }}
            >
              {saveMut.isPending ? "Salvando…" : "Salvar configuração"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
