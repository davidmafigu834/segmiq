import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";
import {
  FOOTER_CONTACT,
  FOOTER_LEGAL,
  FOOTER_NAV,
  FOOTER_SOCIAL_LINKS,
  type FooterLink,
  type FooterNavGroup,
} from "@/lib/marketing/footer-nav";
import SegmiQSectionAtmosphere from "@/components/marketing/landing/atmosphere/SegmiQSectionAtmosphere";

function FooterAnchor({ link, className }: { link: FooterLink; className: string }) {
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

function FooterLinkGroup({ group }: { group: FooterNavGroup }) {
  return (
    <nav aria-label={group.ariaLabel}>
      <p className="mb-4 segmiq-kicker text-[10px] text-[var(--marketing-text-muted)] sm:text-[11px]">
        {group.title}
      </p>
      <ul className="space-y-2.5">
        {group.links.map((link) => (
          <li key={link.label}>
            <FooterAnchor
              link={link}
              className="text-[13px] font-normal text-[var(--marketing-text-secondary)] transition-colors duration-150 hover:text-[var(--marketing-text)] sm:text-[14px]"
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Marketing footer — theme tokens; deep charcoal in dark mode. */
export default function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="marketing-halo marketing-halo--footer segmiq-section-rule border-t border-[var(--marketing-border-subtle)] bg-[var(--marketing-footer-bg)]">
      <SegmiQSectionAtmosphere tone="footer" />
      <div className="mx-auto max-w-[1280px] px-6 pb-6 pt-10 sm:px-10 sm:pb-7 sm:pt-12 lg:px-12 lg:pt-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-x-8 md:gap-y-10 lg:grid-cols-3 xl:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))_1.15fr] xl:gap-x-8">
          <div className="md:col-span-2 lg:col-span-3 xl:col-span-1">
            <SegmiqWordmark href="/" theme="auto" size="xl" />
            <p className="mt-4 max-w-[280px] text-[13px] leading-[1.6] text-[var(--marketing-text-secondary)] sm:text-[14px]">
              Introducing SegmiQ Agentic AI — the agent that sells with your team on WhatsApp.
            </p>
            <p className="mt-3 text-[12px] font-medium text-[var(--marketing-text-label)]">
              SegmiQ Agent · SegmiQ CRM · SegmiQ Cloud
            </p>

            {/* Social icons render when FOOTER_SOCIAL_LINKS is populated with verified URLs. */}
            {FOOTER_SOCIAL_LINKS.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-2">
                {FOOTER_SOCIAL_LINKS.map((item) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`SegmiQ on ${item.label}`}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-3 text-[12px] font-medium text-[var(--marketing-text-secondary)] transition-colors duration-150 hover:bg-[var(--marketing-hover)] hover:text-[var(--marketing-text)]"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {FOOTER_NAV.map((group) => (
            <div key={group.title} className="min-w-0">
              <FooterLinkGroup group={group} />
            </div>
          ))}

          <nav aria-label="Get in touch" className="min-w-0 md:col-span-2 lg:col-span-1">
            <p className="mb-4 segmiq-kicker text-[10px] text-[var(--marketing-text-muted)] sm:text-[11px]">
              Get in touch
            </p>
            <ul className="space-y-3">
              <li>
                <a
                  href={FOOTER_CONTACT.mailto}
                  className="inline-flex items-center gap-2 text-[13px] text-[var(--marketing-text-label)] transition-colors duration-150 hover:text-[var(--marketing-text)] sm:text-[14px]"
                >
                  <Mail className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
                  {FOOTER_CONTACT.email}
                </a>
              </li>
              <li>
                <Link
                  href={FOOTER_CONTACT.demoHref}
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--marketing-link)] transition-colors duration-150 hover:text-[var(--marketing-link-hover)] sm:text-[14px]"
                >
                  Book a demo
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--marketing-border-subtle)] pt-6 text-[12px] text-[var(--marketing-text-muted)] sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p>© {year} SegmiQ. All rights reserved.</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_LEGAL.map((link) => (
              <li key={link.label}>
                <FooterAnchor
                  link={link}
                  className="text-[var(--marketing-text-secondary)] transition-colors duration-150 hover:text-[var(--marketing-text)]"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
