import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    void Network.getStatus().then((s) => {
      if (mounted) setOnline(s.connected);
    });

    const handle = Network.addListener("networkStatusChange", (s) => {
      setOnline(s.connected);
    });

    return () => {
      mounted = false;
      void handle.then((h) => h.remove());
    };
  }, []);

  return online;
}
