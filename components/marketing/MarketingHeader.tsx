"use client";

/**
 * Shared marketing site header — nav + animated mobile menu.
 * Rendered once from app/(marketing)/layout.tsx, so every marketing page gets it.
 */

import { useState } from "react";
import Link from "next/link";
import { Search, Menu, X } from "lucide-react";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";
import { ML } from "@/lib/marketing-links";

const NAV = [
  { label: "Overview", href: "/" },
  { label: "Why Segmiq", href: "/why-segmiq" },
  { label: "Security", href: "/security" },
  { label: "Segmiq CRM", href: "/products/segmiq-crm" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
];

export default function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 text-white backdrop-blur">
      <div className="mx-auto max-w-[1100px] px-5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <SegmiqWordmark href="/" priority />
          <nav className="hidden lg:flex items-center gap-6 text-sm text-white/60">
            {NAV.map((n) => (
              <Link key={n.label} href={n.href} className="hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href={ML.blog} aria-label="Search" className="hidden sm:inline text-white/60 hover:text-white">
            <Search className="w-[18px] h-[18px]" />
          </Link>
          <Link href={ML.features} className="hidden md:inline text-white/60 hover:text-white">
            Docs
          </Link>
          <Link href={ML.contact} className="hidden md:inline text-white/60 hover:text-white">
            Support
          </Link>
          <Link href={ML.login} className="hidden sm:inline font-medium hover:text-[#D4FF4F]">
            Sign in
          </Link>
          <Link
            href={ML.contact}
            className="hidden sm:inline px-4 py-2 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]"
          >
            Book a demo
          </Link>
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
            className="lg:hidden w-10 h-10 -mr-2 grid place-items-center"
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
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              onClick={() => setOpen(false)}
              className="py-2.5 border-b border-white/10 font-medium text-white/65 hover:text-white"
            >
              {n.label}
            </Link>
          ))}
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
