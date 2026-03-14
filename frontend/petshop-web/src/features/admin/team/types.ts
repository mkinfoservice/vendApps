export type StoreUserDto = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  isActive: boolean;
  lastLoginAtUtc: string | null;
  createdAtUtc: string;
};

export const ROLE_LABELS: Record<string, string> = {
  admin:     "Admin",
  gerente:   "Gerente",
  atendente: "Atendente",
};

export const ROLE_COLORS: Record<string, string> = {
  admin:     "bg-purple-900/30 text-purple-400",
  gerente:   "bg-blue-900/30 text-blue-400",
  atendente: "bg-green-900/30 text-green-400",
};
