import React from "react";

export type SectionCardVariant =
  | "dark"
  | "team"
  | "activity"
  | "upload"
  | "storage"
  | "watermark"
  | "billing"
  | "profile"
  | "white";

const VARIANT_STYLES: Record<SectionCardVariant, { bg: string; border: string }> = {
  dark:      { bg: "var(--cloud-ink)", border: "rgba(255,255,255,0.08)" },
  team:      { bg: "var(--cloud-surface)", border: "var(--cloud-border)" },
  activity:  { bg: "var(--cloud-surface)", border: "var(--cloud-border)" },
  upload:    { bg: "var(--cloud-surface)", border: "var(--cloud-border)" },
  storage:   { bg: "var(--cloud-surface)", border: "var(--cloud-border)" },
  watermark: { bg: "var(--cloud-surface)", border: "var(--cloud-border)" },
  billing:   { bg: "var(--cloud-surface)", border: "var(--cloud-border)" },
  profile:   { bg: "var(--cloud-surface)", border: "var(--cloud-border)" },
  white:     { bg: "var(--cloud-surface)", border: "var(--cloud-border)" },
};

type Props = {
  variant: SectionCardVariant;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
};

export function SectionCard({ variant, children, className, onClick, style }: Props) {
  const { bg, border } = VARIANT_STYLES[variant];
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: bg,
        border: `0.5px solid ${border}`,
        borderRadius: 20,
        overflow: "hidden",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
