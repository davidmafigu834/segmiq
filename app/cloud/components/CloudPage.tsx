import type { ReactNode } from "react";

type CloudPageProps = {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
};

/** Shared page chrome for SegmiQ Cloud dashboard routes. */
export function CloudPage({ children, className = "", narrow = false }: CloudPageProps) {
  return (
    <div className={`cloud-page ${narrow ? "cloud-page--narrow" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
