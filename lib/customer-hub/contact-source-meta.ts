import {
  formatContactSourceLabel,
  normalizeContactSourceKey,
  SOURCE_DISPLAY,
  type NormalizedSource,
} from "@/lib/customer-hub/source-labels";

export type ContactSourceKind = NormalizedSource | "import";

export type ContactSourceMeta = {
  kind: ContactSourceKind;
  label: string;
  badgeLabel: string;
  accent: string;
  badgeTextClass: string;
  badgeBgClass: string;
  badgeBorderClass: string;
};

const STYLE: Record<
  ContactSourceKind,
  Omit<ContactSourceMeta, "kind" | "label" | "badgeLabel">
> = {
  walk_in: {
    accent: "#D4FF4F",
    badgeTextClass: "text-[#3d4f00] dark:text-[var(--accent-fg)]",
    badgeBgClass: "bg-[rgba(212,255,79,0.14)]",
    badgeBorderClass: "border-[rgba(212,255,79,0.35)]",
  },
  whatsapp_inbound: {
    accent: "#25D366",
    badgeTextClass: "text-[#166534]",
    badgeBgClass: "bg-[rgba(37,211,102,0.12)]",
    badgeBorderClass: "border-[rgba(37,211,102,0.28)]",
  },
  whatsapp_saved: {
    accent: "#128C7E",
    badgeTextClass: "text-[#0f766e]",
    badgeBgClass: "bg-[rgba(18,140,126,0.12)]",
    badgeBorderClass: "border-[rgba(18,140,126,0.28)]",
  },
  facebook: {
    accent: "#1877F2",
    badgeTextClass: "text-[#1d4ed8]",
    badgeBgClass: "bg-[rgba(24,119,242,0.12)]",
    badgeBorderClass: "border-[rgba(24,119,242,0.28)]",
  },
  referral: {
    accent: "#a78bfa",
    badgeTextClass: "text-[#6d28d9]",
    badgeBgClass: "bg-[rgba(167,139,250,0.12)]",
    badgeBorderClass: "border-[rgba(167,139,250,0.28)]",
  },
  import: {
    accent: "#64748b",
    badgeTextClass: "text-[var(--text-secondary)]",
    badgeBgClass: "bg-[var(--bg-tertiary)]",
    badgeBorderClass: "border-[var(--border)]",
  },
  other: {
    accent: "#94a3b8",
    badgeTextClass: "text-[var(--text-secondary)]",
    badgeBgClass: "bg-[var(--bg-tertiary)]",
    badgeBorderClass: "border-[var(--border)]",
  },
};

export function contactSourceMeta(raw: string | null): ContactSourceMeta {
  const label = formatContactSourceLabel(raw);
  const upper = (raw ?? "").trim().toUpperCase();
  const kind: ContactSourceKind =
    upper === "IMPORT" ? "import" : normalizeContactSourceKey(raw);
  const style = STYLE[kind];
  const badgeLabel =
    kind === "import" ? "Import" : (SOURCE_DISPLAY[kind as NormalizedSource]?.label ?? label);

  return {
    kind,
    label,
    badgeLabel,
    ...style,
  };
}
