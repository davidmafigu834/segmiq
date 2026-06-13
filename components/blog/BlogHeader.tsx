"use client";

/**
 * Header for blog.segmiq.com. Category nav links to homepage sections; Subscribe + search.
 * Links are root-relative because the blog is served at the subdomain root (middleware maps
 * blog.segmiq.com/* -> /blog/*).
 */

import { useState } from "react";
import Link from "next/link";
import { Search, Menu, X } from "lucide-react";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";

const NAV = [
  { label: "Insights", href: "/#insight" },
  { label: "Product", href: "/#product" },
  { label: "Customer Stories", href: "/#client" },
  { label: "Intelligence", href: "/#intelligence" },
  { label: "Announcements", href: "/#announcement" },
];

export default function BlogHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-black/[0.10]">
      <div className="mx-auto max-w-[1180px] px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <SegmiqWordmark href="" size="md" />
            <span className="text-lg font-semibold tracking-tight text-[#5b5b5b]">Blog</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-5 text-sm text-[#5b5b5b] pl-5 border-l border-black/[0.10]">
            {NAV.map((n) => <Link key={n.label} href={n.href} className="hover:text-black">{n.label}</Link>)}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/#subscribe" aria-label="Search" className="hidden sm:inline text-[#5b5b5b] hover:text-black"><Search className="w-[18px] h-[18px]" /></Link>
          <Link href="/#subscribe" className="px-4 py-2 rounded-full bg-[#D4FF4F] text-black font-semibold hover:bg-[#c8f040]">Subscribe</Link>
          <a href="https://segmiq.com" className="hidden md:inline text-[#5b5b5b] hover:text-black">segmiq.com</a>
          <button aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)} className="lg:hidden w-10 h-10 -mr-2 grid place-items-center">
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      <div className={`lg:hidden overflow-hidden transition-[max-height] duration-300 border-black/[0.10] bg-white ${open ? "max-h-80 border-t" : "max-h-0"}`}>
        <nav className="mx-auto max-w-[1180px] px-6 py-4 flex flex-col text-[15px]">
          {NAV.map((n) => <Link key={n.label} href={n.href} onClick={() => setOpen(false)} className="py-2.5 border-b border-black/[0.10] text-[#5b5b5b] hover:text-black">{n.label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
