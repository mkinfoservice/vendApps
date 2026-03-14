import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  total?: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ page, totalPages, total, onPrev, onNext }: Props) {
  if (totalPages <= 1 && !total) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        onMouseEnter={(e) => {
          if (page > 1)
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
        }}
      >
        <ChevronLeft size={15} />
        Anterior
      </button>

      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        Página <strong style={{ color: "var(--text)" }}>{page}</strong> de{" "}
        <strong style={{ color: "var(--text)" }}>{totalPages}</strong>
        {total !== undefined && (
          <span className="hidden sm:inline">
            {" "}
            · {total} {total === 1 ? "item" : "itens"}
          </span>
        )}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={page >= totalPages}
        className="flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        onMouseEnter={(e) => {
          if (page < totalPages)
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
        }}
      >
        Próxima
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
