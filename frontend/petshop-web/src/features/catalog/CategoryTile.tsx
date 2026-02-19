import { Badge } from "@/components/ui/badge";

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
        className={[
             "min-w-[132px] h-[110px] rounded-2xl border text-left p-3 transition",
        "bg-white/5 border-white/10 hover:bg-white/10",
        active ? "ring-2 ring-emerald-400/60 border-emerald-400/30" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between">
        <div className="text-2xl leading-none">{firstEmoji(c.name)}</div>
        {active ? <Badge className="bg-emerald-500 text-black">Ativa</Badge> : null}
      </div>

      <div className="mt-3 text-sm font-extrabold text-white line-clamp-2">{c.name}</div>
      <div className="mt-1 text-xs text-white/60">Ver produtos</div>
    </button>
  );
}
