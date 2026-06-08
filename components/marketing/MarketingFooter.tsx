/**
 * Shared marketing site footer. Server component (no interactivity).
 */

import Link from "next/link";

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
    <footer className="border-t border-black/[0.08] pt-12 pb-8 bg-[#F8F7F4]">
      <div className="mx-auto max-w-[1100px] px-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
          {COLS.map((col) => (
            <div key={col.h}>
              <div className="font-semibold mb-3">{col.h}</div>
              <ul className="space-y-2 text-[#5b5b5b]">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="hover:text-black">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-black/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-[#8a8a8a]">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-[22px] h-[22px] rounded-md bg-[#D4FF4F] text-black font-extrabold text-xs">S</span>
            <span>© 2026 Segmiq · segmiq.com</span>
          </div>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-black">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-black">
              Terms
            </Link>
            <Link href="/status" className="hover:text-black">
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
