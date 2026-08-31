"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type SalesBreadcrumbItem = {
  label: string;
  href?: string;
};

function prettyCrumb(part: string) {
  const trimmed = part.trim();
  if (!trimmed) return trimmed;
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .replace(/\bwhatsapp\b/g, "WhatsApp")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bWhatsapp\b/g, "WhatsApp");
  }
  return trimmed;
}

function crumbsFromString(value: string): SalesBreadcrumbItem[] {
  return value
    .split(/\s*\/\s*/)
    .map(prettyCrumb)
    .filter(Boolean)
    .map((label) => ({ label }));
}

export function SalesBreadcrumbs({
  value,
  items,
  className,
  maxItems = 4,
}: {
  /** Legacy string trail — "Sales / Leads / Detail" */
  value?: string;
  /** Structured trail with optional ancestor links */
  items?: SalesBreadcrumbItem[];
  className?: string;
  /** Desktop truncation — keeps first + last segments when exceeded */
  maxItems?: number;
}) {
  const raw = items ?? (value ? crumbsFromString(value) : []);
  if (raw.length === 0) return null;

  const visible =
    raw.length <= maxItems
      ? raw
      : [raw[0], { label: "…" }, ...raw.slice(-Math.max(1, maxItems - 2))];

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-[11px] leading-none text-sales-text-muted sm:text-[12px]">
        {visible.map((part, index) => {
          const last = index === visible.length - 1;
          const isEllipsis = part.label === "…";
          return (
            <li key={`${part.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight size={12} strokeWidth={1.8} className="shrink-0 opacity-45" aria-hidden />
              ) : null}
              {isEllipsis ? (
                <span className="px-0.5 font-medium" aria-hidden>
                  …
                </span>
              ) : part.href && !last ? (
                <Link
                  href={part.href}
                  className="truncate font-medium transition-colors hover:text-sales-text-secondary focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] rounded-[4px]"
                >
                  {part.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "truncate font-medium",
                    last ? "text-sales-text-secondary" : undefined
                  )}
                  aria-current={last ? "page" : undefined}
                >
                  {part.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
