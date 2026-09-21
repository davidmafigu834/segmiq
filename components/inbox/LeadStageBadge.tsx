"use client";

import { stageLabel, stageStyle } from "@/lib/inbox/scoring";

type Variant = "default" | "list" | "header";

const TONE_CLASS: Record<string, string> = {
  New: "text-sales-text-secondary",
  Contacted: "text-sales-success-fg",
  Negotiating: "text-sales-warning-fg",
  "Proposal sent": "text-sales-info",
  "Follow-up Due": "text-sales-warning-fg",
  Won: "text-sales-success-fg",
  Lost: "text-sales-danger-fg",
  "Not qualified": "text-sales-danger-fg",
};

type Props = {
  status: string;
  followUpDate?: string | null;
  variant?: Variant;
  className?: string;
};

export function LeadStageBadge({
  status,
  followUpDate = null,
  variant = "default",
  className = "",
}: Props) {
  const label = stageLabel(status, followUpDate ?? null);
  const tone = TONE_CLASS[label] ?? "text-sales-text-secondary";

  if (variant === "list" || variant === "header") {
    return (
      <span className={`inline-flex max-w-full truncate text-[12px] font-medium leading-none ${tone} ${className}`}>
        {label}
      </span>
    );
  }

  const st = stageStyle(status, followUpDate ?? null);
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${className}`}
      style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}
    >
      {label}
    </span>
  );
}
