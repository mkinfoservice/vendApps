/**
 * Módulo de impressão mobile para tablets (Android + iPad).
 *
 * Modos suportados:
 *  - "bluetooth" → Web Bluetooth API (Chrome Android) — silencioso, sem dialog
 *  - "browser"   → window.print() + AirPrint (iOS/Android) — abre dialog uma vez
 *
 * A seleção fica em localStorage para persistir entre sessões.
 */
import { buildEscPosReceipt, type PaperWidth } from "./escpos";
import { markPrinted } from "./api";
import type { PrintOrderPayload } from "./types";

// ── Storage keys ──────────────────────────────────────────────────────────────

export const MOBILE_AGENT_KEY  = "vendapps_mobile_agent";
export const MOBILE_MODE_KEY   = "vendapps_mobile_mode";
export const MOBILE_PAPER_KEY  = "vendapps_mobile_paper";

export type MobilePrintMode = "bluetooth" | "browser";

// ── Settings ──────────────────────────────────────────────────────────────────

export function isMobileAgent(): boolean {
  return localStorage.getItem(MOBILE_AGENT_KEY) === "1";
}

export function setMobileAgent(on: boolean): void {
  if (on) localStorage.setItem(MOBILE_AGENT_KEY, "1");
  else     localStorage.removeItem(MOBILE_AGENT_KEY);
}

export function getMobileMode(): MobilePrintMode {
  return (localStorage.getItem(MOBILE_MODE_KEY) as MobilePrintMode) ?? "browser";
}

export function setMobileMode(mode: MobilePrintMode): void {
  localStorage.setItem(MOBILE_MODE_KEY, mode);
}

export function getMobilePaper(): PaperWidth {
  const v = localStorage.getItem(MOBILE_PAPER_KEY);
  return v === "80" ? 80 : 58;
}

export function setMobilePaper(w: PaperWidth): void {
  localStorage.setItem(MOBILE_PAPER_KEY, String(w));
}

// ── Web Bluetooth ─────────────────────────────────────────────────────────────

/**
 * UUIDs de serviço BLE para impressoras térmicas comuns.
 * A API tentará conectar em cada serviço até encontrar um com característica gravável.
 */
const KNOWN_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",  // Genérico (Elgin, Bematech, etc.)
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",  // Genérico alternativo
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",  // Xprinter, GOOJPRT
  "000018f0-0000-1000-8000-00805f9b34fb",  // Generic Serial
];

// Referência ao dispositivo BLE pareado nesta sessão
let bleDevice: BluetoothDevice | null = null;
let bleCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

/**
 * Verifica se a Web Bluetooth API está disponível neste navegador.
 */
export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/**
 * Abre o seletor de dispositivos Bluetooth do navegador e faz o emparelhamento.
 * Deve ser chamado por um gesto do usuário (clique de botão).
 * @returns Nome do dispositivo conectado
 */
export async function connectBluetoothPrinter(): Promise<string> {
  if (!isBluetoothSupported()) {
    throw new Error("Web Bluetooth não suportado neste navegador. Use Chrome no Android.");
  }

  // Desconectar sessão anterior se houver
  if (bleDevice?.gatt?.connected) {
    bleDevice.gatt.disconnect();
  }
  bleDevice = null;
  bleCharacteristic = null;

  // Solicita dispositivo ao usuário (obrigatório por segurança do navegador)
  const device = await (navigator as Navigator & { bluetooth: Bluetooth }).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: KNOWN_PRINTER_SERVICES,
  });

  const server = await device.gatt!.connect();

  // Tenta cada serviço conhecido até encontrar uma característica gravável
  let foundChar: BluetoothRemoteGATTCharacteristic | null = null;

  for (const serviceUUID of KNOWN_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUUID);
      const chars   = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties.writeWithoutResponse || c.properties.write) {
          foundChar = c;
          break;
        }
      }
      if (foundChar) break;
    } catch {
      // Serviço não encontrado neste dispositivo — tenta o próximo
    }
  }

  if (!foundChar) {
    // Fallback: percorre todos os serviços do dispositivo
    const services = await server.getPrimaryServices();
    outer: for (const svc of services) {
      const chars = await svc.getCharacteristics();
      for (const c of chars) {
        if (c.properties.writeWithoutResponse || c.properties.write) {
          foundChar = c;
          break outer;
        }
      }
    }
  }

  if (!foundChar) {
    device.gatt?.disconnect();
    throw new Error(
      "Impressora conectada mas nenhuma característica de escrita encontrada. " +
      "Verifique se é uma impressora térmica Bluetooth compatível.",
    );
  }

  bleDevice        = device;
  bleCharacteristic = foundChar;

  return device.name ?? "Impressora Bluetooth";
}

