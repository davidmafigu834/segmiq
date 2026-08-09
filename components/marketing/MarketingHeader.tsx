"use client";

/**
 * Shared marketing site header — nav + animated mobile menu.
 * Rendered once from app/(marketing)/layout.tsx, so every marketing page gets it.
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Globe2, Menu, X } from "lucide-react";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";
import { ML } from "@/lib/marketing-links";

const NAV = [
  { label: "Product", href: "/products/segmiq-crm", menu: true },
  { label: "Solutions", href: "/solutions", menu: true },
  { label: "Pricing", href: "/pricing" },
  { label: "Partners", href: "/partners" },
  { label: "Resources", href: ML.blog, menu: true },
];

export default function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-[58px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-14">
          <SegmiqWordmark href="/" priority />
          <nav className="hidden items-center gap-8 text-[12px] text-white/65 lg:flex">
            {NAV.map((n) =>
              n.href.startsWith("http") ? (
                <a key={n.label} href={n.href} className="flex items-center gap-1 hover:text-white">
                  {n.label}{n.menu && <ChevronDown className="h-3 w-3" />}
                </a>
              ) : (
                <Link key={n.label} href={n.href} className="flex items-center gap-1 hover:text-white">
                  {n.label}{n.menu && <ChevronDown className="h-3 w-3" />}
                </Link>
              )
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <button aria-label="Choose region" className="hidden text-white/55 transition hover:text-white sm:block">
            <Globe2 className="h-4 w-4" />
          </button>
          <Link href={ML.login} className="hidden font-medium text-white/55 transition hover:text-white md:inline">
            Sign in
          </Link>
          <Link
            href={ML.contact}
            className="hidden rounded-md bg-[#D4FF4F] px-4 py-2 font-semibold text-black hover:bg-[#e2ff79] sm:inline"
          >
            Book a demo
          </Link>
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
            className="-mr-2 grid h-10 w-10 place-items-center lg:hidden"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div
        className={`lg:hidden overflow-hidden transition-[max-height] duration-300 ease-in-out border-white/10 bg-black ${
          open ? "max-h-96 border-t" : "max-h-0"
        }`}
      >
        <nav className="mx-auto max-w-[1100px] px-5 py-4 flex flex-col text-[15px]">
          {NAV.map((n) =>
            n.href.startsWith("http") ? (
              <a
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="py-2.5 border-b border-white/10 font-medium text-white/65 hover:text-white"
              >
                {n.label}
              </a>
            ) : (
              <Link
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="py-2.5 border-b border-white/10 font-medium text-white/65 hover:text-white"
              >
                {n.label}
              </Link>
            )
          )}
          <div className="flex gap-3 pt-4">
            <Link
              href={ML.login}
              onClick={() => setOpen(false)}
              className="flex-1 text-center px-4 py-2.5 rounded-full border border-white/20 font-semibold"
            >
              Sign in
            </Link>
            <Link
              href={ML.contact}
              onClick={() => setOpen(false)}
              className="flex-1 text-center px-4 py-2.5 rounded-full bg-[#D4FF4F] text-black font-semibold"
            >
              Book a demo
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
