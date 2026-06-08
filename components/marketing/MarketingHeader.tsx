"use client";

/**
 * Shared marketing site header — nav + animated mobile menu.
 * Rendered once from app/(marketing)/layout.tsx, so every marketing page gets it.
 *
 * NAV hrefs are placeholders ("#") for sections not yet built. Wire them to real
 * routes (or dropdowns) as those pages land.
 */

import { useState } from "react";
import Link from "next/link";
import { Search, Menu, X } from "lucide-react";

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
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur border-b border-black/[0.08]">
      <div className="mx-auto max-w-[1100px] px-5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid place-items-center w-[26px] h-[26px] rounded-[7px] bg-[#D4FF4F] text-black font-extrabold text-sm">S</span>
            <span className="text-lg font-semibold tracking-tight">Segmiq</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-[#5b5b5b]">
            {NAV.map((n) => (
              <Link key={n.label} href={n.href} className="hover:text-black">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="#" aria-label="Search" className="hidden sm:inline text-[#5b5b5b] hover:text-black">
            <Search className="w-[18px] h-[18px]" />
          </Link>
          <Link href="#" className="hidden md:inline text-[#5b5b5b] hover:text-black">
            Docs
          </Link>
          <Link href="#" className="hidden md:inline text-[#5b5b5b] hover:text-black">
            Support
          </Link>
          <Link href="/login" className="hidden sm:inline font-medium hover:text-black">
            Sign in
          </Link>
          <Link
            href="/contact"
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

      {/* mobile menu */}
      <div
        className={`lg:hidden overflow-hidden transition-[max-height] duration-300 ease-in-out border-black/[0.08] bg-white ${
          open ? "max-h-96 border-t" : "max-h-0"
        }`}
      >
        <nav className="mx-auto max-w-[1100px] px-5 py-4 flex flex-col text-[15px]">
          {NAV.map((n) => (
            <Link
              key={n.label}
              href={n.href}
              onClick={() => setOpen(false)}
              className="py-2.5 border-b border-black/[0.08] text-[#5b5b5b] hover:text-black"
            >
              {n.label}
            </Link>
          ))}
          <div className="flex gap-3 pt-4">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex-1 text-center px-4 py-2.5 rounded-full border border-black/[0.08] font-semibold"
            >
              Sign in
            </Link>
            <Link
              href="/contact"
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
