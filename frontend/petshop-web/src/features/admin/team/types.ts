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
  admin:     "bg-purple-100 text-purple-700",
  gerente:   "bg-blue-100 text-blue-700",
  atendente: "bg-green-100 text-green-700",
};
