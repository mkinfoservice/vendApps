import { Link, useLocation } from "react-router-dom";
import { LayoutGrid } from "lucide-react";
import { APP_MODULES, MODULE_GROUPS, getGroupOrder, canAccess } from "@/config/modules";
import type { AppModule, ModuleGroup } from "@/config/modules";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Módulos vizinhos visíveis na sidebar — todos do mesmo grupo que o usuário pode acessar
function useSidebarModules(): { group: ModuleGroup; modules: AppModule[] } | null {
  const { pathname } = useLocation();
  const { role } = useCurrentUser();

  const currentModule = APP_MODULES.find(
    (m) => pathname === m.route || pathname.startsWith(m.route + "/"),
  );

  if (!currentModule) return null;

  const groupOrder = getGroupOrder();
  const groupModules = APP_MODULES.filter(
    (m) => m.group === currentModule.group && m.isActive && canAccess(m, role),
  );

  // Mantém a ordem do grupo
  const ordered = groupOrder.flatMap((g) =>
    g === currentModule.group ? groupModules : [],
  );

  return { group: currentModule.group, modules: ordered };
}

function SidebarLink({ module }: { module: AppModule }) {
  const { pathname } = useLocation();
  const Icon = module.icon;
  const isActive =
    pathname === module.route || pathname.startsWith(module.route + "/");

  return (
    <Link
      to={module.route}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
      style={{
        backgroundColor: isActive ? module.iconBg : "transparent",
        color: isActive ? module.iconColor : "var(--text-muted)",
        fontWeight: isActive ? 600 : 400,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "var(--surface-2)";
          (e.currentTarget as HTMLElement).style.color = "var(--text)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
        }
      }}
    >
      <Icon size={15} />
      <span className="truncate">{module.label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const sidebar = useSidebarModules();

  // Na Central de Operações não há sidebar
  if (!sidebar) return null;

  const groupMeta = MODULE_GROUPS[sidebar.group];

  return (
    <aside
      className="w-48 shrink-0 hidden lg:flex flex-col gap-1 px-3 pt-6 pb-6 sticky top-14 self-start h-[calc(100dvh-3.5rem)] overflow-y-auto border-r"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Voltar à Central */}
      <Link
        to="/app"
        className="flex items-center gap-2 px-3 py-1.5 mb-2 text-xs font-semibold rounded-lg transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text)";
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "var(--surface-2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
        }}
      >
        <LayoutGrid size={13} />
        Central
      </Link>

      {/* Divider */}
      <div
        className="h-px mx-3 mb-2"
        style={{ backgroundColor: "var(--border)" }}
      />

      {/* Group label */}
      <p
        className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {groupMeta.label}
      </p>

      {/* Module links */}
      {sidebar.modules.map((mod) => (
        <SidebarLink key={mod.id} module={mod} />
      ))}
    </aside>
  );
}
