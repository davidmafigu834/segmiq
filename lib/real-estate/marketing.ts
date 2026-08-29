/**
 * Real-estate marketing attribution — first-touch acquisition connected to CRM outcomes.
 * Does not replace WhatsApp campaign attribution used by trades.
 */

export const RE_SOURCE_TYPES = [
  "facebook_ads",
  "instagram_ads",
  "website",
  "property_portal",
  "referral",
  "walk_in",
  "phone",
  "whatsapp",
  "manual",
  "other",
] as const;

export type ReSourceType = (typeof RE_SOURCE_TYPES)[number];

export const RE_SOURCE_LABEL: Record<ReSourceType, string> = {
  facebook_ads: "Facebook Ads",
  instagram_ads: "Instagram Ads",
  website: "Website",
  property_portal: "Property Portal",
  referral: "Referral",
  walk_in: "Walk-in",
  phone: "Phone",
  whatsapp: "WhatsApp",
  manual: "Manual Entry",
  other: "Other",
};

export const RE_CAMPAIGN_PLATFORMS = ["facebook", "instagram", "website", "other"] as const;
export type ReCampaignPlatform = (typeof RE_CAMPAIGN_PLATFORMS)[number];

export const RE_CAMPAIGN_PLATFORM_LABEL: Record<ReCampaignPlatform, string> = {
  facebook: "Facebook Ads",
  instagram: "Instagram Ads",
  website: "Website",
  other: "Other",
};

export const RE_DATE_PRESETS = ["today", "last_7", "this_month", "last_month", "custom"] as const;
export type ReDatePreset = (typeof RE_DATE_PRESETS)[number];

export function isReSourceType(value: string | null | undefined): value is ReSourceType {
  return (RE_SOURCE_TYPES as readonly string[]).includes(String(value ?? ""));
}

export function reSourceLabel(value: string | null | undefined): string {
  if (isReSourceType(value)) return RE_SOURCE_LABEL[value];
  return String(value ?? "Other").replace(/_/g, " ");
}

/** Map CRM lead.source + hub labels onto the RE marketing taxonomy. */
export function sourceTypeFromLeadSource(
  leadSource: string | null | undefined,
  extras?: { hubSource?: string | null; utmSource?: string | null; platform?: string | null }
): ReSourceType {
  const hub = String(extras?.hubSource ?? "").toLowerCase();
  if (hub.includes("refer")) return "referral";
  if (hub.includes("walk")) return "walk_in";
  if (hub.includes("phone") || hub.includes("call")) return "phone";
  if (hub.includes("whatsapp")) return "whatsapp";
  if (hub.includes("portal") || hub.includes("property24") || hub.includes("private property")) {
    return "property_portal";
  }
  if (hub.includes("instagram")) return "instagram_ads";
  if (hub.includes("facebook")) return "facebook_ads";
  if (hub.includes("website")) return "website";

  const platform = String(extras?.platform ?? "").toLowerCase();
  if (platform.includes("instagram")) return "instagram_ads";
  if (platform.includes("facebook") || platform === "fb") return "facebook_ads";

  const utm = String(extras?.utmSource ?? "").toLowerCase();
  if (utm === "instagram") return "instagram_ads";
  if (utm === "facebook" || utm === "fb" || utm === "meta") return "facebook_ads";

  const s = String(leadSource ?? "").toUpperCase();
  if (s === "FACEBOOK" || s === "FACEBOOK_AD") return "facebook_ads";
  if (s === "WEBSITE" || s === "LANDING_PAGE") return "website";
  if (s === "WHATSAPP_INBOUND") return "whatsapp";
  if (s === "REFERRAL") return "referral";
  if (s === "MANUAL") return "manual";
  return "other";
}

export function metaPlatformToSourceType(platform: string | null | undefined): ReSourceType {
  const p = String(platform ?? "").toLowerCase();
  if (p.includes("instagram") || p === "ig") return "instagram_ads";
  return "facebook_ads";
}

/** Closest existing leads.source value — do not invent unconstrained strings. */
export function leadSourceFromReType(type: ReSourceType): string {
  if (type === "facebook_ads" || type === "instagram_ads") return "FACEBOOK";
  if (type === "website") return "WEBSITE";
  if (type === "whatsapp") return "WHATSAPP_INBOUND";
  if (type === "referral") return "REFERRAL";
  return "MANUAL";
}

export function parseUtm(input: Record<string, unknown>): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
} {
  const pick = (keys: string[]): string | null => {
    for (const k of keys) {
      const v = input[k];
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, 500);
    }
    return null;
  };
  return {
    utm_source: pick(["utm_source", "utmSource"]),
    utm_medium: pick(["utm_medium", "utmMedium"]),
    utm_campaign: pick(["utm_campaign", "utmCampaign"]),
    utm_content: pick(["utm_content", "utmContent"]),
    utm_term: pick(["utm_term", "utmTerm"]),
  };
}

