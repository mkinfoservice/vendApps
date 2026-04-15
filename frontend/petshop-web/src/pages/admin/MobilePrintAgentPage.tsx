import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Bluetooth, BluetoothOff, BluetoothConnected, Wifi,
  ChevronLeft, CheckCircle2, AlertCircle, Printer,
  Smartphone, Settings, TestTube2, Info,
} from "lucide-react";
import { usePrintStatus } from "@/features/admin/print/PrintContext";
import {
  isMobileAgent,   setMobileAgent,
  getMobileMode,   setMobileMode,
  getMobilePaper,  setMobilePaper,
  isBluetoothSupported,
  connectBluetoothPrinter,
  connectedBluetoothDevice,
  disconnectBluetooth,
  mobilePrint,
  type MobilePrintMode,
} from "@/features/admin/print/mobilePrint";
import type { PaperWidth } from "@/features/admin/print/escpos";
import type { PrintOrderPayload } from "@/features/admin/print/types";

// ── Payload de teste ──────────────────────────────────────────────────────────

const TEST_PAYLOAD: PrintOrderPayload = {
  orderId:      "00000000-0000-0000-0000-000000000001",
  publicId:     "TESTE-001",
  customerName: "Cliente Teste",
  phone:        "(11) 99999-9999",
  address:      "",
  complement:   null,
  cep:          "00000-000",
  paymentMethod: "PIX",
  totalCents:   2500,
  subtotalCents: 2500,
  deliveryCents: 0,
  cashGivenCents: null,
  changeCents:  null,
  isPhoneOrder: false,
  createdAtUtc: new Date().toISOString(),
  items: [
    { name: "Cappuccino Quente",  qty: 1, unitCents: 1500 },
    { name: "Pão de Queijo",      qty: 2, unitCents:  500 },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ ok, pulse }: { ok: boolean; pulse?: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"} ${pulse && ok ? "animate-pulse" : ""}`}
    />
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${className}`}
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function MobilePrintAgentPage() {
  const { connected: signalrConnected } = usePrintStatus();

  const [isAgent,     setIsAgent]      = useState<boolean>(isMobileAgent);
  const [mode,        setMode]         = useState<MobilePrintMode>(getMobileMode);
  const [paper,       setPaper]        = useState<PaperWidth>(getMobilePaper);
  const [btDevice,    setBtDevice]     = useState<string | null>(connectedBluetoothDevice);
  const [btConnecting, setBtConnecting] = useState(false);
  const [btError,     setBtError]      = useState<string | null>(null);
  const [printing,    setPrinting]     = useState(false);
  const [printResult, setPrintResult]  = useState<"ok" | "err" | null>(null);
  const [log,         setLog]          = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString("pt-BR");
    setLog((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 20));
  }, []);

  // Sincroniza localStorage
  useEffect(() => { setMobileAgent(isAgent); }, [isAgent]);
  useEffect(() => { setMobileMode(mode); }, [mode]);
  useEffect(() => { setMobilePaper(paper); }, [paper]);

  // Atualiza nome do dispositivo BT periodicamente
  useEffect(() => {
    const id = setInterval(() => setBtDevice(connectedBluetoothDevice()), 3000);
    return () => clearInterval(id);
  }, []);

  async function handleConnectBluetooth() {
    setBtError(null);
    setBtConnecting(true);
    try {
      const name = await connectBluetoothPrinter();
      setBtDevice(name);
      addLog(`✓ Impressora conectada: ${name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBtError(msg);
      addLog(`✗ Erro Bluetooth: ${msg}`);
    } finally {
      setBtConnecting(false);
    }
  }

  function handleDisconnectBluetooth() {
    disconnectBluetooth();
    setBtDevice(null);
    addLog("Impressora Bluetooth desconectada.");
  }

  async function handleTestPrint() {
    setPrinting(true);
    setPrintResult(null);
    try {
      await mobilePrint(TEST_PAYLOAD, "test-job");
      setPrintResult("ok");
      addLog("✓ Impressão de teste enviada com sucesso.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPrintResult("err");
      addLog(`✗ Erro na impressão de teste: ${msg}`);
    } finally {
      setPrinting(false);
      setTimeout(() => setPrintResult(null), 4000);
    }
  }

  const btSupported  = isBluetoothSupported();
  const canTestPrint = isAgent && (mode === "browser" || (mode === "bluetooth" && !!btDevice));

  return (
    <div
      className="min-h-screen pb-10"
      style={{ backgroundColor: "var(--bg)" }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 border-b px-4 h-14 flex items-center gap-3"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <Link
          to="/app/impressao"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <Smartphone size={18} style={{ color: "var(--brand)" }} />
          <span className="font-bold text-sm" style={{ color: "var(--text)" }}>
            Agente de Impressão Mobile
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

        {/* ── Status SignalR ───────────────────────────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusDot ok={signalrConnected} pulse />
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {signalrConnected ? "Conectado ao servidor" : "Aguardando conexão…"}
              </span>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{
                backgroundColor: signalrConnected ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.10)",
                color: signalrConnected ? "#10b981" : "#f87171",
              }}
            >
              SignalR
            </span>
          </div>
          {!signalrConnected && (
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Faça login no admin em outra aba para manter a conexão ativa.
            </p>
          )}
        </Card>

        {/* ── Ativar agente ────────────────────────────────────────────────── */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                Agente mobile ativo
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Este tablet imprimirá automaticamente ao receber novos pedidos
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAgent((v) => !v)}
              className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${isAgent ? "bg-brand" : "bg-gray-300"}`}
              aria-label={isAgent ? "Desativar agente" : "Ativar agente"}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isAgent ? "left-6.5" : "left-0.5"}`}
                style={{ left: isAgent ? "calc(100% - 22px)" : "2px" }}
              />
            </button>
          </div>
        </Card>

        {/* ── Modo de impressão ────────────────────────────────────────────── */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Settings size={16} style={{ color: "var(--brand)" }} />
            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
              Modo de impressão
            </p>
          </div>

          <div className="space-y-2">
            {/* Bluetooth */}
            <button
              type="button"
              onClick={() => setMode("bluetooth")}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                mode === "bluetooth"
                  ? "border-brand bg-brand/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Bluetooth
                size={20}
                className="mt-0.5 shrink-0"
                style={{ color: mode === "bluetooth" ? "var(--brand)" : "var(--text-muted)" }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                  Bluetooth (Android)
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Impressão silenciosa, sem dialog. Chrome no Android com impressora BLE.
                </p>
                {!btSupported && mode === "bluetooth" && (
                  <p className="mt-1 text-xs text-amber-600 font-semibold">
                    Web Bluetooth não disponível neste navegador
                  </p>
                )}
              </div>
              {mode === "bluetooth" && (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: "var(--brand)" }} />
              )}
            </button>

            {/* Browser / AirPrint */}
            <button
              type="button"
              onClick={() => setMode("browser")}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                mode === "browser"
                  ? "border-brand bg-brand/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Printer
                size={20}
                className="mt-0.5 shrink-0"
                style={{ color: mode === "browser" ? "var(--brand)" : "var(--text-muted)" }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                  Navegador / AirPrint (Android + iPad)
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Abre o dialog de impressão do sistema. Compatível com AirPrint no iPad.
                  O usuário toca "Imprimir" uma vez por pedido.
                </p>
              </div>
              {mode === "browser" && (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" style={{ color: "var(--brand)" }} />
              )}
            </button>
          </div>
        </Card>

        {/* ── Seção Bluetooth ──────────────────────────────────────────────── */}
        {mode === "bluetooth" && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              {btDevice
                ? <BluetoothConnected size={16} className="text-emerald-400" />
                : <BluetoothOff size={16} style={{ color: "var(--text-muted)" }} />
              }
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                Impressora Bluetooth
              </p>
            </div>

            {btDevice ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <StatusDot ok pulse />
                  <span className="text-sm font-semibold text-emerald-700">{btDevice}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectBluetooth}
                  className="w-full h-10 rounded-xl border text-sm font-semibold transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  Desconectar impressora
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleConnectBluetooth}
                  disabled={!btSupported || btConnecting}
                  className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  style={{ background: "var(--brand)" }}
                >
                  <Bluetooth size={16} />
                  {btConnecting ? "Conectando…" : "Conectar Impressora Bluetooth"}
                </button>

                {btError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{btError}</p>
                  </div>
                )}

                {!btSupported && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Web Bluetooth requer <strong>Chrome no Android</strong>.
                      Safari (iOS/iPadOS) não suporta esta tecnologia.
                      Use o modo Navegador/AirPrint para iPad.
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ── Largura do papel ─────────────────────────────────────────────── */}
        {mode === "bluetooth" && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Wifi size={16} style={{ color: "var(--brand)" }} />
              <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                Largura do papel
              </p>
            </div>
            <div className="flex gap-2">
              {([58, 80] as PaperWidth[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPaper(w)}
                  className={`flex-1 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${
                    paper === w
                      ? "border-brand text-brand bg-brand/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  style={{ color: paper === w ? "var(--brand)" : "var(--text-muted)" }}
                >
                  {w} mm
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Impressoras portáteis usam geralmente 58 mm. Impressoras de balcão usam 80 mm.
            </p>
          </Card>
        )}

        {/* ── Teste de impressão ───────────────────────────────────────────── */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <TestTube2 size={16} style={{ color: "var(--brand)" }} />
            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
              Impressão de teste
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestPrint}
            disabled={!canTestPrint || printing}
            className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{
              background: printResult === "ok"
                ? "#10b981"
                : printResult === "err"
                ? "#f87171"
                : "var(--brand)",
            }}
          >
            {printing ? (
              "Imprimindo…"
            ) : printResult === "ok" ? (
              <><CheckCircle2 size={16} /> Impresso com sucesso</>
            ) : printResult === "err" ? (
              <><AlertCircle size={16} /> Erro na impressão</>
            ) : (
              <><Printer size={16} /> Imprimir Teste</>
            )}
          </button>

          {!isAgent && (
            <p className="mt-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>
              Ative o agente mobile acima para habilitar a impressão.
            </p>
          )}
          {isAgent && mode === "bluetooth" && !btDevice && (
            <p className="mt-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>
              Conecte uma impressora Bluetooth acima para testar.
            </p>
          )}
        </Card>

        {/* ── Log ─────────────────────────────────────────────────────────── */}
        {log.length > 0 && (
          <Card>
            <p className="font-bold text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              LOG DE ATIVIDADE
            </p>
            <div className="space-y-1">
              {log.map((entry, i) => (
                <p key={i} className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  {entry}
                </p>
              ))}
            </div>
          </Card>
        )}

        {/* ── Info ─────────────────────────────────────────────────────────── */}
        <Card className="border-dashed">
          <div className="flex items-start gap-2">
            <Info size={14} className="shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
            <div className="space-y-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <p>
                <strong>Bluetooth</strong> — Chrome no Android. Compatível com impressoras BLE
                (Elgin, Bematech, Xprinter, GOOJPRT e similares). A impressão é 100% silenciosa.
              </p>
              <p>
                <strong>AirPrint</strong> — Safari/Chrome no iPad ou Android. Compatível com
                impressoras que suportam AirPrint (Epson TM-m30, Star mPOP, Brother PJ).
                Exibe um dialog de impressão uma vez por pedido.
              </p>
              <p>
                Mantenha esta aba aberta no tablet para receber os pedidos em tempo real.
              </p>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
