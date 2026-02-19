import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { fetchNavigationLinks } from "../api";
import { MapPin, Navigation } from "lucide-react";

type NavigationButtonsProps = {
  routeId: string;
  routeStatus: string;
};

export function NavigationButtons({ routeId, routeStatus }: NavigationButtonsProps) {
  const { data: nav, isLoading, error } = useQuery({
    queryKey: ["navigation", routeId],
    queryFn: () => fetchNavigationLinks(routeId),
    enabled: !!routeId,
    staleTime: 5 * 60 * 1000, // 5 minutos (coordenadas não mudam com frequência)
  });

  // Detecta se é mobile
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const openWaze = () => {
    if (nav?.wazeLink) {
      window.location.href = nav.wazeLink;
    }
  };

  const openGoogleMaps = () => {
    if (!nav) return;
    // Mobile: usa link do app, Desktop: usa link web
    const link = isMobile ? nav.googleMapsLink : nav.googleMapsWebLink;
    window.location.href = link;
  };

  // Não mostra botões se a rota ainda não foi iniciada
  const canNavigate = routeStatus === "EmAndamento" || routeStatus === "Atribuida";

  if (!canNavigate) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="text-sm text-zinc-400">Carregando navegação...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4">
        <div className="text-sm text-red-200">
          Erro ao carregar links de navegação. {String((error as any)?.message ?? "")}
        </div>
      </div>
    );
  }

  if (!nav || nav.stopsWithCoordinates === 0) {
    return (
      <div className="rounded-2xl border border-yellow-900 bg-yellow-950/40 p-4">
        <div className="text-sm text-yellow-200">
          ⚠️ Esta rota não possui coordenadas. Execute o geocoding nos pedidos primeiro.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-extrabold text-sm">Navegação</div>
          <div className="text-xs text-zinc-400">
            {nav.stopsWithCoordinates} de {nav.totalStops} parada(s) com coordenadas
          </div>
        </div>

        {isMobile && (
          <div className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-lg">
            Mobile
          </div>
        )}
      </div>

      {/* Warnings */}
      {nav.warnings.length > 0 && (
        <div className="space-y-1">
          {nav.warnings.map((warning, i) => (
            <div key={i} className="text-xs text-yellow-400">
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Botões */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          className="rounded-xl font-extrabold bg-blue-600 hover:bg-blue-700 text-white"
          onClick={openWaze}
        >
          <Navigation className="w-4 h-4 mr-2" />
          Abrir no Waze
        </Button>

        <Button
          className="rounded-xl font-extrabold bg-green-600 hover:bg-green-700 text-white"
          onClick={openGoogleMaps}
        >
          <MapPin className="w-4 h-4 mr-2" />
          Abrir no Google Maps
        </Button>
      </div>

      {/* Info adicional */}
      <div className="text-xs text-zinc-500">
        {isMobile ? (
          <>
            <strong>Waze:</strong> Navega para o primeiro stop •{" "}
            <strong>Google Maps:</strong> Rota completa com todos os waypoints
          </>
        ) : (
          <>
            <strong>Dica:</strong> Para melhor experiência, abra em um dispositivo móvel com os
            apps instalados
          </>
        )}
      </div>
    </div>
  );
}
