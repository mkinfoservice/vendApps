type Category = {
  id: string;
  name: string;
  slug: string;
};

function categoryEmoji(name: string): string {
  const n = name.toLocaleLowerCase();
  if (n.includes("todos") || n === "") return "🏠";
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
  const emoji = categoryEmoji(c.name);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all shrink-0 select-none",
        active
          ? "text-white shadow-md"
          : "bg-white text-gray-700 border border-gray-200 hover:border-[#7c5cf8] hover:text-[#7c5cf8] active:scale-95",
      ].join(" ")}
      style={
        active
          ? { background: "linear-gradient(135deg, #7c5cf8, #6d4df2)", boxShadow: "0 4px 12px rgba(124,92,248,0.3)" }
          : undefined
      }
    >
      <span className="text-base leading-none">{emoji}</span>
      <span>{c.name}</span>
    </button>
  );
}
