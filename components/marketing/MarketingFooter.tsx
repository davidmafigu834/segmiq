"use client";

import Link from "next/link";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";

const COLS = [
  {
    h: "Platform",
    links: [
      { label: "Overview", href: "/" },
      { label: "Why Segmiq", href: "/why-segmiq" },
      { label: "Security", href: "/security" },
      { label: "Status", href: "/status" },
      { label: "Segmiq CRM", href: "/products/segmiq-crm" },
    ],
  },
  {
    h: "Products & pricing",
    links: [
      { label: "Segmiq CRM", href: "/products/segmiq-crm" },
      { label: "Segmiq Cloud", href: "https://cloud.segmiq.com" },
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    h: "Solutions",
    links: [
      { label: "Construction", href: "/solutions/construction" },
      { label: "Solar", href: "/solutions/solar" },
      { label: "Roofing", href: "/solutions/roofing" },
      { label: "Electrical & landscaping", href: "/solutions/electrical-landscaping" },
    ],
  },
  {
    h: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Status", href: "/status" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
  {
    h: "Engage",
    links: [
      { label: "Book a demo", href: "/contact" },
      { label: "Contact sales", href: "/contact" },
      { label: "Become a partner", href: "/partners" },
      { label: "Careers", href: "/careers" },
    ],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/90 pt-12 pb-8 text-white">
      <div className="mx-auto max-w-[1100px] px-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
          {COLS.map((col) => (
            <div key={col.h}>
              <div className="font-semibold mb-3">{col.h}</div>
              <ul className="space-y-2 text-white/60">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-white/45">
          <div className="flex items-center gap-3">
            <SegmiqWordmark href="/" size="sm" />
            <span>© 2026 Segmiq · segmiq.com</span>
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/status" className="hover:text-white">
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
