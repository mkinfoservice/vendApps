import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Slot para um botão de ação (ex: "Criar primeiro pedido") */
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ backgroundColor: "var(--surface-2)" }}
        >
          <Icon size={26} style={{ color: "var(--text-muted)" }} />
        </div>
      )}
      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </p>
      {description && (
        <p
          className="text-xs mt-1 max-w-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
