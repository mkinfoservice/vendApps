import { useEffect, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import * as signalR from "@microsoft/signalr";
import { getToken, decodeTokenPayload } from "@/features/admin/auth/auth";
import { fetchPendingPrintJobs, markPrinted } from "./api";
import type { PrintOrderPayload, PendingJobDto } from "./types";
import { PrintReceipt } from "./PrintReceipt";

const API_URL = import.meta.env.VITE_API_URL ?? "";

function printPayload(payload: PrintOrderPayload, jobId: string) {
  // 1. Cria o wrapper de impressão e monta o React component
  const wrapper = document.createElement("div");
  wrapper.className = "receipt-print-wrapper";
  document.body.appendChild(wrapper);

  const root = createRoot(wrapper);
  root.render(<PrintReceipt payload={payload} />);

  // 2. Força layout + print
  requestAnimationFrame(() => {
    wrapper.style.display = "block";
    window.print();

    // 3. Remove wrapper e marca como impresso
    setTimeout(() => {
      root.unmount();
      wrapper.remove();
      markPrinted(jobId).catch(() => {/* best effort */});
    }, 500);
  });
}

/**
 * Hook que mantém conexão SignalR com o PrintHub e:
 * 1. Ao conectar, baixa jobs pendentes e imprime todos.
 * 2. Ouve evento "PrintOrder" e imprime em tempo real.
 *
 * Deve ser montado uma única vez no layout admin (ex: AdminGuard ou root admin page).
 */
export function usePrintListener() {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [connected, setConnected] = useState(false);

  const replayPending = useCallback(async () => {
    try {
      const jobs: PendingJobDto[] = await fetchPendingPrintJobs();
      for (const job of jobs) {
        try {
          const payload: PrintOrderPayload = JSON.parse(job.printPayloadJson);
          printPayload(payload, job.id);
          // Pequena pausa entre impressões para a impressora respirar
          await new Promise(r => setTimeout(r, 1500));
        } catch {/* ignora job corrompido */}
      }
    } catch {/* ignora falha de rede no replay */}
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const payload = decodeTokenPayload(token);
    const companyId = payload?.companyId;
    if (!companyId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/print?access_token=${token}`, {
        transport: signalR.HttpTransportType.WebSockets |
                   signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on("PrintOrder", (data: { jobId: string; payload: PrintOrderPayload }) => {
      printPayload(data.payload, data.jobId);
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

  return { connected };
}
