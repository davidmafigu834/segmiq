import { SITE } from "@/lib/seo";

/** Canonical hrefs for marketing CTAs and navigation. */
export const ML = {
  contact: "/contact",
  login: "/login",
  pricing: "/pricing",
  features: "/features",
  crm: "/products/segmiq-crm",
  why: "/why-segmiq",
  security: "/security",
  partners: "/partners",
  careers: "/careers",
  blog: SITE.blogUrl,
  status: "/status",
  cloud: SITE.cloudUrl,
  cloudHelp: `${SITE.cloudUrl}/help`,
  homePricing: "/#pricing",
  homeSolutions: "/#solutions",
  featuresIntelligence: "/features#intelligence",
  featuresWhatsapp: "/features#whatsapp",
  featuresConvert: "/features#convert",
  featuresDashboards: "/features#dashboards",
  featuresRecovery: "/features#recovery",
  featuresSegments: "/features#segments",
  featuresSecurity: "/features#security",
  mailHello: "mailto:hello@segmiq.com",
  mailCareers: "mailto:careers@segmiq.com",
  mailSecurity: "mailto:security@segmiq.com",
} as const;

export const INDUSTRY_SOLUTION_HREF: Record<string, string> = {
  Construction: "/solutions/construction",
  Solar: "/solutions/solar",
  Roofing: "/solutions/roofing",
  Electrical: "/solutions/electrical-landscaping",
  Landscaping: "/solutions/electrical-landscaping",
  Trades: ML.crm,
  "Real estate dev": ML.contact,
};

export function industrySolutionHref(name: string): string {
  return INDUSTRY_SOLUTION_HREF[name] ?? ML.contact;
}

export const FEATURE_CARD_HREF: Record<string, string> = {
  PLATFORM: ML.crm,
  WHATSAPP: ML.featuresWhatsapp,
  INTELLIGENCE: ML.featuresIntelligence,
};

export const STORY_HREF: Record<string, string> = {
  "Solar + Segmiq": "/solutions/solar",
  "Roofing + Segmiq": "/solutions/roofing",
  "Electrical + Segmiq": "/solutions/electrical-landscaping",
};
