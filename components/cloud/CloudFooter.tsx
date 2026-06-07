/**
 * Segmiq Cloud footer — used on cloud.segmiq.com. Server component.
 */

import Link from "next/link";

const COLS = [
  { h: "Segmiq Cloud", links: [["Features", "#features"], ["How it works", "#how"], ["Pricing", "#pricing"], ["Examples", "#examples"]] },
  { h: "For trades", links: [["Construction", "#"], ["Solar", "#"], ["Roofing", "#"], ["Electrical & landscaping", "#"]] },
  { h: "Company", links: [["Segmiq CRM", "https://segmiq.com"], ["Become a partner", "#"], ["Contact", "#"], ["Support", "#"]] },
  { h: "Get started", links: [["Book a demo", "#"], ["Sign in", "#"], ["See pricing", "#pricing"]] },
];

export default function CloudFooter() {
  return (
    <footer className="border-t border-[#1C1410]/10 pt-12 pb-8">
      <div className="mx-auto max-w-[1100px] px-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          {COLS.map((col) => (
            <div key={col.h}>
              <div className="font-semibold mb-3">{col.h}</div>
              <ul className="space-y-2 text-[#8C7B6B]">
                {col.links.map(([label, href]) => (
                  <li key={label}><Link href={href} className="hover:text-[#1C1410]">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-[#1C1410]/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-[#8C7B6B]">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-[22px] h-[22px] rounded-md bg-[#D4FF4F] text-[#1C1410] font-extrabold text-xs">S</span>
            <span>© 2026 Segmiq Cloud · cloud.segmiq.com</span>
          </div>
          <div className="flex gap-5">
            <Link href="#" className="hover:text-[#1C1410]">Privacy</Link>
            <Link href="#" className="hover:text-[#1C1410]">Terms</Link>
            <a href="https://segmiq.com" className="hover:text-[#1C1410]">segmiq.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
