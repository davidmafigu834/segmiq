import type { DealSide, LeadSource } from "@/types";
import { parseUtm, sourceTypeFromLeadSource, type ReSourceType } from "./marketing";

export function mapWebsiteIngestSource(raw: unknown): LeadSource {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "facebook_ad" || s === "facebook" || s === "facebook_ads" || s === "fb") {
    return "FACEBOOK_AD";
  }
  if (s === "instagram" || s === "instagram_ads") return "FACEBOOK_AD";
  if (s === "referral") return "REFERRAL";
  if (s === "whatsapp") return "WHATSAPP_INBOUND";
  if (s === "website" || s === "landing_page" || s === "") return "WEBSITE";
  return "WEBSITE";
}

export function mapWebsiteIngestDealSide(raw: unknown): DealSide | null {
  const s = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  if (s === "buy_side" || s === "sell_side" || s === "landlord_side" || s === "tenant_side") {
    return s;
  }
  if (s === "property" || s === "buy" || s === "buyer") return "buy_side";
  if (s === "sell" || s === "seller") return "sell_side";
  if (s === "landlord" || s === "let_out") return "landlord_side";
  if (s === "tenant" || s === "to_let" || s === "rent") return "tenant_side";
  if (s === "general") return null;
  return null;
}

export function websiteAttributionSourceType(leadSource: LeadSource, body: Record<string, unknown>): ReSourceType {
  return sourceTypeFromLeadSource(leadSource, {
    utmSource: typeof body.utm_source === "string" ? body.utm_source : null,
    platform: typeof body.platform === "string" ? body.platform : null,
    hubSource: typeof body.source === "string" ? body.source : null,
  });
}

export function websiteUtmFromBody(body: Record<string, unknown>) {
  return parseUtm(body);
}

export function websiteExternalLeadId(body: Record<string, unknown>): string | null {
  const raw = body.external_lead_id ?? body.lead_id ?? body.submission_id;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t.slice(0, 200) : null;
}

export function listingLookupAllowed(businessType: unknown): boolean {
  return businessType === "real_estate";
}
