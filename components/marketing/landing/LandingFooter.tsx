import Link from "next/link";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";
import {
  FOOTER_CONTACT,
  FOOTER_LEGAL,
  FOOTER_NAV,
  FOOTER_SOCIAL_LINKS,
  type FooterLink,
} from "@/lib/marketing/footer-nav";

function FooterAnchor({ link }: { link: FooterLink }) {
  const className = "";
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

export default function LandingFooter() {
  const year = new Date().getFullYear();
  const links = [
    ...FOOTER_NAV.flatMap((group) => group.links),
    { label: FOOTER_CONTACT.email, href: FOOTER_CONTACT.mailto },
    ...FOOTER_LEGAL,
  ];

  return (
    <footer className="segmiq-foot-stmt bg-[var(--marketing-footer-bg)]">
      <div className="segmiq-shell">
        <p className="segmiq-foot-stmt__line">The agent sells with your team.</p>

        <div className="segmiq-foot-stmt__meta">
          <div className="min-w-0">
            <SegmiqWordmark href="/" theme="auto" size="lg" />
            <p className="mt-3 max-w-[36ch] text-[13px] leading-[1.55] text-[var(--marketing-text-secondary)]">
              SegmiQ Agent, SegmiQ CRM and SegmiQ Cloud for service businesses in Africa.
            </p>
          </div>
          <p className="text-[12px] text-[var(--marketing-text-muted)]">
            © {year} SegmiQ. All rights reserved.
          </p>
        </div>

        <nav className="segmiq-foot-links mt-8" aria-label="Footer">
          {links.map((link) => (
            <FooterAnchor key={`${link.href}-${link.label}`} link={link} />
          ))}
          {FOOTER_SOCIAL_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`SegmiQ on ${item.label}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
