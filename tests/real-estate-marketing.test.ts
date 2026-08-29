import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  accumulateFunnel,
  conversionPct,
  costPer,
  funnelRates,
  hubSourceToReType,
  leadSourceFromReType,
  maskWebsiteApiKey,
  metaPlatformToSourceType,
  parseUtm,
  propertyInsight,
  resolveReMarketingRange,
  sourceTypeFromLeadSource,
  RE_SOURCE_TYPES,
} from "../lib/real-estate/marketing";
import {
  listingLookupAllowed,
  mapWebsiteIngestDealSide,
  mapWebsiteIngestSource,
  websiteAttributionSourceType,
  websiteExternalLeadId,
  websiteUtmFromBody,
} from "../lib/real-estate/website-ingest";
import {
  mapFormToBuyerRequirements,
  parseBedroomsWanted,
  parseBudgetBand,
  parseTimeline,
} from "../lib/real-estate/buyer-form-map";
import { firstMarketingResponseAt } from "../lib/real-estate/marketing-service";
import { sourceFromString } from "../lib/lead-helpers";
import { canSeeInternalComplianceNotes, DEFAULT_COMPLIANCE_SETTINGS } from "../lib/real-estate/compliance";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("source taxonomy", () => {
  it("uses stable codes with friendly labels", () => {
    assert.deepEqual([...RE_SOURCE_TYPES], [
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
    ]);
    assert.equal(hubSourceToReType("Referral"), "referral");
    assert.equal(hubSourceToReType("Facebook Ads"), "facebook_ads");
    assert.equal(hubSourceToReType("Property Portal"), "property_portal");
    assert.equal(leadSourceFromReType("website"), "WEBSITE");
    assert.equal(leadSourceFromReType("facebook_ads"), "FACEBOOK");
    assert.equal(leadSourceFromReType("referral"), "REFERRAL");
    assert.equal(sourceFromString("WEBSITE"), "WEBSITE");
    assert.equal(sourceFromString("FACEBOOK_AD"), "FACEBOOK_AD");
    assert.equal(sourceTypeFromLeadSource("WEBSITE"), "website");
    assert.equal(metaPlatformToSourceType("instagram"), "instagram_ads");
    assert.equal(metaPlatformToSourceType("fb"), "facebook_ads");
  });
});

describe("website ingest contracts", () => {
  it("preserves website source and does not overwrite UTM with empties", () => {
    assert.equal(mapWebsiteIngestSource("website"), "WEBSITE");
    assert.equal(websiteAttributionSourceType("WEBSITE", { source: "website" }), "website");
    const utm = websiteUtmFromBody({
      utm_source: "google",
      utm_medium: "organic",
      utm_campaign: "burnside",
      utm_content: "",
    });
    assert.equal(utm.utm_source, "google");
    assert.equal(utm.utm_medium, "organic");
    assert.equal(utm.utm_campaign, "burnside");
    assert.equal(utm.utm_content, null);
    const parsed = parseUtm({ utm_source: "  facebook ", utm_campaign: "" });
    assert.equal(parsed.utm_source, "facebook");
    assert.equal(parsed.utm_campaign, null);
  });

  it("maps listing/deal_side helpers without inventing values", () => {
    assert.equal(mapWebsiteIngestDealSide("buy_side"), "buy_side");
    assert.equal(mapWebsiteIngestDealSide("buyer"), "buy_side");
    assert.equal(mapWebsiteIngestDealSide("general"), null);
    assert.equal(websiteExternalLeadId({ external_lead_id: "abc" }), "abc");
    assert.equal(websiteExternalLeadId({}), null);
  });

  it("gates listing-specific behaviour to real_estate and leaves trades generic", () => {
    assert.equal(listingLookupAllowed("real_estate"), true);
    assert.equal(listingLookupAllowed("trades"), false);
    assert.equal(listingLookupAllowed(null), false);
    const ingest = read("app/api/external-leads/submit/route.ts");
    assert.ok(ingest.includes("listingLookupAllowed"));
    assert.ok(ingest.includes("websiteUtmFromBody"));
    assert.ok(ingest.includes("findExistingExternalLead"));
    assert.ok(ingest.includes('provider: "website"'));
    assert.ok(ingest.includes("recordFirstTouchAttribution"));
    assert.ok(ingest.includes("isRealEstate && listingReference"));
    assert.ok(ingest.includes("isRealEstate && agentReference"));
    assert.ok(ingest.includes('.eq("client_id", client.id)'));
    assert.ok(!ingest.includes("business_type !== \"trades\" && !listing"));
  });
});

