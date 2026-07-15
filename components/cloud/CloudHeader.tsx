"use client";

/**
 * Segmiq Cloud header — used on cloud.segmiq.com (its own theme, not the marketing shell).
 * Warm cream palette, Georgia-ish serif via Tailwind font-serif, dark CTA with lime text.
 */

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "Examples", href: "#examples" },
];

export default function CloudHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur border-b border-[#1C1410]/10 bg-[#F7F4EF]/85">
      <div className="mx-auto max-w-[1100px] px-5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-[#D4FF4F] text-[#1C1410] font-extrabold text-[15px]">S</span>
            <span className="text-lg font-semibold tracking-tight">Segmiq <span className="font-serif italic font-normal">Cloud</span></span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-[#8C7B6B]">
            {NAV.map((n) => (
              <a key={n.label} href={n.href} className="hover:text-[#1C1410]">{n.label}</a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a href="https://segmiq.com" className="hidden md:inline text-[#8C7B6B] hover:text-[#1C1410]">segmiq.com</a>
          <Link href="/cloud/login" className="hidden sm:inline font-medium hover:text-[#1C1410]">Sign in</Link>
          <Link href="#" className="hidden sm:inline px-4 py-2 rounded-full font-semibold bg-[#1C1410] text-[#D4FF4F]">Book a demo</Link>
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
            className="lg:hidden w-10 h-10 -mr-2 grid place-items-center text-[#1C1410]"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div className={`lg:hidden overflow-hidden transition-[max-height] duration-300 ease-in-out border-[#1C1410]/10 bg-[#F7F4EF] ${open ? "max-h-80 border-t" : "max-h-0"}`}>
        <nav className="mx-auto max-w-[1100px] px-5 py-4 flex flex-col text-[15px]">
          {NAV.map((n) => (
            <a key={n.label} href={n.href} onClick={() => setOpen(false)} className="py-2.5 border-b border-[#1C1410]/10 text-[#8C7B6B] hover:text-[#1C1410]">{n.label}</a>
          ))}
          <div className="flex gap-3 pt-4">
            <Link href="/cloud/login" className="flex-1 text-center px-4 py-2.5 rounded-full border border-[#1C1410]/10 font-semibold">Sign in</Link>
            <Link href="#" className="flex-1 text-center px-4 py-2.5 rounded-full font-semibold bg-[#1C1410] text-[#D4FF4F]">Book a demo</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
