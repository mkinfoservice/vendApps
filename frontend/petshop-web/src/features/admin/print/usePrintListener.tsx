import { useEffect, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import * as signalR from "@microsoft/signalr";
import { getToken, decodeTokenPayload } from "@/features/admin/auth/auth";
import { fetchPendingPrintJobs, markPrinted } from "./api";
import type { PrintOrderPayload, PendingJobDto } from "./types";
import { PrintReceipt } from "./PrintReceipt";

export type { PrintOrderPayload };

const API_URL = import.meta.env.VITE_API_URL ?? "";

export const PRINT_STATION_KEY = "vendapps_print_station";

export function isPrintStation(): boolean {
  return localStorage.getItem(PRINT_STATION_KEY) === "1";
}

export function setPrintStation(on: boolean) {
  if (on) localStorage.setItem(PRINT_STATION_KEY, "1");
  else localStorage.removeItem(PRINT_STATION_KEY);
}

function printPayload(payload: PrintOrderPayload, jobId: string) {
  const wrapper = document.createElement("div");
  wrapper.className = "receipt-print-wrapper";
  document.body.appendChild(wrapper);

  const root = createRoot(wrapper);
  root.render(<PrintReceipt payload={payload} />);

  requestAnimationFrame(() => {
    wrapper.style.display = "block";
    window.print();

    setTimeout(() => {
      root.unmount();
      wrapper.remove();
      markPrinted(jobId).catch(() => {/* best effort */});
    }, 500);
  });
}

/**
 * Hook que mantém conexão SignalR com o PrintHub.
 * Só imprime se este PC for a estação de impressão (isPrintStation() === true).
 * Todos os PCs conectam ao hub (para ver a fila), mas apenas a estação imprime.
 * onNewOrder é chamado em todos os PCs para exibir notificações.
 */
export function usePrintListener(onNewOrder?: (payload: PrintOrderPayload) => void) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [connected, setConnected] = useState(false);
  const [printStation, setPrintStationState] = useState<boolean>(isPrintStation);

  function togglePrintStation() {
    const next = !printStation;
    setPrintStation(next);
    setPrintStationState(next);
  }

  const replayPending = useCallback(async () => {
    if (!isPrintStation()) return; // apenas a estação faz replay
    try {
      const jobs: PendingJobDto[] = await fetchPendingPrintJobs();
      for (const job of jobs) {
        try {
          const payload: PrintOrderPayload = JSON.parse(job.printPayloadJson);
          printPayload(payload, job.id);
          await new Promise(r => setTimeout(r, 1500));
        } catch {/* ignora job corrompido */}
      }
    } catch {/* ignora falha de rede */}
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const decoded = decodeTokenPayload(token);
    const companyId = decoded?.companyId;
    if (!companyId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/print?access_token=${token}`, {
        transport: signalR.HttpTransportType.WebSockets |
                   signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .withKeepAliveInterval(10_000)   // cliente → servidor a cada 10s (mantém Render acordado)
      .withServerTimeout(60_000)       // espera até 60s antes de declarar servidor morto
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on("PrintOrder", (data: { jobId: string; payload: PrintOrderPayload }) => {
      if (isPrintStation()) {
        printPayload(data.payload, data.jobId);
      }
      onNewOrder?.(data.payload);
    });

    connection.onreconnected(async () => {
      setConnected(true);
      await connection.invoke("JoinCompany", companyId);
      await replayPending();
    });

    connection.onclose(() => setConnected(false));

    connection.start().then(async () => {
      await connection.invoke("JoinCompany", companyId);
      setConnected(true);
      await replayPending();
    }).catch(() => {/* tentará reconectar automaticamente */});

    connectionRef.current = connection;

    return () => {
      connection.stop();
      connectionRef.current = null;
      setConnected(false);
    };
  }, [replayPending]);

  return { connected, printStation, togglePrintStation };
}
