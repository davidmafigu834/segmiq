"use client";

import { useEffect, useState } from "react";

type DemoStatus = {
  demo: boolean;
  name: string | null;
};

/** Subtle staff indicator. Hidden for production organisations. */
export function DemoWorkspaceChip({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<DemoStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: DemoStatus | null) => {
        if (!cancelled) setStatus(body);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.demo) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border border-sales-border bg-sales-surface px-2.5 py-1 text-[11px] font-medium tracking-wide text-sales-text-secondary ${className}`}
      title={status.name ? `${status.name} is using demonstration data` : "Demonstration data"}
    >
      Demo Workspace
    </span>
  );
}
