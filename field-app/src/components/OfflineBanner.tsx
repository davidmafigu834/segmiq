import { WifiOff } from "lucide-react";
import { useOnline } from "../hooks/useOnline";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div className="flex items-center gap-2 bg-ink px-4 py-2 font-fw-body text-xs font-semibold text-lime">
      <WifiOff className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.5} />
      Offline — photos will queue until you reconnect
    </div>
  );
}
