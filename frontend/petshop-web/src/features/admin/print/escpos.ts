/**
 * Gerador de bytes ESC/POS para impressoras térmicas.
 *
 * Suporta papel de 58mm (32 colunas) e 80mm (48 colunas).
 * Compatível com Epson, Star, Bixolon, Elgin e impressoras genéricas.
 */
import type { PrintOrderPayload } from "./types";

const PAYMENT_LABELS: Record<string, string> = {
  PIX:              "Pix",
  CARD:             "Cartao",
  CARD_ON_DELIVERY: "Cartao na entrega",
  CASH:             "Dinheiro",
  PAY_AT_COUNTER:   "Pagamento pendente",
};

const enc = new TextEncoder();

function bytes(...b: number[]): Uint8Array { return new Uint8Array(b); }
function text(s: string): Uint8Array       { return enc.encode(s); }
function lf(): Uint8Array                  { return bytes(0x0A); }

// ── ESC/POS commands ──────────────────────────────────────────────────────────
const CMD_INIT         = bytes(0x1B, 0x40);           // ESC @ — inicializa
const CMD_ALIGN_LEFT   = bytes(0x1B, 0x61, 0x00);     // ESC a 0 — alinhar esquerda
const CMD_ALIGN_CENTER = bytes(0x1B, 0x61, 0x01);     // ESC a 1 — alinhar centro
const CMD_BOLD_ON      = bytes(0x1B, 0x45, 0x01);     // ESC E 1 — negrito
const CMD_BOLD_OFF     = bytes(0x1B, 0x45, 0x00);     // ESC E 0
const CMD_DOUBLE_ON    = bytes(0x1D, 0x21, 0x11);     // GS ! 11h — duplo altura+largura
const CMD_DOUBLE_OFF   = bytes(0x1D, 0x21, 0x00);     // GS ! 0 — normal
const CMD_FEED_5       = bytes(0x1B, 0x64, 0x05);     // ESC d 5 — avança 5 linhas
const CMD_CUT_PARTIAL  = bytes(0x1D, 0x56, 0x42, 0x00); // GS V B 0 — corte parcial

function fmt(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function padLine(left: string, right: string, width: number): string {
  const rightLen = right.length;
  const leftMax  = width - rightLen - 1;
  const l        = left.length > leftMax ? left.substring(0, leftMax) : left;
  const spaces   = width - l.length - rightLen;
  return l + " ".repeat(Math.max(1, spaces)) + right;
}

function separator(cols: number): Uint8Array {
  return text("-".repeat(cols));
}

function merge(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const out   = new Uint8Array(total);
  let offset  = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type PaperWidth = 58 | 80;

/**
 * Constrói o array de bytes ESC/POS para o recibo de pedido.
 * @param payload  Dados do pedido
 * @param paper    Largura do papel em mm (58 ou 80). Padrão: 58
 */
export function buildEscPosReceipt(
  payload: PrintOrderPayload,
  paper: PaperWidth = 58,
): Uint8Array {
  const cols = paper === 80 ? 48 : 32;

  const date = new Date(payload.createdAtUtc).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const paymentLabel = PAYMENT_LABELS[payload.paymentMethod] ?? payload.paymentMethod;

  const parts: Uint8Array[] = [
    // ── Inicializar ──────────────────────────────────────────────────────────
    CMD_INIT,

    // ── Cabeçalho ────────────────────────────────────────────────────────────
    CMD_ALIGN_CENTER,
    CMD_DOUBLE_ON,
    CMD_BOLD_ON,
    text("PEDIDO"), lf(),
    text("CONFIRMADO"), lf(),
    CMD_DOUBLE_OFF,
    CMD_BOLD_OFF,
    lf(),
    text(`#${payload.publicId}`), lf(),
    text(date), lf(),
    ...(payload.isPhoneOrder ? [text("Pedido por telefone"), lf()] : []),
    lf(),

    // ── Separador ────────────────────────────────────────────────────────────
    separator(cols), lf(),

    // ── Cliente ──────────────────────────────────────────────────────────────
    CMD_ALIGN_LEFT,
    CMD_BOLD_ON,
    text("CLIENTE"), lf(),
    CMD_BOLD_OFF,
    text(payload.customerName || ""), lf(),
    ...(payload.phone   ? [text(payload.phone),   lf()] : []),
    ...(payload.address ? [text(payload.address), lf()] : []),
    ...(payload.complement ? [text(payload.complement), lf()] : []),
    ...(payload.cep && payload.cep !== "00000-000"
      ? [text(`CEP: ${payload.cep}`), lf()]
      : []),
    lf(),

    // ── Separador ────────────────────────────────────────────────────────────
    CMD_ALIGN_CENTER,
    separator(cols), lf(),

    // ── Itens ────────────────────────────────────────────────────────────────
    CMD_ALIGN_LEFT,
    CMD_BOLD_ON,
    text("ITENS"), lf(),
    CMD_BOLD_OFF,
    ...payload.items.flatMap((item) => {
      const total = fmt(item.qty * item.unitCents);
      const name  = `${item.qty}x ${item.name}`;
      return [text(padLine(name, total, cols)), lf()];
    }),
    lf(),

    // ── Separador ────────────────────────────────────────────────────────────
    CMD_ALIGN_CENTER,
    separator(cols), lf(),

    // ── Totais ───────────────────────────────────────────────────────────────
    CMD_ALIGN_LEFT,
    ...(payload.deliveryCents > 0
      ? [text(padLine("Subtotal", fmt(payload.subtotalCents), cols)), lf(),
         text(padLine("Entrega",  fmt(payload.deliveryCents),  cols)), lf()]
      : []),
    CMD_BOLD_ON,
    text(padLine("TOTAL", fmt(payload.totalCents), cols)), lf(),
    CMD_BOLD_OFF,
    text(padLine("Pagamento", paymentLabel, cols)), lf(),
    ...(payload.cashGivenCents != null
      ? [text(padLine("Recebe", fmt(payload.cashGivenCents),     cols)), lf(),
         text(padLine("Troco",  fmt(payload.changeCents ?? 0),   cols)), lf()]
      : []),
    lf(),

    // ── Rodapé ───────────────────────────────────────────────────────────────
    CMD_ALIGN_CENTER,
    separator(cols), lf(),
    text("Obrigado pela preferencia!"), lf(),
    lf(),

    // ── Avançar e cortar ─────────────────────────────────────────────────────
    CMD_FEED_5,
    CMD_CUT_PARTIAL,
  ];

  return merge(...parts);
}
