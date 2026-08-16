"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function SettingsActionRow({
  icon,
  label,
  href,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "flex h-11 w-full items-center gap-3 rounded-[8px] px-2 text-left text-[13px] text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]";
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sales-brand-soft text-sales-text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <ChevronRight size={15} className="shrink-0 text-sales-text-muted" aria-hidden />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cn(className)}>
      {body}
    </button>
  );
}
