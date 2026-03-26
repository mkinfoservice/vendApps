import { useQuery } from '@tanstack/react-query';
import { fetchCategories, fetchProducts, fetchStoreFront } from './api';
import type { Category, Product, StoreFrontConfig } from './api';

export function useCategories() {
    return useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: fetchCategories,
    });
}

export function useProducts(categorySlug?: string, search?: string) {
    return useQuery<Product[]>({
        queryKey: ["products", categorySlug ?? "", search ?? ""],
        queryFn: () => fetchProducts(categorySlug, search),
    });
}

export function useProduct(id: string) {
    return useQuery<Product | undefined>({
        queryKey: ["product", id],
        queryFn: async () => {
            const products = await fetchProducts();
            return products.find((p) => p.id === id);
        },
        enabled: !!id,
    });
}

export function useStoreFront() {
    return useQuery<StoreFrontConfig>({
        queryKey: ["storefront"],
        queryFn: fetchStoreFront,
        staleTime: 5 * 60 * 1000,
    });
}