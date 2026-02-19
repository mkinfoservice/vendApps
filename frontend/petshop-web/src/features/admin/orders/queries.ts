import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchOrders, fetchOrderById, updateOrderStatus } from "./api";

// Lista de pedidos com paginação
export function useOrders(page = 1, pageSize = 20, status?: string, search?: string) {
  return useQuery({
    queryKey: ["orders", page, pageSize, status ?? "", search ?? ""],
    queryFn: () => fetchOrders(page, pageSize, status, search),
  });
}

// Detalhe do pedido por ID ou número
export function useOrderById(idOrNumber: string) {
  return useQuery({
    queryKey: ["order", idOrNumber],
    queryFn: () => fetchOrderById(idOrNumber),
    enabled: !!idOrNumber, // evita request quando id vazio
  });
}

// Mutação para atualizar o status do pedido
export function useUpdateOrderStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ idOrNumber, status }: { idOrNumber: string; status: string }) =>
      updateOrderStatus(idOrNumber, status),
    onSuccess: (_, { idOrNumber }) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", idOrNumber] });
    },
  });
}