export function conversionPct(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function formatConversionPct(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

export function costPer(spend: number | null | undefined, count: number): number | null {
  if (spend == null || spend <= 0 || count <= 0) return null;
  return Math.round((spend / count) * 100) / 100;
}

export function medianNumber(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  return Math.round((((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2) * 10) / 10;
}

export function resolveReMarketingRange(
  preset: ReDatePreset,
  customFrom?: string | null,
  customTo?: string | null,
  now = new Date()
): { from: Date; to: Date; label: string } {
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const toExclusive = addDays(startOfDay(now), 1);

  if (preset === "custom" && customFrom && customTo) {
    const from = startOfDay(new Date(customFrom));
    const to = addDays(startOfDay(new Date(customTo)), 1);
    return { from, to, label: "Custom range" };
  }
  if (preset === "today") {
    return { from: startOfDay(now), to: toExclusive, label: "Today" };
  }
  if (preset === "last_7") {
    return { from: addDays(toExclusive, -7), to: toExclusive, label: "Last 7 days" };
  }
  if (preset === "last_month") {
    const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from: firstLast, to: firstThis, label: "Last month" };
  }
  const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: firstThis, to: toExclusive, label: "This month" };
}

export function maskWebsiteApiKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 8)}••••••••${key.slice(-4)}`;
}

export type AcquisitionFunnel = {
  inquiries: number;
  qualified: number;
  viewings: number;
  offers: number;
  accepted: number;
};

export function funnelRates(funnel: AcquisitionFunnel): {
  inquiryToQualified: number | null;
  qualifiedToViewing: number | null;
  viewingToOffer: number | null;
  offerToAccepted: number | null;
  inquiryToAccepted: number | null;
} {
  return {
    inquiryToQualified: conversionPct(funnel.qualified, funnel.inquiries),
    qualifiedToViewing: conversionPct(funnel.viewings, funnel.qualified),
    viewingToOffer: conversionPct(funnel.offers, funnel.viewings),
    offerToAccepted: conversionPct(funnel.accepted, funnel.offers),
    inquiryToAccepted: conversionPct(funnel.accepted, funnel.inquiries),
  };
}

export type CampaignAttentionFlag =
  | "high_volume_low_qualification"
  | "low_response"
  | "high_viewing_conversion"
  | "offers_generated"
  | "no_inquiries_7d";

export function campaignAttentionFlags(opts: {
  inquiries: number;
  qualified: number;
  viewings: number;
  offers: number;
  contacted: number;
  lastInquiryAt: string | null;
  now?: Date;
}): Array<{ id: CampaignAttentionFlag; label: string }> {
  const flags: Array<{ id: CampaignAttentionFlag; label: string }> = [];
  const now = opts.now ?? new Date();
  if (opts.inquiries >= 10 && conversionPct(opts.qualified, opts.inquiries) != null) {
    const q = conversionPct(opts.qualified, opts.inquiries)!;
    if (q < 25) {
      flags.push({
        id: "high_volume_low_qualification",
        label: "High inquiry volume, low qualification",
      });
    }
  }
  if (opts.inquiries >= 5 && opts.contacted / opts.inquiries < 0.6) {
    flags.push({ id: "low_response", label: "Low response rate" });
  }
  if (opts.qualified >= 4) {
    const v = conversionPct(opts.viewings, opts.qualified);
    if (v != null && v >= 60) {
      flags.push({ id: "high_viewing_conversion", label: "High viewing conversion" });
    }
  }
  if (opts.offers > 0) {
    flags.push({ id: "offers_generated", label: "Offers generated" });
  }
  if (opts.inquiries === 0) {
    flags.push({ id: "no_inquiries_7d", label: "No inquiries in 7 days" });
  } else if (opts.lastInquiryAt) {
    const age = now.getTime() - new Date(opts.lastInquiryAt).getTime();
    if (age > 7 * 24 * 60 * 60 * 1000) {
      flags.push({ id: "no_inquiries_7d", label: "No inquiries in 7 days" });
    }
  }
  if (opts.viewings >= 8 && opts.offers === 0) {
    flags.push({ id: "high_volume_low_qualification", label: "8 viewings, no offers" });
  }
  return flags;
}

export function propertyInsight(opts: {
  inquiries: number;
  viewings: number;
  offers: number;
}): string | null {
  if (opts.inquiries >= 10 && opts.viewings <= 1) {
    return "High inquiry volume, low viewing conversion";
  }
  if (opts.viewings >= 8 && opts.offers === 0) return "8 viewings, no offers";
  if (opts.inquiries >= 5 && opts.offers >= 1) return "Inquiries converting to offers";
  return null;
}

export type InquiryOutcomeFacts = {
  qualified: boolean;
  hadViewing: boolean;
  hadOffer: boolean;
  accepted: boolean;
  contacted: boolean;
};

export function accumulateFunnel(rows: InquiryOutcomeFacts[]): AcquisitionFunnel & { contacted: number } {
  return {
    inquiries: rows.length,
    qualified: rows.filter((r) => r.qualified).length,
    viewings: rows.filter((r) => r.hadViewing).length,
    offers: rows.filter((r) => r.hadOffer).length,
    accepted: rows.filter((r) => r.accepted).length,
    contacted: rows.filter((r) => r.contacted).length,
  };
}

export const HUB_RE_SOURCES = [
  "Facebook Ads",
  "Instagram Ads",
  "Website",
  "Property Portal",
  "Referral",
  "Walk-in",
  "Phone call",
  "WhatsApp",
  "Manual Entry",
  "Other",
] as const;

export function hubSourceToReType(hub: string | null | undefined): ReSourceType {
  return sourceTypeFromLeadSource("MANUAL", { hubSource: hub });
}
