type Category = {
  id: string;
  name: string;
  slug: string;
};

function firstEmoji(name: string) {
  const n = name.toLocaleLowerCase();
  if (n.includes("ração")) return "🍖";
  if (n.includes("brinquedo")) return "🧸";
  if (n.includes("remédio")) return "💊";
  if (n.includes("acessório")) return "🛍️";
  if (n.includes("higiene")) return "🧼";
  if (n.includes("cama")) return "🐾";
  return "🐾";
}

export function CategoryTile({
  c,
  active,
  onClick,
}: {
  c: Category;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[132px] h-[110px] rounded-2xl border text-left p-3 transition"
      style={{
        backgroundColor: active ? "rgba(124,92,248,0.1)" : "var(--surface)",
        borderColor: active ? "#7c5cf8" : "var(--border)",
        boxShadow: active ? "0 0 0 1px #7c5cf8" : undefined,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="text-2xl leading-none">{firstEmoji(c.name)}</div>
        {active ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: "#7c5cf8", color: "#fff" }}
          >
            Ativa
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-sm font-extrabold text-[var(--text)] line-clamp-2">{c.name}</div>
      <div className="mt-1 text-xs text-[var(--text-muted)]">Ver produtos</div>
    </button>
  );
}
