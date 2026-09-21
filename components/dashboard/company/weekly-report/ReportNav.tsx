"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/ui/cn";

export const REPORT_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Team performance" },
  { id: "funnel", label: "Funnel" },
  { id: "team", label: "Sales team" },
  { id: "attention", label: "Needs attention" },
  { id: "pipeline", label: "Pipeline health" },
  { id: "conversations", label: "Customer insights" },
  { id: "lost", label: "Lost deals" },
  { id: "recommendations", label: "Recommended actions" },
  { id: "next-week", label: "Next week" },
  { id: "agenda", label: "Meeting agenda" },
] as const;

export function ReportNav({
  compact,
  onJump,
}: {
  compact?: boolean;
  onJump?: () => void;
}) {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const nodes = REPORT_SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (el): el is HTMLElement => Boolean(el)
    );
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.25, 0.5] }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Report sections" className={cn(compact && "space-y-0.5")}>
      {REPORT_SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          data-active={active === section.id}
          onClick={onJump}
          className={cn(
            "weekly-report-rail-link block whitespace-nowrap rounded-[7px] px-2.5 py-1.5 text-[12px] text-sales-text-muted hover:text-sales-text-primary"
          )}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
