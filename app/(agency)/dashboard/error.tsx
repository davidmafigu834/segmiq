"use client";

import { useEffect } from "react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    console.error("[agency dashboard]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[10px] border border-border bg-surface-card p-8 text-center shadow-md">
        <p className="font-display text-xl text-ink-primary">Something went wrong loading the dashboard</p>
        {(isDev && error?.message) || error?.digest ? (
          <pre className="mt-4 max-h-40 overflow-auto rounded-sm bg-surface-card-alt p-3 text-left font-mono text-[11px] text-ink-secondary whitespace-pre-wrap">
            {isDev && error?.message ? error.message : null}
            {error.digest ? `\nRef: ${error.digest}` : null}
          </pre>
        ) : null}
        <button type="button" className="btn-primary mt-6" onClick={() => reset()}>
          Retry
        </button>
      </div>
    </div>
  );
}
