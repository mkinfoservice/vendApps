import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { AdminNav } from "@/components/admin/AdminNav";

import { fetchActiveDeliverers, fetchReadyOrders } from "@/features/admin/routes/plannerApi";
import {
  createRoute,
  previewRoutes,
  type PreviewRouteResponse,
} from "@/features/admin/routes/api";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export default function RoutePlanner() {
  const nav = useNavigate();

  const [selectedDelivererId, setSelectedDelivererId] = useState<string>("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewRouteResponse | null>(null);
  const [selectedSide, setSelectedSide] = useState<"A" | "B" | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const deliverersQ = useQuery({
    queryKey: ["deliverers-active"],
    queryFn: fetchActiveDeliverers,
  });

  const ordersQ = useQuery({
    queryKey: ["ready-orders", page, search],
    queryFn: () => fetchReadyOrders(page, 50, search || undefined),
  });

  const previewMut = useMutation({
    mutationFn: () => previewRoutes([...selectedOrderIds]),
    onSuccess: (data) => {
      setPreview(data);
      setSelectedSide(null);
    },
  });

  const createMut = useMutation({
    mutationFn: () =>
      createRoute({
        delivererId: selectedDelivererId,
        orderIds: [...selectedOrderIds],
        routeSide: selectedSide ?? undefined,
      }),
    onSuccess: (data) => {
      nav(`/admin/routes/${data.routeId}`);
    },
  });

  function toggleOrder(id: string) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreview(null);
    setSelectedSide(null);
  }

  const canPreview = selectedOrderIds.size > 0;
  const canCreate = !!selectedDelivererId && selectedOrderIds.size > 0;

  const items = ordersQ.data?.items ?? [];
  const total = ordersQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text)]">
      <AdminNav />
      <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">Criar Rota</div>
            <div className="text-sm text-[var(--text-muted)]">Selecione pedidos e um entregador.</div>
          </div>
          <button
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--surface)] transition"
            onClick={() => nav("/admin/routes")}
          >
            Voltar
          </button>
        </div>

        {/* Entregador */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
          <div className="text-sm font-extrabold">Entregador</div>
          {deliverersQ.isLoading && (
            <div className="text-sm text-[var(--text-muted)]">Carregando entregadores...</div>
          )}
          <select
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
            value={selectedDelivererId}
            onChange={(e) => setSelectedDelivererId(e.target.value)}
          >
            <option value="">Selecione um entregador</option>
            {(deliverersQ.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} • {d.vehicle} • {d.phone}
              </option>
            ))}
          </select>
        </div>

        {/* Pedidos */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold">Pedidos prontos para entrega</div>
            <div className="text-xs text-[var(--text-muted)]">
              {selectedOrderIds.size} selecionado(s)
            </div>
          </div>

          <input
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[#7c5cf8] transition"
            placeholder="Buscar por número, cliente ou CEP..."
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />

          {ordersQ.isLoading && (
            <div className="text-sm text-[var(--text-muted)]">Carregando pedidos...</div>
          )}

          {!ordersQ.isLoading && items.length === 0 && (
            <div className="text-sm text-[var(--text-muted)]">
              Nenhum pedido pronto para entrega encontrado.
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {items.map((o) => {
              const selected = selectedOrderIds.has(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => toggleOrder(o.id)}
                  className="w-full text-left rounded-xl border p-3 transition"
                  style={{
                    borderColor: selected ? "#7c5cf8" : "var(--border)",
                    backgroundColor: selected
                      ? "rgba(124,92,248,0.08)"
                      : "var(--surface-2)",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-2)";
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-extrabold text-[var(--text)]">
                        {o.orderNumber} • {o.customerName}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">{o.address}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        CEP: {o.cep} • {formatDate(o.createdAtUtc)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm font-bold text-[var(--text)]">{formatBRL(o.totalCents)}</span>
                      {o.latitude && o.longitude ? (
                        <Badge className="border-emerald-800 bg-emerald-950/40 text-emerald-300 border rounded-full px-2 py-0.5 text-xs">
                          GPS ✓
                        </Badge>
                      ) : (
                        <Badge className="border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] border rounded-full px-2 py-0.5 text-xs">
                          Sem GPS
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] disabled:opacity-50 hover:bg-[var(--surface-2)] transition"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                Página {page} de {totalPages}
              </span>
              <button
                className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] disabled:opacity-50 hover:bg-[var(--surface-2)] transition"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Próxima
              </button>
            </div>
          )}
        </div>

        {/* Botão preview */}
        {selectedOrderIds.size > 0 && (
          <div className="flex gap-2">
            <button
              className="h-10 px-4 rounded-xl border border-[var(--border)] text-sm font-extrabold text-[var(--text)] hover:bg-[var(--surface)] disabled:opacity-50 transition"
              disabled={!canPreview || previewMut.isPending}
              onClick={() => previewMut.mutate()}
            >
              {previewMut.isPending ? "Calculando..." : "Visualizar rota bidirecional"}
            </button>
          </div>
        )}

        {previewMut.isError && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            Erro ao gerar preview. {String((previewMut.error as any)?.message ?? "")}
          </div>
        )}

        {/* Preview resultado */}
        {preview && (
          <div className="space-y-3">
            <div className="text-sm font-extrabold text-[var(--text)]">
              Prévia da rota — selecione um lado para criar
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-2xl border border-amber-800 bg-amber-950/30 p-3 space-y-1">
                {preview.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-amber-300">⚠ {w}</div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  { key: "A" as const, dto: preview.routeA },
                  { key: "B" as const, dto: preview.routeB },
                ]
              ).map(({ key, dto }) => {
                if (!dto) return null;
                const isSelected = selectedSide === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedSide(key)}
                    className="rounded-2xl border p-4 text-left space-y-2 transition"
                    style={{
                      borderColor: isSelected ? "#7c5cf8" : "var(--border)",
                      backgroundColor: isSelected
                        ? "rgba(124,92,248,0.08)"
                        : "var(--surface)",
                      boxShadow: isSelected ? "0 0 0 1px #7c5cf8" : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-extrabold text-[var(--text)]">Rota {key}</div>
                      <span
                        className="rounded-full border px-2 py-0.5 text-xs"
                        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                      >
                        {dto.totalStops} paradas
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {dto.side} • {dto.direction}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      Distância estimada: {dto.estimatedDistanceKm.toFixed(1)} km
                    </div>
                    <div className="space-y-1 mt-2">
                      {dto.orders.slice(0, 4).map((o) => (
                        <div key={o.orderId} className="text-xs text-[var(--text)]">
                          {o.sequence}. {o.orderNumber} — {o.customerName}
                        </div>
                      ))}
                      {dto.orders.length > 4 && (
                        <div className="text-xs text-[var(--text-muted)]">
                          +{dto.orders.length - 4} mais...
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {preview.unknownOrders.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-1">
                <div className="text-xs font-extrabold text-[var(--text-muted)]">
                  Pedidos sem lado definido ({preview.unknownOrders.length})
                </div>
                {preview.unknownOrders.map((o) => (
                  <div key={o.orderId} className="text-xs text-[var(--text-muted)]">
                    {o.orderNumber} — {o.customerName}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Confirmar criação */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <div className="text-sm font-extrabold">Confirmar criação</div>
          <div className="text-xs text-[var(--text-muted)]">
            {selectedOrderIds.size} pedido(s) • Entregador:{" "}
            {deliverersQ.data?.find((d) => d.id === selectedDelivererId)?.name ?? "—"}
            {selectedSide ? ` • Lado ${selectedSide}` : ""}
          </div>

          {createMut.isError && (
            <div className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              Erro ao criar rota. {String((createMut.error as any)?.message ?? "")}
            </div>
          )}

          <button
            className="w-full h-11 rounded-xl font-extrabold text-sm text-white transition disabled:opacity-50"
            style={{ backgroundColor: canCreate ? "#7c5cf8" : undefined }}
            disabled={!canCreate || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? "Criando rota..." : "Criar rota"}
          </button>
        </div>

      </div>
    </div>
  );
}
