import { Sparkles } from "lucide-react";
import type { SalesMirror } from "../lib/types";

const FALLBACK_LINE = "Log every call so your mirror learns your patterns.";

export function MirrorCard({ mirror }: { mirror?: SalesMirror }) {
  const line = mirror?.line ?? FALLBACK_LINE;
  const isStall = mirror?.mode === "stall";

  return (
    <div
      className="ag-fade-in rounded-xl border border-border bg-surface-card px-4 py-4"
      style={{ borderLeft: "4px solid var(--accent)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        {isStall ? (
          <Sparkles size={14} className="shrink-0 text-accent" aria-hidden />
        ) : null}
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
          Your mirror
        </p>
      </div>
      <p className="m-0 text-[14px] leading-relaxed text-ink-secondary">{line}</p>
    </div>
  );
}
