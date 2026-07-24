import React from "react";

// ── FWCard ──────────────────────────────────────────────────────────────────
type FWCardProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
};

export function FWCard({ children, className = "", style, onClick }: FWCardProps) {
  return (
    <div
      className={`cloud-card ${className}`.trim()}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── FWSectionLabel ───────────────────────────────────────────────────────────
type FWSectionLabelProps = {
  children: React.ReactNode;
  className?: string;
};

export function FWSectionLabel({ children, className = "" }: FWSectionLabelProps) {
  return (
    <p className={`cloud-section-label ${className}`.trim()}>
      {children}
    </p>
  );
}

// ── FWButton ─────────────────────────────────────────────────────────────────
type FWButtonVariant = "primary" | "secondary" | "ghost";

type FWButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: FWButtonVariant;
  children: React.ReactNode;
};

const variantClass: Record<FWButtonVariant, string> = {
  primary: "cloud-btn-primary",
  secondary: "cloud-btn-ink",
  ghost: "cloud-btn-ghost",
};

export function FWButton({
  variant = "primary",
  children,
  style,
  className = "",
  ...rest
}: FWButtonProps) {
  return (
    <button
      style={style}
      className={`${variantClass[variant]} font-cloud-body ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
