import type { PrintOrderPayload } from "./types";

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "Pix",
  CARD: "Cartão",
  CASH: "Dinheiro",
};

function fmt(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type Props = {
  payload: PrintOrderPayload;
};

export function PrintReceipt({ payload }: Props) {
  return (
    <div className="receipt-root">
      {/* Empresa / Cabeçalho */}
      <div className="receipt-header">
        <p className="receipt-title">PEDIDO CONFIRMADO</p>
        <p className="receipt-order-id">{payload.publicId}</p>
        <p className="receipt-date">{fmtDate(payload.createdAtUtc)}</p>
        {payload.isPhoneOrder && <p className="receipt-phone-badge">📞 Pedido por telefone</p>}
      </div>

      <div className="receipt-divider" />

      {/* Cliente */}
      <section className="receipt-section">
        <p className="receipt-label">CLIENTE</p>
        <p className="receipt-value">{payload.customerName}</p>
        <p className="receipt-value">{payload.phone}</p>
        {payload.address && <p className="receipt-value">{payload.address}</p>}
        {payload.complement && <p className="receipt-value">{payload.complement}</p>}
        {payload.cep && <p className="receipt-value">CEP: {payload.cep}</p>}
      </section>

      <div className="receipt-divider" />

      {/* Itens */}
      <section className="receipt-section">
        <p className="receipt-label">ITENS</p>
        {payload.items.map((item, i) => (
          <div key={i} className="receipt-item-row">
            <span className="receipt-item-name">{item.qty}x {item.name}</span>
            <span className="receipt-item-price">{fmt(item.unitCents * item.qty)}</span>
          </div>
        ))}
      </section>

      <div className="receipt-divider" />

      {/* Totais */}
      <section className="receipt-section">
        <div className="receipt-total-row">
          <span>Subtotal</span>
          <span>{fmt(payload.subtotalCents)}</span>
        </div>
        {payload.deliveryCents > 0 && (
          <div className="receipt-total-row">
            <span>Entrega</span>
            <span>{fmt(payload.deliveryCents)}</span>
          </div>
        )}
        <div className="receipt-total-row receipt-total-bold">
          <span>TOTAL</span>
          <span>{fmt(payload.totalCents)}</span>
        </div>
        <div className="receipt-total-row">
          <span>Pagamento</span>
          <span>{PAYMENT_LABELS[payload.paymentMethod] ?? payload.paymentMethod}</span>
        </div>
        {payload.cashGivenCents != null && (
          <>
            <div className="receipt-total-row">
              <span>Recebe</span>
              <span>{fmt(payload.cashGivenCents)}</span>
            </div>
            <div className="receipt-total-row">
              <span>Troco</span>
              <span>{fmt((payload.changeCents ?? 0))}</span>
            </div>
          </>
        )}
      </section>

      <div className="receipt-divider" />
      <p className="receipt-footer">Obrigado pela preferência!</p>
    </div>
  );
}
