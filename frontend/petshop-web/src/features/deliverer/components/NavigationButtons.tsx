import { useQuery } from "@tanstack/react-query";
import { fetchNextNavigation } from "@/features/deliverer/api";
import { Navigation, Map } from "lucide-react";

type Props = {
  routeId: string;
};

export function NavigationButtons({ routeId }: Props) {
  const { data: nav } = useQuery({
    queryKey: ["deliverer", "navigation", routeId],
    queryFn: () => fetchNextNavigation(routeId),
    refetchInterval: 30_000,
  });

  if (!nav || !nav.hasCoordinates) return null;

  return (
    <div className="flex gap-2">
      {nav.wazeLink && (
        <a
          href={nav.wazeLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-11 rounded-xl bg-sky-600 text-white font-bold text-sm flex items-center justify-center gap-2"
        >
          <Navigation size={16} />
          Waze
        </a>
      )}
      {nav.googleMapsLink && (
        <a
          href={nav.googleMapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2"
        >
          <Map size={16} />
          Maps
        </a>
      )}
    </div>
  );
}
