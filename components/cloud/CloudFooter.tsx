/**
 * Segmiq Cloud footer — used on cloud.segmiq.com. Server component.
 */

import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";

const COLS = [
  {
    h: "Segmiq Cloud",
    links: [
      ["Features", "#features"],
      ["How it works", "#how"],
      ["Pricing", "#pricing"],
      ["Examples", "#examples"],
    ],
  },
  {
    h: "For trades",
    links: [
      ["Construction", "#features"],
      ["Solar", "#features"],
      ["Roofing", "#features"],
      ["Electrical & landscaping", "#features"],
    ],
  },
  {
    h: "Company",
    links: [
      ["Segmiq CRM", "https://segmiq.com"],
      ["Become a partner", "https://segmiq.com"],
      ["Support", "/cloud/help"],
    ],
  },
  {
    h: "Get started",
    links: [
      ["Book a demo", "/cloud/signup"],
      ["Sign in", "/cloud/login"],
      ["See pricing", "#pricing"],
    ],
  },
];

function SocialGlyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[18px] w-[18px] fill-current"
    >
      {children}
    </svg>
  );
}

const SOCIAL: { label: string; href: string; icon: ReactNode }[] = [
  {
    label: "Facebook",
    href: "https://facebook.com/segmiqcloud",
    icon: (
      <SocialGlyph>
        <path d="M14 8.2h2.2V5.1c-.3 0-1.5-.1-2.8-.1-2.8 0-4.7 1.7-4.7 4.8V12H6v3.4h2.7V22h3.3v-6.6H15l.5-3.4h-3.1V9.9c0-1 .3-1.7 1.6-1.7z" />
      </SocialGlyph>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com/segmiqcloud",
    icon: (
      <SocialGlyph>
        <path d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2zm5.1-8.2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 4.4c-2.1 0-2.3 0-3.1.1-.8 0-1.3.2-1.8.4-.5.2-.9.5-1.3.9-.4.4-.7.8-.9 1.3-.2.5-.3 1-.4 1.8-.1.8-.1 1-.1 3.1s0 2.3.1 3.1c0 .8.2 1.3.4 1.8.2.5.5.9.9 1.3.4.4.8.7 1.3.9.5.2 1 .3 1.8.4.8.1 1 .1 3.1.1s2.3 0 3.1-.1c.8 0 1.3-.2 1.8-.4.5-.2.9-.5 1.3-.9.4-.4.7-.8.9-1.3.2-.5.3-1 .4-1.8.1-.8.1-1 .1-3.1s0-2.3-.1-3.1c0-.8-.2-1.3-.4-1.8-.2-.5-.5-.9-.9-1.3-.4-.4-.8-.7-1.3-.9-.5-.2-1-.3-1.8-.4-.8-.1-1-.1-3.1-.1zm0 1.5c2 0 2.3 0 3.1.1.7 0 1.1.2 1.4.3.3.1.6.3.8.5.2.2.4.5.5.8.1.3.3.7.3 1.4.1.8.1 1 .1 3.1s0 2.3-.1 3.1c0 .7-.2 1.1-.3 1.4-.1.3-.3.6-.5.8-.2.2-.5.4-.8.5-.3.1-.7.3-1.4.3-.8.1-1 .1-3.1.1s-2.3 0-3.1-.1c-.7 0-1.1-.2-1.4-.3-.3-.1-.6-.3-.8-.5-.2-.2-.4-.5-.5-.8-.1-.3-.3-.7-.3-1.4-.1-.8-.1-1-.1-3.1s0-2.3.1-3.1c0-.7.2-1.1.3-1.4.1-.3.3-.6.5-.8.2-.2.5-.4.8-.5.3-.1.7-.3 1.4-.3.8-.1 1-.1 3.1-.1z" />
      </SocialGlyph>
    ),
  },
  {
    label: "X",
    href: "https://x.com/segmiqcloud",
    icon: (
      <SocialGlyph>
        <path d="M18.9 2H22l-6.8 7.8L23.3 22h-6.5l-5.1-6.7L5.9 22H2.8l7.3-8.3L1.5 2h6.7l4.6 6.1L18.9 2zm-1.1 18h1.8L7.1 3.9H5.2L17.8 20z" />
      </SocialGlyph>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/segmiqcloud",
    icon: (
      <SocialGlyph>
        <path d="M6.5 9.5H3.7V21h2.8V9.5zM5.1 3C4.1 3 3.3 3.8 3.3 4.9S4.1 6.8 5.1 6.8s1.8-.8 1.8-1.9S6.1 3 5.1 3zM21 13.3c0-3.3-1.8-4.8-4.1-4.8-1.9 0-2.7 1-3.2 1.8V9.5h-2.8c0 .8 0 11.5 0 11.5h2.8v-6.4c0-.3 0-.7.1-1 .3-.7.9-1.5 2-1.5 1.4 0 2 1.1 2 2.7V21H21v-7.7z" />
      </SocialGlyph>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@segmiqcloud",
    icon: (
      <SocialGlyph>
        <path d="M23 12.2s0-3.2-.4-4.7c-.2-.9-.9-1.6-1.8-1.8C19.3 5.3 12 5.3 12 5.3s-7.3 0-8.8.4c-.9.2-1.6.9-1.8 1.8C1 9 1 12.2 1 12.2s0 3.2.4 4.7c.2.9.9 1.6 1.8 1.8 1.5.4 8.8.4 8.8.4s7.3 0 8.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.5.4-4.7.4-4.7zM9.8 15.5v-6.6l6.1 3.3-6.1 3.3z" />
      </SocialGlyph>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@segmiqcloud",
    icon: (
      <SocialGlyph>
        <path d="M19.6 7.4a5.7 5.7 0 0 1-3.4-1.1v7.3a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.8a2.8 2.8 0 1 0 2 2.7V2h2.8a5.7 5.7 0 0 0 3.3 3.3v2.1z" />
      </SocialGlyph>
    ),
  },
];

export default function CloudFooter() {
  return (
    <footer className="border-t border-[#1C1410]/10 bg-[#1C1410] pb-8 pt-14 text-[#F7F4EF]">
      <div className="mx-auto max-w-[1100px] px-5">
        <div className="mb-12 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center bg-[#D4FF4F] text-[15px] font-extrabold text-[#1C1410]">
                S
              </span>
              <span className="text-lg font-semibold tracking-tight">
                Segmiq{" "}
                <span className="font-serif text-[1.05em] font-normal italic text-[#D4FF4F]">
                  Cloud
                </span>
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#F7F4EF]/55">
              The project portfolio built for Africa&apos;s trade businesses —
              document on site, share in one link, win the next job.
            </p>

            <div className="mt-6 space-y-3 text-sm">
              <a
                href="https://maps.google.com/?q=No+8+Roosevelt+Road,+Winston+Park,+Marondera"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2.5 text-[#F7F4EF]/70 transition hover:text-[#D4FF4F]"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#D4FF4F]" />
                <span>
                  No 8 Roosevelt Road, Winston Park
                  <br />
                  Marondera
                </span>
              </a>
              <a
                href="tel:+263718558160"
                className="flex items-center gap-2.5 text-[#F7F4EF]/70 transition hover:text-[#D4FF4F]"
              >
                <Phone className="h-4 w-4 shrink-0 text-[#D4FF4F]" />
                <span>+263 71 855 8160</span>
              </a>
            </div>
          </div>

          <div className="lg:justify-self-end">
            <div className="text-xs font-semibold tracking-[0.16em] text-[#F7F4EF]/45">
              FOLLOW /SEGMIQCLOUD
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {SOCIAL.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={`${label} · /segmiqcloud`}
                  className="grid h-10 w-10 place-items-center bg-white/10 text-[#F7F4EF] transition hover:bg-[#D4FF4F] hover:text-[#1C1410]"
                >
                  {icon}
                </a>
              ))}
            </div>
            <Link
              href="/cloud/signup"
              className="mt-6 inline-flex w-fit items-center bg-[#D4FF4F] px-5 py-2.5 text-[13px] font-semibold text-[#1C1410] transition hover:brightness-105"
            >
              Get started
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-4">
          {COLS.map((col) => (
            <div key={col.h}>
              <div className="mb-3 font-semibold text-[#F7F4EF]">{col.h}</div>
              <ul className="space-y-2 text-[#F7F4EF]/55">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="transition hover:text-[#D4FF4F]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[13px] text-[#F7F4EF]/45 sm:flex-row">
          <span>© 2026 Segmiq Cloud</span>
          <div className="flex gap-5">
            <Link href="#" className="transition hover:text-[#F7F4EF]">
              Privacy
            </Link>
            <Link href="#" className="transition hover:text-[#F7F4EF]">
              Terms
            </Link>
            <a href="https://segmiq.com" className="transition hover:text-[#F7F4EF]">
              segmiq.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
