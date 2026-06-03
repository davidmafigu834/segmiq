/**
 * Shared marketing site footer. Server component (no interactivity).
 * Link hrefs are placeholders ("#") — wire to real routes as pages land.
 */

import Link from "next/link";

const COLS = [
  { h: "Why Segmiq", links: ["For service businesses", "Built for Africa", "WhatsApp-first", "Security"] },
  { h: "Products & pricing", links: ["Segmiq CRM", "Segmiq Cloud", "Pricing", "All features"] },
  { h: "Solutions", links: ["Construction", "Solar", "Roofing", "Electrical & landscaping"] },
  { h: "Resources", links: ["Docs", "Onboarding guide", "Blog", "Support"] },
  { h: "Engage", links: ["Contact sales", "Become a partner", "Book a demo", "We're hiring"] },
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
                {col.links.map((l) => (
                  <li key={l}>
                    <Link href="#" className="hover:text-black">
                      {l}
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
            <Link href="#" className="hover:text-black">
              Privacy
            </Link>
            <Link href="#" className="hover:text-black">
              Terms
            </Link>
            <Link href="#" className="hover:text-black">
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
