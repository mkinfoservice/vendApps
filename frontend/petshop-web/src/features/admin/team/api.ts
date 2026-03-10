import { adminFetch } from "@/features/admin/auth/adminFetch";
import type { StoreUserDto } from "./types";

export function fetchTeam(includeInactive = false) {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return adminFetch<StoreUserDto[]>(`/admin/team${qs}`);
}

export function createMember(body: {
  username: string;
  password: string;
  email?: string;
  role: string;
}) {
  return adminFetch<StoreUserDto>("/admin/team", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateMember(
  id: string,
  body: { email?: string; newPassword?: string },
) {
  return adminFetch<StoreUserDto>(`/admin/team/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deactivateMember(id: string) {
  return adminFetch<void>(`/admin/team/${id}`, { method: "DELETE" });
}

export function reactivateMember(id: string) {
  return adminFetch<StoreUserDto>(`/admin/team/${id}/reactivate`, { method: "POST" });
}
