import { useEffect, useState, useCallback } from "react";
import {
  listAgents, getAgent, createAgent, deleteAgent, regenerateKey,
  addDevice, deleteDevice, triggerSync,
  type ScaleAgentListItem, type ScaleAgentDetail, type ScaleDeviceDto,
} from "@/features/scale/agentApi";

const SCALE_MODELS = ["FilizolaP", "FilizolaST", "TolVdo", "Generic"] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeSince(iso: string | null): string {
  if (!iso) return "nunca";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s atrás`;
  if (secs < 3600) return `${Math.floor(secs / 60)}min atrás`;
  return `${Math.floor(secs / 3600)}h atrás`;
}

// ── Device row ────────────────────────────────────────────────────────────────

function DeviceRow({
  agentId, device, onRefresh,
}: { agentId: string; device: ScaleDeviceDto; onRefresh: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setMsg(null);
    try {
      const r = await triggerSync(agentId, device.id);
      setMsg(r.message);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remover dispositivo "${device.name}"?`)) return;
    await deleteDevice(agentId, device.id);
    onRefresh();
  }

  return (
    <tr className="border-b last:border-0 text-sm" style={{ borderColor: "var(--border)" }}
      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--surface-2)"}
      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = ""}
    >
      <td className="px-4 py-2 font-medium" style={{ color: "var(--text)" }}>{device.name}</td>
      <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{device.scaleModel}</td>
      <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{device.portName} / {device.baudRate}</td>
      <td className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>{timeSince(device.lastSyncUtc)}</td>
      <td className="px-3 py-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${device.isActive ? "bg-green-900/30 text-green-400" : "bg-gray-900/30 text-gray-400"}`}>
          {device.isActive ? "ativo" : "inativo"}
        </span>
      </td>
      <td className="px-3 py-2 flex gap-2 items-center">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-xs px-3 py-1 rounded-lg bg-[#7c5cf8] text-white disabled:opacity-40"
        >
          {syncing ? "..." : "Sincronizar"}
        </button>
        <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-xs">✕</button>
        {msg && <span className="text-xs text-gray-500 ml-1">{msg}</span>}
      </td>
    </tr>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({
  agent, onRefresh,
}: { agent: ScaleAgentListItem; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail]     = useState<ScaleAgentDetail | null>(null);
  const [showKey, setShowKey]   = useState(false);
  const [addingDevice, setAddingDevice] = useState(false);
  const [form, setForm] = useState({
    name: "", scaleModel: "FilizolaP", portName: "COM1", baudRate: 9600,
  });

  const loadDetail = useCallback(async () => {
    const d = await getAgent(agent.id);
    setDetail(d);
  }, [agent.id]);

  useEffect(() => {
    if (expanded) loadDetail();
  }, [expanded, loadDetail]);

  async function handleRegenKey() {
    if (!confirm("Gerar nova AgentKey? A chave antiga deixará de funcionar.")) return;
    await regenerateKey(agent.id);
    loadDetail();
  }

  async function handleDelete() {
    if (!confirm(`Remover agente "${agent.machineName}"?`)) return;
    await deleteAgent(agent.id);
    onRefresh();
  }

  async function handleAddDevice(e: React.FormEvent) {
    e.preventDefault();
    await addDevice(agent.id, {
      name: form.name, scaleModel: form.scaleModel,
      portName: form.portName, baudRate: form.baudRate,
    });
    setAddingDevice(false);
    setForm({ name: "", scaleModel: "FilizolaP", portName: "COM1", baudRate: 9600 });
    loadDetail();
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${agent.isOnline ? "bg-green-400" : "bg-gray-400"}`} />
        <span className="font-semibold" style={{ color: "var(--text)" }}>{agent.machineName}</span>
        <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>
          {agent.isOnline ? "online" : `offline — ${timeSince(agent.lastSeenUtc)}`}
        </span>
        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>{agent.deviceCount} dispositivo(s)</span>
        <button
          onClick={e => { e.stopPropagation(); handleDelete(); }}
          className="text-red-400 hover:text-red-600 text-sm ml-2"
        >
          ✕
        </button>
        <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Detail */}
      {expanded && detail && (
        <div className="border-t px-5 py-4 space-y-4" style={{ borderColor: "var(--border)" }}>
          {/* AgentKey */}
          <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: "var(--surface-2)" }}>
            <span className="text-xs font-medium w-24" style={{ color: "var(--text-muted)" }}>AgentKey</span>
            <code className="flex-1 text-xs font-mono break-all" style={{ color: "var(--text)" }}>
              {showKey ? detail.agentKey : "••••••••••••••••••••••••••••••••"}
            </code>
            <button
              className="text-xs text-[#7c5cf8]"
              onClick={() => setShowKey(v => !v)}
            >
              {showKey ? "ocultar" : "mostrar"}
            </button>
            <button
              className="text-xs text-gray-400 hover:text-red-500"
              onClick={handleRegenKey}
            >
              regenerar
            </button>
          </div>

          {/* Devices table */}
          {detail.devices.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b" style={{ borderColor: "var(--border)" }}>
                <tr className="text-left text-xs" style={{ color: "var(--text-muted)" }}>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-3 py-2">Modelo</th>
                  <th className="px-3 py-2">Porta / Baud</th>
                  <th className="px-3 py-2">Último sync</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {detail.devices.map(d => (
                  <DeviceRow key={d.id} agentId={agent.id} device={d} onRefresh={loadDetail} />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-center py-2" style={{ color: "var(--text-muted)" }}>Nenhum dispositivo cadastrado.</p>
          )}

          {/* Add device form */}
          {addingDevice ? (
            <form onSubmit={handleAddDevice} className="grid grid-cols-2 gap-3 mt-2">
              <input
                required
                placeholder="Nome (ex: Balança Açougue)"
                className="col-span-2 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              <select
                className="rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                value={form.scaleModel}
                onChange={e => setForm(f => ({ ...f, scaleModel: e.target.value }))}
              >
                {SCALE_MODELS.map(m => <option key={m}>{m}</option>)}
              </select>
              <input
                placeholder="Porta (COM1)"
                className="rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                value={form.portName}
                onChange={e => setForm(f => ({ ...f, portName: e.target.value }))}
              />
              <input
                type="number"
                placeholder="Baudrate"
                className="rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                value={form.baudRate}
                onChange={e => setForm(f => ({ ...f, baudRate: Number(e.target.value) }))}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-white text-sm"
                  style={{ background: "#7c5cf8" }}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setAddingDevice(false)}
                  className="px-4 py-2 rounded-xl text-sm"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAddingDevice(true)}
              className="text-sm text-[#7c5cf8] hover:underline"
            >
              + Adicionar dispositivo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScaleAgentsPage() {
  const [agents, setAgents]     = useState<ScaleAgentListItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [newName, setNewName]   = useState("");
  const [newResult, setNewResult] = useState<{ agentKey: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listAgents();
    setAgents(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const r = await createAgent({ machineName: newName });
    setNewResult({ agentKey: r.agentKey });
    setNewName("");
    load();
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Agentes de Balança</h1>
          <button
            onClick={() => setShowNew(v => !v)}
            className="ml-auto px-4 py-2 rounded-xl text-white text-sm font-medium"
            style={{ background: "linear-gradient(135deg,#7c5cf8,#6d4df2)" }}
          >
            + Novo agente
          </button>
        </div>

        {/* New agent form */}
        {showNew && (
          <div className="rounded-2xl border p-5 space-y-3" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="font-semibold" style={{ color: "var(--text)" }}>Registrar novo agente</h2>
            <form onSubmit={handleCreate} className="flex gap-3">
              <input
                required
                placeholder="Nome do PC (ex: PC Frente de Caixa)"
                className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface-2)", color: "var(--text)" }}
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-white text-sm font-medium"
                style={{ background: "#7c5cf8" }}
              >
                Criar
              </button>
            </form>
            {newResult && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm space-y-1">
                <p className="font-semibold text-yellow-800">Agente criado! Copie a AgentKey abaixo:</p>
                <code className="block font-mono text-yellow-900 break-all">{newResult.agentKey}</code>
                <p className="text-yellow-600 text-xs">Cole em <code>appsettings.json</code> do serviço Windows.</p>
              </div>
            )}
          </div>
        )}

        {/* List */}
        {loading ? (
          <p className="text-center py-8" style={{ color: "var(--text-muted)" }}>Carregando...</p>
        ) : agents.length === 0 ? (
          <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <p className="text-lg mb-2">Nenhum agente registrado</p>
            <p className="text-sm">Instale o serviço Windows em um PC da loja e registre-o aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map(a => <AgentCard key={a.id} agent={a} onRefresh={load} />)}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-800 space-y-2">
          <p className="font-semibold">Como instalar o Scale Agent</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Registre um agente acima e copie a <code className="font-mono">AgentKey</code>.</li>
            <li>Baixe o serviço Windows <code className="font-mono">ScaleAgent.zip</code> e extraia.</li>
            <li>Edite <code className="font-mono">appsettings.json</code> e cole a AgentKey.</li>
            <li>Execute <code className="font-mono">sc create vendApps-scale "path\to\ScaleAgent.exe"</code>.</li>
            <li>Inicie o serviço: <code className="font-mono">sc start vendApps-scale</code>.</li>
            <li>O agente aparecerá como <strong>online</strong> aqui em alguns segundos.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
