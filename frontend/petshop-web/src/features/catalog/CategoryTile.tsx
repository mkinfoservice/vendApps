type Category = {
  id: string;
  name: string;
  slug: string;
};

function categoryEmoji(name: string): string {
  const n = name.toLocaleLowerCase();
  if (n.includes("todos") || n === "") return "🏠";
  if (n.includes("ração") || n.includes("racao") || n.includes("aliment") || n.includes("petisco")) return "🍖";
  if (n.includes("brinquedo")) return "🧸";
  if (n.includes("remédio") || n.includes("remedio") || n.includes("medicament") || n.includes("analgés") || n.includes("antibi")) return "💊";
  if (n.includes("acessório") || n.includes("acessorio") || n.includes("coleira") || n.includes("guia")) return "🛍️";
  if (n.includes("higiene") || n.includes("shampoo") || n.includes("banho") || n.includes("tosa")) return "🧼";
  if (n.includes("cama") || n.includes("casinha") || n.includes("conforto")) return "🛏️";
  if (n.includes("adestrad") || n.includes("treino")) return "🎯";
  if (n.includes("antiparasit") || n.includes("pulga") || n.includes("carrapath") || n.includes("vermíf") || n.includes("vermif")) return "🛡️";
  if (n.includes("cirurg") || n.includes("curativo") || n.includes("hemor")) return "🩺";
  if (n.includes("suplemento") || n.includes("vitamina") || n.includes("mineral")) return "💪";
  if (n.includes("aquário") || n.includes("aquario") || n.includes("peixe")) return "🐠";
  if (n.includes("ave") || n.includes("pássaro") || n.includes("passaro")) return "🦜";
  if (n.includes("roedor") || n.includes("hamster") || n.includes("coelho")) return "🐹";
  if (n.includes("gato") || n.includes("felino") || n.includes("gatil")) return "🐱";
  if (n.includes("cão") || n.includes("cao") || n.includes("canino") || n.includes("cachorro")) return "🐕";
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
      className={[
        "inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all shrink-0 select-none",
        active
          ? "text-white shadow-md"
          : "bg-white text-gray-700 border border-gray-200 hover:border-[var(--brand)] hover:text-[var(--brand)] active:scale-95",
      ].join(" ")}
      style={
        active
          ? { background: "var(--brand)", boxShadow: "0 4px 12px color-mix(in srgb, var(--brand) 40%, transparent)" }
          : undefined
      }
    >
      {emoji && <span className="text-base leading-none">{emoji}</span>}
      <span>{c.name}</span>
    </button>
  );
}
