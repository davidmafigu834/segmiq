"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Download, ChevronRight } from "lucide-react";

type SegmentSummary = {
  id: string;
  name: string;
  segment_type: "predefined" | "custom";
  lead_count: number | null;
  last_exported_at: string | null;
};

export function AudienceSummaryCard({ clientId }: { clientId: string }) {
  const [segments, setSegments] = useState<SegmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalContacts, setTotalContacts] = useState(0);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/segments`)
      .then((r) => r.json())
      .then((data: { segments?: SegmentSummary[] }) => {
        const segs = data.segments ?? [];
        setSegments(segs.slice(0, 3));
        setTotalContacts(
          segs.reduce((acc, s) => acc + (s.lead_count ?? 0), 0)
        );
      })
      .catch(() => {
        // silent
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  if (!loading && segments.length === 0) return null;

  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] font-normal uppercase tracking-[0.1em] text-ink-tertiary">
            05 / RETARGETING
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-display text-ink-primary">
            Audience segments
          </h2>
        </div>
        <Link
          href={`/dashboard/clients/${clientId}/audiences`}
          className="flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
        >
          Manage
          <ChevronRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="rounded-[10px] border border-border bg-surface-card overflow-hidden">
          {/* Summary row */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Download size={14} className="text-[var(--accent)]" />
              <span className="text-[13px] font-medium text-[var(--text-primary)]">
                {segments.length} active segment{segments.length !== 1 ? "s" : ""}
              </span>
            </div>
            <span className="font-display text-[22px] font-semibold leading-none text-[var(--text-primary)]">
              {totalContacts.toLocaleString()}
            </span>
          </div>

          {/* Top segments */}
          {segments.map((seg, i) => (
            <div
              key={seg.id}
              className={`flex items-center justify-between gap-3 px-5 py-3 ${
                i < segments.length - 1 ? "border-b border-[var(--border)]" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                  {seg.name}
                </p>
                {seg.last_exported_at && (
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    Last exported{" "}
                    {new Date(seg.last_exported_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                )}
              </div>
              <span className="font-display text-[18px] font-semibold leading-none text-[var(--text-primary)] shrink-0">
                {seg.lead_count != null ? seg.lead_count.toLocaleString() : "—"}
              </span>
            </div>
          ))}

          <Link
            href={`/dashboard/clients/${clientId}/audiences`}
            className="flex items-center justify-center gap-1.5 px-5 py-3 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors border-t border-[var(--border)]"
          >
            View all segments
            <ChevronRight size={12} />
          </Link>
        </div>
      )}
    </section>
  );
}
