import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { getRole } from "@/features/admin/auth/auth";
import {
  fetchTeam, createMember, updateMember,
  deactivateMember, reactivateMember,
} from "@/features/admin/team/api";
import { ROLE_LABELS, ROLE_COLORS } from "@/features/admin/team/types";
import type { StoreUserDto } from "@/features/admin/team/types";
import { UserPlus, RefreshCw, Trash2, Pencil } from "lucide-react";

type FormState = {
  username: string;
  password: string;
  email: string;
  role: string;
};

const DEFAULT_FORM: FormState = {
  username: "", password: "", email: "", role: "atendente",
};

export default function StoreTeam() {
  const qc = useQueryClient();
  const callerRole = getRole();
  const [showInactive, setShowInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<StoreUserDto | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editForm, setEditForm] = useState({ email: "", newPassword: "" });
  const [error, setError] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team", showInactive],
    queryFn: () => fetchTeam(showInactive),
  });

  const createMut = useMutation({
    mutationFn: createMember,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); setShowCreate(false); setForm(DEFAULT_FORM); setError(null); },
    onError: (e: Error) => setError(e.message ?? "Erro ao criar membro."),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { email?: string; newPassword?: string } }) =>
      updateMember(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team"] }); setEditUser(null); setError(null); },
    onError: (e: Error) => setError(e.message ?? "Erro ao atualizar membro."),
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });

  const reactivateMut = useMutation({
    mutationFn: reactivateMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });

  const allowedRoles = callerRole === "admin"
    ? ["gerente", "atendente"]
    : ["atendente"];

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username || !form.password) { setError("Username e senha são obrigatórios."); return; }
    createMut.mutate({
      username: form.username,
      password: form.password,
      email: form.email || undefined,
      role: form.role,
    });
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    const body: { email?: string; newPassword?: string } = {};
    if (editForm.email) body.email = editForm.email;
    if (editForm.newPassword) body.newPassword = editForm.newPassword;
    updateMut.mutate({ id: editUser.id, body });
  }

  function openEdit(user: StoreUserDto) {
    setEditUser(user);
    setEditForm({ email: user.email ?? "", newPassword: "" });
    setError(null);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <AdminNav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Equipe</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Gerencie atendentes e gerentes da loja
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 accent-purple-600"
              />
              Incluir inativos
            </label>
            <button
              onClick={() => { setShowCreate(true); setForm(DEFAULT_FORM); setError(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:brightness-110 transition"
            >
              <UserPlus size={16} />
              Novo membro
            </button>
          </div>
        </div>

        {/* Lista */}
        {isLoading ? (
          <p className="text-center py-12" style={{ color: "var(--text-muted)" }}>Carregando...</p>
        ) : members.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed" style={{ borderColor: "var(--border)" }}>
            <p className="font-semibold" style={{ color: "var(--text)" }}>Nenhum membro cadastrado</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Adicione atendentes e gerentes para sua equipe
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Usuário</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Perfil</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Último acesso</th>
                  <th className="text-left px-4 py-3 font-semibold" style={{ color: "var(--text-muted)" }}>Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold" style={{ color: "var(--text)" }}>{m.username}</p>
                      {m.email && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[m.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[m.role] ?? m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                      {m.lastLoginAtUtc
                        ? new Date(m.lastLoginAtUtc).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block w-2 h-2 rounded-full ${m.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        {m.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(m)}
                          title="Editar"
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[--surface-2] transition"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <Pencil size={14} />
                        </button>
                        {m.isActive ? (
                          <button
                            onClick={() => deactivateMut.mutate(m.id)}
                            title="Desativar"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivateMut.mutate(m.id)}
                            title="Reativar"
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 transition text-green-500"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal criar */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-2xl p-6 shadow-xl" style={{ backgroundColor: "var(--surface)" }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text)" }}>Novo membro</h2>
              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
              <form onSubmit={handleCreate} className="space-y-3">
                <input
                  placeholder="Username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                />
                <input
                  type="password"
                  placeholder="Senha (mín. 6 caracteres)"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                />
                <input
                  placeholder="E-mail (opcional)"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                />
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                >
                  {allowedRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setError(null); }}
                    className="flex-1 py-2 rounded-lg border text-sm font-semibold"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createMut.isPending}
                    className="flex-1 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50"
                  >
                    {createMut.isPending ? "Criando..." : "Criar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal editar */}
        {editUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-2xl p-6 shadow-xl" style={{ backgroundColor: "var(--surface)" }}>
              <h2 className="text-lg font-bold mb-1" style={{ color: "var(--text)" }}>Editar {editUser.username}</h2>
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                Perfil: {ROLE_LABELS[editUser.role] ?? editUser.role}
              </p>
              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
              <form onSubmit={handleUpdate} className="space-y-3">
                <input
                  placeholder="E-mail"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                />
                <input
                  type="password"
                  placeholder="Nova senha (deixe em branco para manter)"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm((f) => ({ ...f, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)", color: "var(--text)" }}
                />
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setEditUser(null); setError(null); }}
                    className="flex-1 py-2 rounded-lg border text-sm font-semibold"
                    style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updateMut.isPending}
                    className="flex-1 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50"
                  >
                    {updateMut.isPending ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
