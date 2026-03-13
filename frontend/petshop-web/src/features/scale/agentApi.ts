import { adminFetch } from "@/features/admin/auth/adminFetch";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScaleAgentListItem {
  id: string;
  machineName: string;
  isOnline: boolean;
  lastSeenUtc: string | null;
  deviceCount: number;
  notes: string | null;
}

export interface ScaleDeviceDto {
  id: string;
  name: string;
  scaleModel: string;
  portName: string;
  baudRate: number;
  isActive: boolean;
  lastSyncUtc: string | null;
}

export interface ScaleAgentDetail extends ScaleAgentListItem {
  agentKey: string;
  devices: ScaleDeviceDto[];
}

// ── Agents ────────────────────────────────────────────────────────────────────

export function listAgents(): Promise<ScaleAgentListItem[]> {
  return adminFetch("/admin/scale/agents");
}

export function getAgent(id: string): Promise<ScaleAgentDetail> {
  return adminFetch(`/admin/scale/agents/${id}`);
}

export function createAgent(payload: {
  machineName: string;
  notes?: string;
}): Promise<{ id: string; agentKey: string }> {
  return adminFetch("/admin/scale/agents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAgent(
  id: string,
  payload: { machineName: string; notes?: string }
): Promise<void> {
  return adminFetch(`/admin/scale/agents/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteAgent(id: string): Promise<void> {
  return adminFetch(`/admin/scale/agents/${id}`, { method: "DELETE" });
}

export function regenerateKey(id: string): Promise<{ agentKey: string }> {
  return adminFetch(`/admin/scale/agents/${id}/regenerate-key`, { method: "POST" });
}

// ── Devices ───────────────────────────────────────────────────────────────────

export function addDevice(
  agentId: string,
  payload: { name: string; scaleModel: string; portName: string; baudRate: number }
): Promise<{ id: string }> {
  return adminFetch(`/admin/scale/agents/${agentId}/devices`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDevice(
  agentId: string,
  deviceId: string,
  payload: { name: string; scaleModel: string; portName: string; baudRate: number; isActive: boolean }
): Promise<void> {
  return adminFetch(`/admin/scale/agents/${agentId}/devices/${deviceId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteDevice(agentId: string, deviceId: string): Promise<void> {
  return adminFetch(`/admin/scale/agents/${agentId}/devices/${deviceId}`, { method: "DELETE" });
}

export function triggerSync(agentId: string, deviceId: string): Promise<{ message: string }> {
  return adminFetch(`/admin/scale/agents/${agentId}/devices/${deviceId}/sync`, { method: "POST" });
}