describe("funnel and conversion", () => {
  it("tracks one acquisition cohort and protects divide-by-zero", () => {
    const funnel = accumulateFunnel([
      { qualified: true, hadViewing: true, hadOffer: true, accepted: true, contacted: true },
      { qualified: true, hadViewing: true, hadOffer: false, accepted: false, contacted: true },
      { qualified: false, hadViewing: false, hadOffer: false, accepted: false, contacted: false },
      { qualified: true, hadViewing: false, hadOffer: false, accepted: false, contacted: true },
    ]);
    assert.equal(funnel.inquiries, 4);
    assert.equal(funnel.qualified, 3);
    assert.equal(funnel.viewings, 2);
    assert.equal(funnel.offers, 1);
    assert.equal(funnel.accepted, 1);
    const rates = funnelRates(funnel);
    assert.equal(rates.inquiryToQualified, 75);
    assert.equal(rates.qualifiedToViewing, 66.7);
    assert.equal(rates.viewingToOffer, 50);
    assert.equal(rates.offerToAccepted, 100);
    assert.equal(rates.inquiryToAccepted, 25);
    assert.equal(conversionPct(1, 0), null);
    assert.equal(costPer(null, 10), null);
    assert.equal(costPer(0, 10), null);
    assert.equal(costPer(220, 0), null);
    assert.equal(costPer(220, 10), 22);
  });

  it("does not mix period activity into the cohort helper", () => {
    const src = read("lib/real-estate/marketing-service.ts");
    assert.ok(src.includes("cohortLabel"));
    assert.ok(src.includes("Inquiries acquired"));
    assert.ok(src.includes("accumulateFunnel(filtered)"));
    assert.ok(src.includes('.gte("created_at", fromIso)'));
  });
});

describe("property performance and first response", () => {
  it("flags high inquiry / low viewing without calling it AI", () => {
    assert.equal(
      propertyInsight({ inquiries: 12, viewings: 1, offers: 0 }),
      "High inquiry volume, low viewing conversion"
    );
    assert.equal(propertyInsight({ inquiries: 3, viewings: 8, offers: 0 }), "8 viewings, no offers");
    const src = read("lib/real-estate/marketing.ts");
    assert.ok(!src.toLowerCase().includes("ai insight"));
  });

  it("counts only human first-response events", () => {
    const at = firstMarketingResponseAt(
      [
        { event_type: "STATUS_CHANGED", created_at: "2026-08-01T10:00:00.000Z" },
        { event_type: "INTAKE_LOGGED", created_at: "2026-08-01T10:05:00.000Z" },
      ],
      [],
      []
    );
    assert.equal(at, "2026-08-01T10:05:00.000Z");
    const call = firstMarketingResponseAt(
      [{ event_type: "CALL_LOGGED", created_at: "2026-08-01T10:02:00.000Z" }],
      ["2026-08-01T10:01:00.000Z"],
      []
    );
    assert.equal(call, "2026-08-01T10:01:00.000Z");
    const src = read("lib/real-estate/marketing-service.ts");
    assert.ok(src.includes('.not("actor_id", "is", null)'));
    assert.ok(src.includes("deriveFirstRespondedAt"));
    assert.ok(src.includes("firstMarketingResponseAt"));
    assert.ok(src.includes("INTAKE_LOGGED"));
  });
});

describe("buyer form mapping", () => {
  it("parses conservative structured values and does not auto-qualify the lead status", () => {
    const mapped = mapFormToBuyerRequirements({
      Budget: "US$150,000+",
      Bedrooms: "4+",
      Area: "Burnside",
      Timeline: "Within 3 months",
    });
    assert.equal(mapped.buyer_budget_min, 150000);
    assert.equal(mapped.buyer_bedrooms_wanted, 4);
    assert.equal(mapped.buyer_area_preference, "Burnside");
    assert.equal(mapped.buyer_timeline, "Within 3 months");
    assert.equal(mapped.formPrequalified, true);
    assert.equal(parseBudgetBand("not a number").min, null);
    assert.equal(parseBedroomsWanted("plenty"), null);
    assert.equal(parseTimeline("soonish"), null);
    const fb = read("app/api/facebook/webhook/route.ts");
    assert.ok(fb.includes("applyMappedBuyerRequirements"));
    assert.ok(fb.includes("formPrequalified"));
    assert.ok(!fb.includes('status: "QUALIFIED"'));
    assert.ok(!fb.includes('source: "QUALIFIED"'));
  });
});

