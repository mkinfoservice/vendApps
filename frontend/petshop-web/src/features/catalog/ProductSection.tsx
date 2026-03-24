import type { ReactNode } from "react";
import { ProductCard } from "./ProductCard";
import type { Product } from "./api";

type Props = {
  title: ReactNode;
  products: Product[];
  onCardClick?: (id: string) => void;
  isDesktop?: boolean;
};

export function ProductSection({ title, products, onCardClick, isDesktop }: Props) {
  if (products.length === 0) return null;

  return (
    <section className="mt-7">
      <h2 className="text-base font-black text-gray-900 mb-3 flex items-center gap-2">
        {title}
      </h2>

      {/* Scroll horizontal em mobile, grid em desktop */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide sm:grid sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        {products.map((p) => (
          <div key={p.id} className="w-44 shrink-0 sm:w-auto">
            <ProductCard
              p={p as any}
              onCardClick={isDesktop ? () => onCardClick?.(p.id) : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
