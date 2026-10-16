"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type TitleEntry = { label: string; href: string; match: (pathname: string) => boolean };

/**
 * Left side of the Real Estate mobile header: the brand on the home screen,
 * otherwise the current screen title, with a back link on nested records.
 */
export function ReMobileHeaderTitle({
  entries,
  homeHref,
  home,
  extra = [],
}: {
  entries: TitleEntry[];
  homeHref: string;
  /** Rendered on the home screen (the wordmark link). */
  home: ReactNode;
  /** Account pages that are not in the navigation. */
  extra?: Array<{ label: string; href: string }>;
}) {
  const pathname = usePathname() ?? "";
  if (pathname === homeHref) return <>{home}</>;

  const matched = entries
    .filter((entry) => entry.href !== homeHref && entry.match(pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const fallback = extra.find((e) => pathname === e.href || pathname.startsWith(`${e.href}/`));
  const current = matched ?? fallback;
  if (!current) return <>{home}</>;

  const nested = pathname !== current.href && pathname.startsWith(`${current.href}/`);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      {nested ? (
        <Link
          href={current.href}
          aria-label={`Back to ${current.label}`}
          className="re-focus -ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-sales-text-primary hover:bg-sales-surface-hover"
        >
          <ChevronLeft size={20} strokeWidth={1.9} aria-hidden />
        </Link>
      ) : null}
      <p className="min-w-0 truncate text-[16px] font-semibold tracking-[-0.01em] text-sales-text-primary">
        {current.label}
      </p>
    </div>
  );
}
