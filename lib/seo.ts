/**
 * Central SEO config + helpers.
 *
 * - SITE: single source of truth for URLs and defaults.
 * - pageMetadata(): build per-page Next.js Metadata with canonical + OpenGraph + Twitter.
 * - JSON-LD builders: structured data objects rendered via <JsonLd /> (components/seo/JsonLd).
 *
 * Set metadataBase + default metadata once in the root app/layout.tsx (see ROOT_METADATA).
 */

import type { Metadata } from "next";

export const SITE = {
  name: "Segmiq",
  url: "https://segmiq.com",
  cloudUrl: "https://cloud.segmiq.com",
  tagline: "Revenue operating system for service businesses",
  description:
    "Segmiq is a revenue operating system for construction, solar, roofing, electrical, and landscaping businesses across Africa — capture, score, and close every lead.",
  // Default share image. The dynamic route app/opengraph-image.tsx renders this at /opengraph-image.
  ogImage: "/opengraph-image",
  twitter: "@segmiq", // update if/when a handle exists
  locale: "en",
};

/** Resolve a valid absolute site URL from env or SITE.url (handles bare hostnames). */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_DOMAIN ?? SITE.url;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  const host = raw.replace(/\/$/, "");
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export function getMetadataBase(): URL {
  return new URL(getSiteUrl());
}

/** Root metadata — merge into the root app/layout.tsx `metadata` export. */
export const ROOT_METADATA: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: SITE.url,
    locale: "en_ZW",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: { card: "summary_large_image", title: SITE.name, description: SITE.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  // verification: { google: "YOUR_SEARCH_CONSOLE_TOKEN" },
};

/** Build Metadata for a marketing page. `path` should start with "/". */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  images?: string[];
  noindex?: boolean;
}): Metadata {
  const url = new URL(opts.path, SITE.url).toString();
  const images = opts.images ?? [SITE.ogImage];
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName: SITE.name, title: opts.title, description: opts.description, images },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images },
    ...(opts.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

// ---------------- JSON-LD builders ----------------

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/icon.png`,
    description: SITE.description,
    areaServed: ["Zimbabwe", "Zambia", "South Africa", "Kenya"],
    sameAs: [] as string[], // add social profile URLs when available
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
  };
}

/** SaaS product — good for the product/pricing pages. */
export function softwareAppLd(opts?: { name?: string; description?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts?.name ?? "Segmiq CRM",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: opts?.description ?? SITE.description,
    offers: [
      { "@type": "Offer", name: "Starter", price: "99", priceCurrency: "USD" },
      { "@type": "Offer", name: "Growth", price: "199", priceCurrency: "USD" },
      { "@type": "Offer", name: "Scale", price: "349", priceCurrency: "USD" },
    ],
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: new URL(it.path, SITE.url).toString(),
    })),
  };
}

export function faqLd(qas: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qas.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function articleLd(opts: { title: string; description: string; slug: string; publishedAt: string; image?: string; author?: string }) {
  const url = `${SITE.url}/blog/${opts.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: opts.title,
    description: opts.description,
    datePublished: opts.publishedAt,
    dateModified: opts.publishedAt,
    image: opts.image,
    author: { "@type": "Organization", name: opts.author ?? SITE.name },
    publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: `${SITE.url}/icon.png` } },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
  };
}
