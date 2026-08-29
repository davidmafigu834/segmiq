"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export function ToolCard({
  icon: Icon,
  iconTint,
  title,
  description,
  actionLabel,
  badge,
  onClick,
  href,
  featured,
}: {
  icon: LucideIcon;
  iconTint: string;
  title: string;
  description: string;
  actionLabel: string;
  badge?: string | null;
  onClick?: () => void;
  href?: string;
  featured?: boolean;
}) {
  const className = cn(
    "group flex h-full flex-col workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-5 text-left shadow-sales-card transition-[border-color,box-shadow] duration-150",
    "hover:border-sales-border-strong hover:shadow-[0_2px_8px_rgba(16,24,40,0.06)]",
    "focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
    featured ? "min-h-[190px]" : "min-h-[150px]"
  );

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-[12px]",
            iconTint
          )}
        >
          <Icon size={20} strokeWidth={1.8} aria-hidden />
        </span>
        {badge ? (
          <span className="rounded-[6px] bg-[var(--sales-neutral-100)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-sales-text-secondary">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-4 min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-sales-text-primary">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-snug text-sales-text-secondary">{description}</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-sales-brand-fg group-hover:gap-1.5">
        {actionLabel}
        <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden />
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {body}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}
