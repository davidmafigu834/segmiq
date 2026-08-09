import Link from "next/link";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";
import {
  FOOTER_CONTACT,
  FOOTER_LEGAL,
  FOOTER_NAV,
  type FooterLink,
} from "@/lib/marketing/footer-nav";

function DarkLink({ link }: { link: FooterLink }) {
  const className = "hover:text-white";
  if (link.external || link.href.startsWith("http") || link.href.startsWith("mailto:")) {
    return (
      <a
        href={link.href}
        className={className}
        {...(link.href.startsWith("http")
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

/** Dark marketing footer for non-home marketing pages. */
export default function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-black pb-8 pt-12 text-white">
      <div className="mx-auto max-w-[1120px] px-5">
        <div className="grid grid-cols-2 gap-8 text-[12px] md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-1">
            <SegmiqWordmark href="/" />
            <p className="mt-3 max-w-[220px] text-[10px] leading-4 text-white/35">
              The revenue operating system for service businesses in Africa.
            </p>
            <a
              href={FOOTER_CONTACT.mailto}
              className="mt-4 inline-block text-[10px] text-white/55 hover:text-white"
            >
              {FOOTER_CONTACT.email}
            </a>
          </div>
          {FOOTER_NAV.map((col) => (
            <div key={col.title}>
              <div className="mb-3 font-semibold">{col.title}</div>
              <ul className="space-y-2 text-white/45">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <DarkLink link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[10px] text-white/35 sm:flex-row">
          <span>© {year} SegmiQ. All rights reserved.</span>
          <div className="flex flex-wrap justify-center gap-5">
            {FOOTER_LEGAL.map((link) => (
              <DarkLink key={link.label} link={link} />
            ))}
            <Link href="/status" className="hover:text-white">
              Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