/**
 * Nome do dispositivo BLE conectado nesta sessão (ou null).
 */
export function connectedBluetoothDevice(): string | null {
  if (bleDevice?.gatt?.connected) return bleDevice.name ?? "Impressora BT";
  return null;
}

/**
 * Desconecta o dispositivo BLE atual.
 */
export function disconnectBluetooth(): void {
  bleDevice?.gatt?.disconnect();
  bleDevice        = null;
  bleCharacteristic = null;
}

/**
 * Envia bytes ESC/POS para a impressora BLE em chunks de 512 bytes.
 */
async function sendViaBluetooth(data: Uint8Array): Promise<void> {
  // Reconecta se necessário (BLE desconecta após idle)
  if (!bleDevice || !bleCharacteristic) {
    throw new Error("Nenhuma impressora Bluetooth conectada. Conecte primeiro nas configurações.");
  }
  if (!bleDevice.gatt?.connected) {
    await bleDevice.gatt!.connect();
    // A característica precisa ser rebuscada após reconexão
    const server  = bleDevice.gatt!;
    const services = await server.getPrimaryServices();
    outer: for (const svc of services) {
      const chars = await svc.getCharacteristics();
      for (const c of chars) {
        if (c.properties.writeWithoutResponse || c.properties.write) {
          bleCharacteristic = c;
          break outer;
        }
      }
    }
    if (!bleCharacteristic) throw new Error("Falha ao reconectar à impressora.");
  }

  const CHUNK = 512;
  const char  = bleCharacteristic;

  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    if (char.properties.writeWithoutResponse) {
      await char.writeValueWithoutResponse(chunk);
    } else {
      await char.writeValue(chunk);
    }
    // Pequeno delay para não saturar o buffer BLE
    await new Promise((r) => setTimeout(r, 20));
  }
}

// ── window.print() (AirPrint / browser dialog) ────────────────────────────────

/**
 * Renderiza o recibo em um elemento oculto e chama window.print().
 * No iPad via AirPrint o usuário toca "Imprimir" no dialog do iOS.
 * Requer que <PrintReceipt> com CSS @media print já esteja disponível.
 */
function printViaBrowserDialog(
  payload: PrintOrderPayload,
  jobId: string,
  onBrowserPrint: (payload: PrintOrderPayload, jobId: string) => void,
): void {
  onBrowserPrint(payload, jobId);
}

// ── Main dispatch ─────────────────────────────────────────────────────────────

let _browserPrintFn: ((payload: PrintOrderPayload, jobId: string) => void) | null = null;

/**
 * Registra a função de impressão via browser (window.print()).
 * Chamado pelo usePrintListener ao montar.
 */
export function registerBrowserPrintFn(
  fn: (payload: PrintOrderPayload, jobId: string) => void,
): void {
  _browserPrintFn = fn;
}

/**
 * Ponto de entrada único para impressão mobile.
 * Seleciona a estratégia correta com base nas configurações salvas.
 */
export async function mobilePrint(
  payload: PrintOrderPayload,
  jobId: string,
): Promise<void> {
  const mode  = getMobileMode();
  const paper = getMobilePaper();

  if (mode === "bluetooth") {
    const data = buildEscPosReceipt(payload, paper);
    await sendViaBluetooth(data);
    await markPrinted(jobId).catch(() => {/* best effort */});
    return;
  }

  // mode === "browser" — usa window.print() (AirPrint no iPad)
  if (_browserPrintFn) {
    printViaBrowserDialog(payload, jobId, _browserPrintFn);
  }
}
