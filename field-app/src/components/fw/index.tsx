import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type FWCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
};

export function FWCard({ children, className = "", style, onClick }: FWCardProps) {
  const base: CSSProperties = {
    background: "#FFFFFF",
    border: "0.5px solid rgba(28,20,16,0.08)",
    borderRadius: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    overflow: "hidden",
    ...style,
  };
  return (
    <div style={base} className={className} onClick={onClick}>
      {children}
    </div>
  );
}

type FWSectionLabelProps = {
  children: ReactNode;
  className?: string;
};

export function FWSectionLabel({ children, className = "" }: FWSectionLabelProps) {
  return (
    <p
      className={`font-fw-body ${className}`}
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#8C7B6B",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

type FWButtonVariant = "primary" | "secondary" | "tertiary";

type FWButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: FWButtonVariant;
  children: ReactNode;
};

const variantStyles: Record<FWButtonVariant, CSSProperties> = {
  primary: {
    background: "#D4FF4F",
    color: "#1C1410",
    border: "none",
  },
  secondary: {
    background: "#1C1410",
    color: "#D4FF4F",
    border: "none",
  },
  tertiary: {
    background: "#FFFFFF",
    color: "#1C1410",
    border: "0.5px solid rgba(28,20,16,0.15)",
  },
};

export function FWButton({
  variant = "primary",
  children,
  style,
  className = "",
  ...rest
}: FWButtonProps) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    padding: "0 16px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "var(--fw-font-body)",
    whiteSpace: "nowrap",
    ...variantStyles[variant],
    ...style,
  };
  return (
    <button style={base} className={`font-fw-body ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function AvatarInitials({ name, size = 32 }: { name: string; size?: number }) {
  const initials = getInitials(name);
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-ink font-fw-body text-lime"
      style={{ width: size, height: size, fontSize: size * 0.34, fontWeight: 700 }}
    >
      {initials}
    </div>
  );
}

export function getInitials(name: string): string {
  const parts = (name || "").trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "LC";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export { getGreeting };
