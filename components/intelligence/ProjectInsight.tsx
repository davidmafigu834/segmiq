"use client";

import { useEffect, useState } from "react";

export function ProjectInsight({ projectId }: { projectId: string }) {
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/intelligence/insight?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data: { insight?: string | null }) => {
        if (active) setInsight(data.insight || null);
      })
      .catch(() => {
        if (active) setInsight(null);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  if (!insight) return null;
  return (
    <section className="rounded-sales-md border border-sales-border bg-sales-surface p-3">
      <p className="text-[12px] font-semibold">SegmiQ insight</p>
      <p className="mt-1 text-[13px] leading-5 text-sales-text-secondary">{insight}</p>
    </section>
  );
}
