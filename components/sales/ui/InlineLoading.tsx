"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function InlineLoading({
  label = "Loading…",
  className,
  size = "md",
}: {
  label?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <div
      className={cn("inline-flex items-center gap-2 text-sales-text-secondary", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 size={iconSize} className="shrink-0 animate-spin" aria-hidden />
      <span className={cn("font-medium", size === "sm" ? "text-[12px]" : "text-[13px]")}>{label}</span>
    </div>
  );
}
