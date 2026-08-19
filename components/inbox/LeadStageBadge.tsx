"use client";

import { useCrmThemeOptional } from "@/components/CrmThemeProvider";
import { stageLabel, stageStyle } from "@/lib/inbox/scoring";

type Variant = "default" | "list" | "header";

const LIST_STYLES: Record<string, { bg: string; text: string }> = {
  New: { bg: "#F4FCE8", text: "#4D7C0F" },
  Contacted: { bg: "#ECFDF3", text: "#027A48" },
  Negotiating: { bg: "#FFFAEB", text: "#B54708" },
  "Proposal sent": { bg: "#EFF8FF", text: "#175CD3" },
  "Follow-up Due": { bg: "#FFFAEB", text: "#B54708" },
  Won: { bg: "#DCFCE7", text: "#15803D" },
  Lost: { bg: "#FEE2E2", text: "#B91C1C" },
  "Not qualified": { bg: "#FEE2E2", text: "#B91C1C" },
};

const HEADER_STYLES: Record<string, { bg: string; text: string }> = {
  New: { bg: "#F4FCE8", text: "#4D7C0F" },
  Contacted: { bg: "#ECFDF3", text: "#027A48" },
  Negotiating: { bg: "#FFFAEB", text: "#B54708" },
  "Proposal sent": { bg: "#EFF8FF", text: "#175CD3" },
  "Follow-up Due": { bg: "#FFFAEB", text: "#B54708" },
  Won: { bg: "#DCFCE7", text: "#15803D" },
  Lost: { bg: "#FEE2E2", text: "#B91C1C" },
  "Not qualified": { bg: "#FEE2E2", text: "#B91C1C" },
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
  const crmTheme = useCrmThemeOptional();
  const isDarkCrm = crmTheme?.theme !== "light";
  const label = stageLabel(status, followUpDate ?? null);

  if (variant === "list") {
    if (isDarkCrm) {
      const st = stageStyle(status, followUpDate ?? null);
      return (
        <span
          className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${className}`}
          style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}
        >
          {label}
        </span>
      );
    }
    const style = LIST_STYLES[label] ?? LIST_STYLES.Contacted;
    return (
      <span
        className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${className}`}
        style={{ background: style.bg, color: style.text }}
      >
        {label}
      </span>
    );
  }

  if (variant === "header") {
    if (isDarkCrm) {
      const st = stageStyle(status, followUpDate ?? null);
      return (
        <span
          className={`inline-flex max-w-full shrink-0 items-center truncate rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${className}`}
          style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}
        >
          {label}
        </span>
      );
    }
    const style = HEADER_STYLES[label] ?? HEADER_STYLES.Contacted;
    return (
      <span
        className={`inline-flex max-w-full shrink-0 items-center truncate rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none ${className}`}
        style={{ background: style.bg, color: style.text }}
      >
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
