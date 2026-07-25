"use client";

/**
 * Segmiq Cloud header — used on cloud.segmiq.com (its own theme, not the marketing shell).
 * Warm cream palette, Instrument Serif via Tailwind font-serif, dark CTA with lime text.
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
    <header className="sticky top-0 z-50 border-b border-[#1C1410]/10 bg-[#F7F4EF]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-5">
        <div className="flex items-center gap-8">
          <Link href="/cloud" className="group flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center bg-[#D4FF4F] text-[15px] font-extrabold text-[#1C1410] transition group-hover:brightness-105">
              S
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Segmiq{" "}
              <span className="font-serif text-[1.05em] font-normal italic">Cloud</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-[#8C7B6B] lg:flex">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className="transition hover:text-[#1C1410]"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <a
            href="https://segmiq.com"
            className="hidden text-[#8C7B6B] transition hover:text-[#1C1410] md:inline"
          >
            segmiq.com
          </a>
          <Link
            href="/cloud/login"
            className="hidden font-medium transition hover:text-[#1C1410] sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="/cloud/signup"
            className="hidden bg-[#1C1410] px-4 py-2 text-[13px] font-semibold text-[#D4FF4F] transition hover:brightness-110 sm:inline"
          >
            Book a demo
          </Link>
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
            className="-mr-2 grid h-10 w-10 place-items-center text-[#1C1410] lg:hidden"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-[#1C1410]/10 bg-[#F7F4EF] transition-[max-height] duration-300 ease-in-out lg:hidden ${
          open ? "max-h-80 border-t" : "max-h-0"
        }`}
      >
        <nav className="mx-auto flex max-w-[1100px] flex-col px-5 py-4 text-[15px]">
          {NAV.map((n) => (
            <a
              key={n.label}
              href={n.href}
              onClick={() => setOpen(false)}
              className="border-b border-[#1C1410]/10 py-2.5 text-[#8C7B6B] hover:text-[#1C1410]"
            >
              {n.label}
            </a>
          ))}
          <div className="flex gap-3 pt-4">
            <Link
              href="/cloud/login"
              className="flex-1 border border-[#1C1410]/15 px-4 py-2.5 text-center font-semibold"
            >
              Sign in
            </Link>
            <Link
              href="/cloud/signup"
              className="flex-1 bg-[#1C1410] px-4 py-2.5 text-center font-semibold text-[#D4FF4F]"
            >
              Book a demo
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
