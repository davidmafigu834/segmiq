"use client";

import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";

export function BrandIcon({
  brand,
  size = 16,
  className,
}: {
  brand: "whatsapp" | "facebook";
  size?: number;
  className?: string;
}) {
  if (brand === "whatsapp") {
    return (
      <SiWhatsapp
        size={size}
        color="#25D366"
        className={cn(className)}
        aria-hidden
      />
    );
  }
  return (
    <SiFacebook size={size} color="#1877F2" className={cn(className)} aria-hidden />
  );
}

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-[var(--sales-z-tooltip,110)] hidden -translate-x-1/2 whitespace-nowrap rounded-sales-sm bg-sales-text-primary px-2 py-1 text-[11px] font-medium text-white group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}
