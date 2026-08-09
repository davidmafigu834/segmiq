"use client";

import { useEffect, useState } from "react";

type Props = {
  leadId: string;
};

export function LeadBriefing({ leadId }: Props) {
  const [briefing, setBriefing] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${leadId}/briefing`)
      .then((r) => r.json())
      .then((data: { briefing?: string; suggestion?: string }) => {
        if (cancelled) return;
        if (data.briefing) setBriefing(data.briefing);
        if (data.suggestion) setSuggestion(data.suggestion);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (error) return null;
  if (!loading && !briefing && !suggestion) return null;

  return (
    <div className="mb-5 rounded-xl border border-[#E4E7EC] bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
          AI briefing
        </p>
        <span className="rounded-md bg-[#F2F4F7] px-1.5 py-0.5 text-[10px] font-medium text-[#667085]">
          Beta
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[90, 70, 50].map((w, i) => (
            <div
              key={i}
              className="h-3.5 animate-pulse rounded bg-[#F2F4F7]"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      ) : (
        <>
          {briefing ? (
            <p className="mb-3 text-[13px] leading-relaxed text-[#667085]">{briefing}</p>
          ) : null}
          {suggestion ? (
            <p className="rounded-lg border border-[rgba(212,255,79,0.25)] bg-[rgba(212,255,79,0.06)] px-3 py-2.5 text-[13px] leading-snug text-[#101828]">
              {suggestion}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
