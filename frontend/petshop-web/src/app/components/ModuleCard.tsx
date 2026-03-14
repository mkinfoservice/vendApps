import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import type { AppModule } from "@/config/modules";

interface Props {
  module: AppModule;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onNavigate: (id: string) => void;
}

export function ModuleCard({
  module,
  isFavorite,
  onToggleFavorite,
  onNavigate,
}: Props) {
  const Icon = module.icon;

  return (
    <Link
      to={module.route}
      onClick={() => onNavigate(module.id)}
      className="group relative flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor =
          module.iconColor + "55";
        (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${module.iconColor}18`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Favorite button — visible on hover */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite(module.id);
        }}
        className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
        style={{
          color: isFavorite ? "#f59e0b" : "var(--text-muted)",
          backgroundColor: isFavorite
            ? "rgba(245,158,11,0.12)"
            : "var(--surface-2)",
        }}
        title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        <Star
          size={12}
          fill={isFavorite ? "#f59e0b" : "none"}
          stroke={isFavorite ? "#f59e0b" : "currentColor"}
          strokeWidth={2.5}
        />
      </button>

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: module.iconBg }}
      >
        <Icon size={20} style={{ color: module.iconColor }} />
      </div>

      {/* Text */}
      <div className="min-w-0">
        <p
          className="text-sm font-semibold leading-tight"
          style={{ color: "var(--text)" }}
        >
          {module.label}
        </p>
        <p
          className="text-xs mt-0.5 leading-snug line-clamp-2"
          style={{ color: "var(--text-muted)" }}
        >
          {module.description}
        </p>
      </div>
    </Link>
  );
}