describe("date presets", () => {
  it("resolves practical ranges without hard-coded calendar dates", () => {
    const now = new Date("2026-08-29T12:00:00");
    assert.equal(resolveReMarketingRange("today", null, null, now).label, "Today");
    assert.equal(resolveReMarketingRange("last_7", null, null, now).label, "Last 7 days");
    assert.equal(resolveReMarketingRange("this_month", null, null, now).label, "This month");
    assert.equal(resolveReMarketingRange("last_month", null, null, now).label, "Last month");
    const custom = resolveReMarketingRange("custom", "2026-08-01", "2026-08-31", now);
    assert.equal(custom.label, "Custom range");
  });
});

describe("API key and tenant isolation", () => {
  it("masks keys and never returns the full secret on GET", () => {
    assert.equal(maskWebsiteApiKey("sk_live_abcdefghijklmnop7Yh2"), "sk_live_••••••••7Yh2");
    const route = read("app/api/clients/[clientId]/website-integration/route.ts");
    assert.ok(route.includes("maskWebsiteApiKey"));
    assert.ok(route.includes("website_integration_key_rotated_at"));
    assert.ok(route.includes("revoked"));
    assert.ok(route.includes("Full key is never returned"));
    assert.ok(!route.includes("api_key: session.role"));
  });

  it("scopes campaigns, listings and ingest to client_id", () => {
    const svc = read("lib/real-estate/marketing-service.ts");
    assert.ok(svc.includes('.eq("client_id", opts.clientId)'));
    assert.ok(svc.includes("assertTenantIds"));
    const migration = read("supabase/migrations/20260829160000_real_estate_marketing.sql");
    assert.ok(migration.includes("idx_mkt_attr_external_unique"));
    assert.ok(migration.includes("client_id, provider, external_lead_id"));
    assert.ok(migration.includes("re_marketing_campaigns"));
    assert.ok(migration.includes("reported_spend"));
    assert.ok(migration.includes("Never label as live Meta spend"));
    const campaigns = read("app/api/clients/[clientId]/marketing/acquisition-campaigns/route.ts");
    assert.ok(campaigns.includes("assertRealEstateClient"));
    assert.ok(campaigns.includes("upsertAcquisitionCampaign"));
  });
});

describe("trades isolation and role boundaries", () => {
  it("does not replace WhatsApp marketing hub or trades ingest", () => {
    const marketingPage = read("app/client/marketing/page.tsx");
    assert.ok(marketingPage.includes("MarketingOverview"));
    assert.ok(marketingPage.includes("real_estate"));
    assert.ok(marketingPage.includes("RealEstateMarketingWorkspace"));
    const waCampaigns = read("app/client/marketing/campaigns/page.tsx");
    assert.ok(!waCampaigns.includes("re_marketing_campaigns"));
    const ingest = read("app/api/external-leads/submit/route.ts");
    assert.ok(ingest.includes("createLead"));
  });

  it("does not expose compliance internals on marketing surfaces", () => {
    const dash = read("lib/real-estate/marketing-service.ts");
    assert.ok(!dash.includes("internal_notes"));
    assert.ok(!dash.includes("review_notes"));
    assert.ok(!dash.includes("pep"));
    const workspace = read("components/real-estate/marketing/RealEstateMarketingWorkspace.tsx");
    assert.ok(!workspace.includes("compliance"));
    assert.equal(
      canSeeInternalComplianceNotes(
        { role: "SALESPERSON", userId: "a", userClientId: "c" },
        DEFAULT_COMPLIANCE_SETTINGS
      ),
      false
    );
  });
});

describe("gated marketing pages", () => {
  it("keeps website-leads and sources behind the real-estate guard", () => {
    for (const rel of [
      "app/client/marketing/website-leads/page.tsx",
      "app/client/marketing/sources/page.tsx",
    ]) {
      assert.ok(read(rel).includes("redirectIfNotRealEstate"), `${rel} must call redirectIfNotRealEstate`);
    }
  });
});
