import { MODULE_GROUPS } from "@/config/modules";
import type { AppModule, ModuleGroup } from "@/config/modules";
import { ModuleCard } from "./ModuleCard";

interface Props {
  group: ModuleGroup;
  modules: AppModule[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onNavigate: (id: string) => void;
}

export function ModuleGroupSection({
  group,
  modules,
  favorites,
  onToggleFavorite,
  onNavigate,
}: Props) {
  if (modules.length === 0) return null;

  const meta = MODULE_GROUPS[group];

  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          {meta.label}
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {modules.map((mod) => (
          <ModuleCard
            key={mod.id}
            module={mod}
            isFavorite={favorites.includes(mod.id)}
            onToggleFavorite={onToggleFavorite}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}
