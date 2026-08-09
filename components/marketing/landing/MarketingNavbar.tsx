"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";
import LandingThemeToggle from "@/components/marketing/landing/LandingThemeToggle";
import { ML } from "@/lib/marketing-links";

const NAV = [
  { label: "Product", href: ML.crm, chevron: true },
  { label: "Solutions", href: "/solutions/construction", chevron: true },
  { label: "Pricing", href: ML.pricing },
  { label: "Resources", href: ML.blog, chevron: true },
  { label: "Company", href: ML.why, chevron: true },
] as const;

export default function MarketingNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--marketing-border-subtle)] bg-[var(--marketing-bg)]">
      <div className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between px-6 sm:px-10 lg:px-12">
        <div className="flex min-w-0 items-center gap-10 xl:gap-14">
          <SegmiqWordmark href="/" theme="auto" size="sm" priority />
          <nav
            className="hidden items-center gap-7 text-[13px] font-medium text-[var(--marketing-text-label)] xl:gap-8 min-[1025px]:flex"
            aria-label="Primary"
          >
            {NAV.map((item) => {
              const className =
                "inline-flex items-center gap-1 transition-colors hover:text-[var(--marketing-text)]";
              const content = (
                <>
                  {item.label}
                  {"chevron" in item && item.chevron ? (
                    <ChevronDown
                      className="h-[13px] w-[13px] text-[var(--marketing-text-muted)]"
                      aria-hidden
                    />
                  ) : null}
                </>
              );
              return item.href.startsWith("http") ? (
                <a key={item.label} href={item.href} className={className}>
                  {content}
                </a>
              ) : (
                <Link key={item.label} href={item.href} className={className}>
                  {content}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <Link
            href={ML.login}
            className="hidden text-[13px] font-medium text-[var(--marketing-text-label)] transition-colors hover:text-[var(--marketing-text)] md:inline"
          >
            Log in
          </Link>
          <LandingThemeToggle />
          <Link
            href={ML.contact}
            className="inline-flex h-10 items-center gap-1.5 rounded-[9px] bg-[var(--marketing-brand)] px-[18px] text-[13px] font-semibold text-[var(--marketing-brand-ink)] transition-colors hover:bg-[var(--marketing-brand-hover)]"
          >
            Book a demo
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="-mr-1 grid h-10 w-10 place-items-center text-[var(--marketing-text)] min-[1025px]:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-[var(--marketing-border-subtle)] bg-[var(--marketing-bg)] transition-[max-height] duration-300 ease-out min-[1025px]:hidden ${
          open ? "max-h-[28rem] border-t" : "max-h-0"
        }`}
      >
        <nav
          className="mx-auto flex max-w-[1280px] flex-col px-6 py-3 sm:px-10 lg:px-12"
          aria-label="Mobile"
        >
          {NAV.map((item) =>
            item.href.startsWith("http") ? (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-[var(--marketing-border-subtle)] py-3 text-[15px] font-medium text-[var(--marketing-text-label)]"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-[var(--marketing-border-subtle)] py-3 text-[15px] font-medium text-[var(--marketing-text-label)]"
              >
                {item.label}
              </Link>
            )
          )}
          <Link
            href={ML.login}
            onClick={() => setOpen(false)}
            className="py-3 text-[15px] font-medium text-[var(--marketing-text-label)] md:hidden"
          >
            Log in
          </Link>
        </nav>
      </div>
    </header>
  );
}
