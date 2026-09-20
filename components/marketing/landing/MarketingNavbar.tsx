"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";
import { ML } from "@/lib/marketing-links";

const PRIMARY = [
  { label: "Agentic AI", href: ML.agentic },
  { label: "Company Brain", href: ML.brain },
  { label: "Pricing", href: ML.pricing },
] as const;

const MORE = [
  { label: "Product", href: ML.crm },
  { label: "Solutions", href: "/solutions/construction" },
  { label: "Resources", href: ML.blog },
  { label: "Company", href: ML.why },
] as const;

const MOBILE = [...PRIMARY, ...MORE] as const;

function NavAnchor({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (href.startsWith("http")) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

export default function MarketingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="segmiq-nav-pill">
        <SegmiqWordmark href="/" theme="auto" size="md" priority />
        <nav className="segmiq-nav-pill__links" aria-label="Primary">
          {PRIMARY.map((item) => (
            <NavAnchor key={item.label} href={item.href} className="">
              {item.label}
            </NavAnchor>
          ))}
          <details className="segmiq-nav-more">
            <summary>More</summary>
            <div className="segmiq-nav-more__panel">
              {MORE.map((item) => (
                <NavAnchor key={item.label} href={item.href} className="">
                  {item.label}
                </NavAnchor>
              ))}
            </div>
          </details>
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            href={ML.login}
            className="hidden px-1 text-[13px] font-medium md:inline"
          >
            Log in
          </Link>
          <Link
            href={ML.contact}
            className="segmiq-btn-primary inline-flex h-9 items-center rounded-full bg-[var(--marketing-brand)] px-3.5 text-[13px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)] sm:px-4"
          >
            Book a demo
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center text-[var(--marketing-text)] min-[1025px]:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <nav
        className="segmiq-nav-mobile"
        data-open={open ? "true" : "false"}
        aria-label="Mobile"
      >
        {MOBILE.map((item) => (
          <NavAnchor
            key={item.label}
            href={item.href}
            onClick={() => setOpen(false)}
            className="border-b border-[var(--marketing-border-subtle)] py-3 text-[15px] font-medium text-[var(--marketing-text-label)]"
          >
            {item.label}
          </NavAnchor>
        ))}
        <Link
          href={ML.login}
          onClick={() => setOpen(false)}
          className="py-3 text-[15px] font-medium text-[var(--marketing-text-label)] md:hidden"
        >
          Log in
        </Link>
      </nav>
    </>
  );
}
