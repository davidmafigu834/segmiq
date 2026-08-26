import { ML } from "@/lib/marketing-links";

export type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type FooterNavGroup = {
  title: string;
  ariaLabel: string;
  links: FooterLink[];
};

/** Public contact — verified marketing email only. */
export const FOOTER_CONTACT = {
  email: "hello@segmiq.com",
  mailto: ML.mailHello,
  demoHref: ML.contact,
} as const;

/**
 * Verified SegmiQ social profiles for the main marketing site.
 * Cloud-only accounts (segmiqcloud) are intentionally omitted here.
 * Add entries only when official SegmiQ brand URLs are confirmed.
 */
export const FOOTER_SOCIAL_LINKS: {
  label: string;
  href: string;
  network: "linkedin" | "facebook" | "instagram" | "x" | "youtube";
}[] = [];

export const FOOTER_NAV: FooterNavGroup[] = [
  {
    title: "Product",
    ariaLabel: "Product",
    links: [
      { label: "SegmiQ Agentic AI", href: ML.agentic },
      { label: "Company Brain", href: ML.brain },
      { label: "WhatsApp Sales Hub", href: ML.featuresWhatsapp },
      { label: "Lead & Pipeline Management", href: ML.crm },
      { label: "Quotations", href: ML.featuresConvert },
      { label: "Follow-ups", href: ML.featuresConvert },
      { label: "SegmiQ Cloud", href: ML.cloud, external: true },
    ],
  },
  {
    title: "Solutions",
    ariaLabel: "Solutions",
    links: [
      { label: "Solar & Energy", href: "/solutions/solar" },
      { label: "Construction", href: "/solutions/construction" },
      { label: "Roofing", href: "/solutions/roofing" },
      { label: "Electrical", href: "/solutions/electrical-landscaping" },
    ],
  },
  {
    title: "Resources",
    ariaLabel: "Resources",
    links: [
      { label: "Blog", href: ML.blog, external: true },
      { label: "Help Center", href: ML.cloudHelp, external: true },
      { label: "Security", href: ML.security },
      { label: "Status", href: ML.status },
    ],
  },
  {
    title: "Company",
    ariaLabel: "Company",
    links: [
      { label: "About Us", href: ML.why },
      { label: "Careers", href: ML.careers },
      { label: "Partners", href: ML.partners },
      { label: "Contact Us", href: ML.contact },
    ],
  },
];

export const FOOTER_LEGAL: FooterLink[] = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
];
