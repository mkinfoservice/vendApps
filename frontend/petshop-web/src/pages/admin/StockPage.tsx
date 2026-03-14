import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { Pagination } from "@/components/ui/Pagination";
import {
  listStock, getAlerts, getMovements, adjustStock, setReorderPoint,
  type StockItemDto, type StockMovementDto,
} from "@/features/stock/stockApi";
import {
  MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_COLORS,
  type StockMovementType,
} from "@/features/stock/types";
import {
  Package, AlertTriangle, ArrowUpCircle,
  History, Settings2,
} from "lucide-react";

type FilterMode = "all" | "low" | "out";

const FILTER_TABS: { value: FilterMode; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "low", label: "Estoque baixo" },
  { value: "out", label: "Zerados" },
];

// ── Adjustment modal ──────────────────────────────────────────────────────────

function AdjustModal({
  product, onClose,
}: { product: StockItemDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState("");
  const [type, setType] = useState<StockMovementType>("ManualAdjustment");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      adjustStock(product.id, parseFloat(delta), type, reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-alerts"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const parsed = parseFloat(delta);
  const isValid = !isNaN(parsed) && parsed !== 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Ajustar estoque</h2>
        <p className="text-sm text-gray-500">{product.name}</p>
        <p className="text-sm">
          Estoque atual:{" "}
          <span className="font-semibold">{product.stockQty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {product.unit}</span>
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</label>
            <select
              className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white text-gray-900 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
              value={type}
              onChange={e => setType(e.target.value as StockMovementType)}
            >
              <option value="PurchaseEntry">Entrada (compra)</option>
              <option value="ManualAdjustment">Ajuste manual</option>
              <option value="Return">Devolução</option>
              <option value="Loss">Perda / quebra</option>
              <option value="InitialSetup">Estoque inicial</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Quantidade {type === "Loss" || type === "ManualAdjustment" ? "(use − para saída)" : ""}
            </label>
            <input
              type="number"
              step="0.001"
              className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
              value={delta}
              onChange={e => setDelta(e.target.value)}
              placeholder={type === "Loss" ? "-5" : "10"}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Motivo (opcional)</label>
            <input
              className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="ex: Nota fiscal NF-e 001234"
            />
          </div>
        </div>

        {isValid && (
          <p className="text-sm text-gray-500">
            Novo estoque:{" "}
            <span className={`font-semibold ${product.stockQty + parsed < 0 ? "text-red-600" : "text-green-600"}`}>
              {(product.stockQty + parsed).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {product.unit}
            </span>
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!isValid || mut.isPending}
            onClick={() => mut.mutate()}
            className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 active:scale-95 transition disabled:opacity-40"
          >
            {mut.isPending ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── History drawer ────────────────────────────────────────────────────────────

function HistoryDrawer({
  product, onClose,
}: { product: StockItemDto; onClose: () => void }) {
  const { data: movements = [], isLoading } = useQuery<StockMovementDto[]>({
    queryKey: ["stock-movements", product.id],
    queryFn: () => getMovements(product.id),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-2 pb-2">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Histórico de movimentos</h2>
            <p className="text-sm text-gray-500">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {isLoading && <p className="text-sm text-gray-400 text-center py-8">Carregando...</p>}
          {!isLoading && movements.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma movimentação registrada.</p>
          )}
          {movements.map(m => {
            const label = MOVEMENT_TYPE_LABELS[m.movementType as keyof typeof MOVEMENT_TYPE_LABELS] ?? m.movementType;
            const color = MOVEMENT_TYPE_COLORS[m.movementType as keyof typeof MOVEMENT_TYPE_COLORS] ?? "bg-gray-100 text-gray-600";
            return (
              <div key={m.id} className="flex items-start gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                  {label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${m.quantity >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {m.quantity >= 0 ? "+" : ""}{m.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {m.balanceBefore.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} → {m.balanceAfter.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                    </span>
                  </div>
                  {m.reason && <p className="text-gray-500 text-xs truncate">{m.reason}</p>}
                  <p className="text-gray-400 text-xs">
                    {m.actorName} · {new Date(m.createdAtUtc).toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function StockRow({
  item,
  onAdjust,
  onHistory,
  onSetReorder,
}: {
  item: StockItemDto;
  onAdjust: (p: StockItemDto) => void;
  onHistory: (p: StockItemDto) => void;
  onSetReorder: (p: StockItemDto) => void;
}) {
  const isOut = item.stockQty <= 0;
  const isLow = !isOut && item.reorderPoint != null && item.stockQty <= item.reorderPoint;

  const statusBadge = isOut
    ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Zerado</span>
    : isLow
    ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Baixo</span>
    : null;

  return (
    <tr
      className="transition"
      style={{ borderBottom: "1px solid var(--border)" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "rgba(124,92,248,0.04)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent")}
    >
      <td className="px-4 py-3">
        <div className="font-medium text-sm" style={{ color: "var(--text)" }}>{item.name}</div>
        {item.internalCode && <div className="text-xs" style={{ color: "var(--text-muted)" }}>{item.internalCode}</div>}
      </td>
      <td className="px-4 py-3 text-xs hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>{item.barcode ?? "—"}</td>
      <td className="px-4 py-3 text-right">
        <div className={`text-sm font-semibold ${isOut ? "text-red-500" : isLow ? "text-orange-500" : ""}`} style={!isOut && !isLow ? { color: "var(--text)" } : {}}>
          {item.stockQty.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {item.unit}
        </div>
        {statusBadge}
      </td>
      <td className="px-4 py-3 text-right text-xs hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
        {item.reorderPoint != null
          ? item.reorderPoint.toLocaleString("pt-BR", { maximumFractionDigits: 3 })
          : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <button
            title="Ajustar estoque"
            onClick={() => onAdjust(item)}
            className="p-1.5 rounded-lg hover:bg-brand/10 text-brand transition"
          >
            <ArrowUpCircle className="w-4 h-4" />
          </button>
          <button
            title="Histórico"
            onClick={() => onHistory(item)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            title="Ponto de reposição"
            onClick={() => onSetReorder(item)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Reorder point modal ───────────────────────────────────────────────────────

function ReorderModal({ product, onClose }: { product: StockItemDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [val, setVal] = useState(product.reorderPoint != null ? String(product.reorderPoint) : "");

  const mut = useMutation({
    mutationFn: () =>
      setReorderPoint(product.id, val !== "" ? parseFloat(val) : null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-alerts"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Ponto de reposição</h2>
        <p className="text-sm text-gray-500">{product.name}</p>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Quantidade mínima ({product.unit})
          </label>
          <input
            type="number"
            step="0.001"
            className="mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-[#7c5cf8]/30"
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="ex: 5"
          />
          <p className="text-xs text-gray-400 mt-1">Deixe em branco para desativar alertas.</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Cancelar</button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:brightness-110 transition disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [page, setPage] = useState(1);
  const [adjustProduct, setAdjustProduct] = useState<StockItemDto | null>(null);
  const [historyProduct, setHistoryProduct] = useState<StockItemDto | null>(null);
  const [reorderProduct, setReorderProduct] = useState<StockItemDto | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["stock", filter, page],
    queryFn: () => listStock(filter === "all" ? undefined : filter, page),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["stock-alerts"],
    queryFn: getAlerts,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);
  const alertCount = alerts.length;

  return (
    <div style={{ backgroundColor: "var(--bg)" }}>
      {adjustProduct && (
        <AdjustModal product={adjustProduct} onClose={() => setAdjustProduct(null)} />
      )}
      {historyProduct && (
        <HistoryDrawer product={historyProduct} onClose={() => setHistoryProduct(null)} />
      )}
      {reorderProduct && (
        <ReorderModal product={reorderProduct} onClose={() => setReorderProduct(null)} />
      )}

      <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-6 space-y-4">
        <PageHeader
          title="Estoque"
          subtitle={`${total} produto${total !== 1 ? "s" : ""}`}
        />

        {/* Alert banner */}
        {alertCount > 0 && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm"
            style={{ backgroundColor: "rgba(249,115,22,0.08)", borderColor: "rgba(249,115,22,0.3)", color: "#f97316" }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <span className="font-semibold">{alertCount}</span> produto{alertCount > 1 ? "s" : ""} com estoque baixo ou zerado
            </span>
            <button
              onClick={() => { setFilter("low"); setPage(1); }}
              className="ml-auto text-xs underline underline-offset-2 hover:no-underline"
            >
              Ver todos
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div
          className="flex gap-1 rounded-xl border p-1 w-fit"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          {FILTER_TABS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setFilter(t.value); setPage(1); }}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition"
              style={
                filter === t.value
                  ? { backgroundColor: "var(--brand)", color: "#fff" }
                  : { color: "var(--text-muted)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Produto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden sm:table-cell" style={{ color: "var(--text-muted)" }}>Cód. barras</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Estoque atual</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider hidden md:table-cell" style={{ color: "var(--text-muted)" }}>Reposição</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <TableSkeleton rows={8} cols={5} />}

              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={Package}
                      title="Nenhum produto encontrado"
                      description={filter !== "all" ? "Tente mudar o filtro." : "Nenhum produto com estoque cadastrado."}
                    />
                  </td>
                </tr>
              )}

              {items.map(item => (
                <StockRow
                  key={item.id}
                  item={item}
                  onAdjust={setAdjustProduct}
                  onHistory={setHistoryProduct}
                  onSetReorder={setReorderProduct}
                />
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
        />
      </div>
    </div>
  );
}
