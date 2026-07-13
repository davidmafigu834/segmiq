import { stageLabel, stageStyle } from "@/lib/inbox/scoring";

type Variant = "default" | "list" | "header";

const LIST_STYLES: Record<string, { bg: string; text: string }> = {
  "New Lead": { bg: "#E7FCE3", text: "#008069" },
  Contacted: { bg: "#F0F2F5", text: "#54656F" },
  Quoted: { bg: "#FFF4E5", text: "#B45309" },
  "Follow-up Due": { bg: "#FFF4E5", text: "#B45309" },
  Won: { bg: "#DCFCE7", text: "#15803D" },
  Lost: { bg: "#FEE2E2", text: "#B91C1C" },
};

const HEADER_STYLES: Record<string, { bg: string; text: string }> = {
  "New Lead": { bg: "rgba(255,255,255,0.22)", text: "#FFFFFF" },
  Contacted: { bg: "rgba(255,255,255,0.16)", text: "#E9F7EF" },
  Quoted: { bg: "rgba(255,244,229,0.28)", text: "#FFF4E5" },
  "Follow-up Due": { bg: "rgba(255,244,229,0.28)", text: "#FFF4E5" },
  Won: { bg: "rgba(220,252,231,0.28)", text: "#DCFCE7" },
  Lost: { bg: "rgba(254,226,226,0.28)", text: "#FEE2E2" },
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

  if (variant === "list") {
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
