type Category = {
  id: string;
  name: string;
  slug: string;
};

function categoryEmoji(name: string): string {
  const n = name.toLocaleLowerCase();
  if (n.includes("todos") || n === "") return "☕";
  if (n.includes("café") || n.includes("cafe") || n.includes("espresso") || n.includes("cappuccino")) return "☕";
  if (n.includes("gelad") || n.includes("ice") || n.includes("frap") || n.includes("frio")) return "🧊";
  if (n.includes("quente") || n.includes("quen")) return "🔥";
  if (n.includes("doce") || n.includes("bolo") || n.includes("brownie") || n.includes("waffle") || n.includes("sobremesa")) return "🍰";
  if (n.includes("salgado") || n.includes("lanche") || n.includes("sanduiche") || n.includes("wrap")) return "🥪";
  if (n.includes("bebida") || n.includes("drink") || n.includes("smoothie") || n.includes("suco")) return "🥤";
  if (n.includes("ração") || n.includes("racao") || n.includes("aliment") || n.includes("petisco")) return "🍖";
  if (n.includes("brinquedo")) return "🧸";
  if (n.includes("remédio") || n.includes("remedio") || n.includes("medicament")) return "💊";
  if (n.includes("acessório") || n.includes("acessorio") || n.includes("coleira")) return "🛍️";
  if (n.includes("higiene") || n.includes("shampoo") || n.includes("banho")) return "🧼";
  return "";
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
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shrink-0 select-none active:scale-95"
      style={active
        ? {
            background: "var(--brand)",
            color: "#fff",
            boxShadow: "0 4px 14px rgba(200,149,58,0.38)",
          }
        : {
            background: "var(--surface)",
            color: "var(--text-muted)",
            border: "1.5px solid var(--border)",
          }
      }
    >
      {emoji && <span className="text-base leading-none">{emoji}</span>}
      <span>{c.name}</span>
    </button>
  );
}
