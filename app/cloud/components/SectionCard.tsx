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
  dark:      { bg: "#111111", border: "rgba(255,255,255,0.07)" },
  team:      { bg: "linear-gradient(145deg, #FFFBF0 0%, #FFF3CC 100%)", border: "rgba(255,196,0,0.25)" },
  activity:  { bg: "linear-gradient(145deg, #F3EEFF 0%, #E5D5FF 100%)", border: "rgba(139,92,246,0.22)" },
  upload:    { bg: "linear-gradient(145deg, #EDFFF6 0%, #D0FFE8 100%)", border: "rgba(0,180,100,0.22)" },
  storage:   { bg: "linear-gradient(145deg, #EBF5FF 0%, #D0E8FF 100%)", border: "rgba(0,112,243,0.20)" },
  watermark: { bg: "linear-gradient(145deg, #FFF0F0 0%, #FFD9D9 100%)", border: "rgba(220,60,60,0.20)" },
  billing:   { bg: "linear-gradient(145deg, #F5FFD9 0%, #E8FF99 100%)", border: "rgba(140,200,0,0.30)" },
  profile:   { bg: "linear-gradient(145deg, #FFF5EB 0%, #FFE4C0 100%)", border: "rgba(210,120,0,0.22)" },
  white:     { bg: "#FFFFFF", border: "rgba(0,0,0,0.07)" },
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
