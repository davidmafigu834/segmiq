"use client";

import Link from "next/link";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";

const COLS = [
  {
    h: "Product",
    links: [
      { label: "WhatsApp Sales Hub", href: "/products/segmiq-crm" },
      { label: "Lead Management", href: "/features" },
      { label: "Automation", href: "/features" },
      { label: "Quotations", href: "/features" },
      { label: "Reports", href: "/features" },
    ],
  },
  {
    h: "Solutions",
    links: [
      { label: "Solar", href: "/solutions/solar" },
      { label: "Construction", href: "/solutions/construction" },
      { label: "Roofing", href: "/solutions/roofing" },
      { label: "Electrical", href: "/solutions/electrical-landscaping" },
      { label: "Landscaping", href: "/solutions/electrical-landscaping" },
      { label: "Real Estate", href: "/contact" },
    ],
  },
  {
    h: "Company",
    links: [
      { label: "About", href: "/why-segmiq" },
      { label: "Partners", href: "/partners" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    h: "Resources",
    links: [
      { label: "Blog", href: "https://blog.segmiq.com" },
      { label: "Help Centre", href: "/contact" },
      { label: "Blog", href: "https://blog.segmiq.com" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export default function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-black pb-8 pt-12 text-white">
      <div className="mx-auto max-w-[1120px] px-5">
        <div className="grid grid-cols-2 gap-8 text-[12px] md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-1">
            <SegmiqWordmark href="/" />
            <p className="mt-3 max-w-[190px] text-[10px] leading-4 text-white/35">Revenue operating system for service businesses in Africa.</p>
            <a href="mailto:hello@segmiq.com" className="mt-4 inline-block text-[10px] text-white/55 hover:text-white">
              hello@segmiq.com
            </a>
          </div>
          {COLS.map((col) => (
            <div key={col.h}>
              <div className="font-semibold mb-3">{col.h}</div>
              <ul className="space-y-2 text-white/45">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    {href.startsWith("http") ? (
                      <a href={href} className="hover:text-white">
                        {label}
                      </a>
                    ) : (
                      <Link href={href} className="hover:text-white">
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[10px] text-white/35 sm:flex-row">
          <span>© {new Date().getFullYear()} SegmiQ. All rights reserved.</span>
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
