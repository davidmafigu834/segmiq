import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptsNewEnquiry,
  absoluteListingUrl,
  ATTRIBUTION_WINDOW_DAYS_DEFAULT,
  buildPublicSlug,
  canGenerateOwnShare,
  canReadShareAnalytics,
  canRevokeShare,
  canonicalListingPath,
  classifyUserAgent,
  enquiryAssigneeOverride,
  isOpaqueShareToken,
  listingMarketingGate,
  listingPagePath,
  mediaPathIsDurableMarketingAsset,
  newShareToken,
  normaliseCampaignLabel,
  projectPublicProperty,
  publicMediaPath,
  rangeForPreset,
  RESTRICTED_PUBLIC_KEYS,
  safeAgencyHttpUrl,
  shareAcceptsAttribution,
  submissionReplay,
  viewingInstant,
  ATTRIBUTION_PRECEDENCE,
  whatsAppLink,
  whatsAppPrefill,
} from "../lib/real-estate/agent-listing-pages/policy";
import { dealOutcomeNote, factualInsights, totalsFromCounts, visitSeries } from "../lib/real-estate/agent-listing-pages/analytics";

const org = "org-a";
const approved = {
  organisationId: org,
  listingOrganisationId: org,
  approvalStatus: "approved",
  status: "available",
  featureEnabled: true,
  organisationActive: true,
};

test("eligible approved listings can be marketed and drafts cannot", () => {
  assert.equal(listingMarketingGate(approved).ok, true);
  assert.equal(acceptsNewEnquiry(listingMarketingGate(approved)), true);
  for (const approvalStatus of ["draft", "pending_approval", "rejected"]) {
    const gate = listingMarketingGate({ ...approved, approvalStatus });
    assert.equal(gate.ok, false);
  }
  assert.equal(listingMarketingGate({ ...approved, listingOrganisationId: "org-b" }).ok, false);
  assert.equal(listingMarketingGate({ ...approved, featureEnabled: false }).ok, false);
  assert.equal(listingMarketingGate({ ...approved, organisationActive: false }).ok, false);
});

test("sold and withdrawn-like statuses are not advertised as available", () => {
  const sold = listingMarketingGate({ ...approved, status: "sold" });
  assert.equal(sold.ok, true);
  if (sold.ok) assert.equal(sold.advertiseAsAvailable, false);
  assert.equal(acceptsNewEnquiry(sold), false);
  assert.equal(listingMarketingGate({ ...approved, status: "archived" }).ok, false);
});

test("the same agent reuses a default label and campaign labels stay distinct", () => {
  assert.equal(normaliseCampaignLabel("  WhatsApp Status  "), "WhatsApp Status");
  assert.equal(normaliseCampaignLabel("WhatsApp Status"), normaliseCampaignLabel("WhatsApp Status"));
  assert.notEqual(normaliseCampaignLabel(null), normaliseCampaignLabel("Facebook"));
  assert.equal(normaliseCampaignLabel("x".repeat(41)), null);
});

test("tokens are opaque and do not encode internal ids", () => {
  const token = newShareToken();
  assert.equal(isOpaqueShareToken(token), true);
  assert.equal(token.includes(org), false);
  assert.equal(isOpaqueShareToken("11111111-1111-1111-1111-111111111111"), false);
  assert.equal(canonicalListingPath("borrowdale-family-home").includes("ref="), false);
  assert.equal(listingPagePath("borrowdale-family-home", token).includes(token), true);
  assert.equal(absoluteListingUrl("https://www.segmiq.com/", "borrowdale-family-home").endsWith("/property/borrowdale-family-home"), true);
});

test("different agents are different shares by token, not by listing slug", () => {
  const slug = buildPublicSlug("Borrowdale", "ab12cd34");
  const a = listingPagePath(slug, newShareToken());
  const b = listingPagePath(slug, newShareToken());
  assert.equal(canonicalListingPath(slug), canonicalListingPath(slug));
  assert.notEqual(a, b);
  assert.equal(a.split("?")[0], b.split("?")[0]);
});

test("revoked, suspended, and removed agents cannot accept new attribution", () => {
  const agent = { clientId: org, role: "SALESPERSON", active: true, archived: false, alsoSells: false };
  assert.equal(shareAcceptsAttribution({ shareStatus: "active", listingOrganisationId: org, agent }), true);
  assert.equal(shareAcceptsAttribution({ shareStatus: "revoked", listingOrganisationId: org, agent }), false);
  assert.equal(shareAcceptsAttribution({ shareStatus: "active", listingOrganisationId: org, agent: { ...agent, active: false } }), false);
  assert.equal(shareAcceptsAttribution({ shareStatus: "active", listingOrganisationId: org, agent: { ...agent, clientId: "org-b" } }), false);
});

test("agents cannot read another agent's analytics and managers stay in tenant", () => {
  const agent = { userId: "agent-a", role: "SALESPERSON", clientId: org };
  assert.equal(canReadShareAnalytics(agent, { clientId: org, agentId: "agent-b" }), false);
  assert.equal(canRevokeShare(agent, { clientId: org, agentId: "agent-a" }), true);
  assert.equal(canRevokeShare({ userId: "mgr", role: "CLIENT_MANAGER", clientId: org }, { clientId: org, agentId: "agent-a" }), true);
  assert.equal(canRevokeShare({ userId: "mgr", role: "CLIENT_MANAGER", clientId: "org-b" }, { clientId: org, agentId: "agent-a" }), false);
  assert.equal(canGenerateOwnShare(agent, true), true);
  assert.equal(canGenerateOwnShare({ userId: "mgr", role: "CLIENT_MANAGER", clientId: org, alsoSells: false }, true), false);
});

test("public projection omits restricted fields and does not invent currency or amenities", () => {
  const projected = projectPublicProperty({
    address: "12 Stonechat Lane",
    suburb: "Borrowdale",
    price: 250000,
    currency: null,
    currencyConfigured: false,
    transactionType: "sale",
    propertyCategory: "house",
    bedrooms: 4,
    bathrooms: 3,
    sizeSqm: 320,
    description: "Family house",
    status: "available",
    photoCount: 2,
  });
  const serialised = JSON.stringify(projected);
  for (const key of RESTRICTED_PUBLIC_KEYS) assert.equal(serialised.includes(`"${key}"`), false);
  assert.equal(projected.currency, null);
  assert.equal(projected.currencyContext, "unconfigured");
  assert.equal(projected.priceLabel, null);
  assert.equal(projected.priceOnRequest, true);
  assert.equal(projected.heading, "12 Stonechat Lane");
  assert.equal("amenities" in projected, false);
  const withCurrency = projectPublicProperty({ ...{
    address: null, suburb: "Avondale", price: 900, currency: "USD", currencyConfigured: true,
    transactionType: "rental", propertyCategory: null, bedrooms: null, bathrooms: null, sizeSqm: null,
    description: null, status: "available", photoCount: 0,
  } });
  assert.equal(withCurrency.priceLabel, "USD 900");
  assert.equal(withCurrency.currencyContext, "quotation_currency");
});

test("catalogue links stay on the verified website host", () => {
  assert.equal(safeAgencyHttpUrl("https://haven.example", "https://haven.example/listings"), "https://haven.example/listings");
  assert.equal(safeAgencyHttpUrl("https://haven.example", "https://other.example/listings"), null);
  assert.equal(safeAgencyHttpUrl("https://haven.example", "http://haven.example/listings"), null);
  assert.equal(safeAgencyHttpUrl("https://haven.example", "javascript:alert(1)"), null);
  assert.equal(safeAgencyHttpUrl(null, "https://haven.example/listings"), null);
});

test("enquiry assignment preserves an existing owner", () => {
  const kept = enquiryAssigneeOverride({
    routing: "assign_marketing_agent",
    openLeadOwnerId: "agent-b",
    marketingAgentEligible: true,
    marketingAgentId: "agent-a",
  });
  assert.equal(kept.overrideAssigneeId, undefined);
  assert.equal(kept.preservedOwnerId, "agent-b");
  const fresh = enquiryAssigneeOverride({
    routing: "assign_marketing_agent",
    openLeadOwnerId: null,
    marketingAgentEligible: true,
    marketingAgentId: "agent-a",
  });
  assert.equal(fresh.overrideAssigneeId, "agent-a");
  const agency = enquiryAssigneeOverride({
    routing: "agency_assignment",
    openLeadOwnerId: null,
    marketingAgentEligible: true,
    marketingAgentId: "agent-a",
  });
  assert.equal(agency.overrideAssigneeId, undefined);
});

test("duplicate submissions replay and concurrent pending submissions retry", () => {
  assert.equal(submissionReplay({ leadId: "lead-1", status: "accepted", ageMs: 10 }), "replay");
  assert.equal(submissionReplay({ leadId: null, status: "pending", ageMs: 1000 }), "retry");
  assert.equal(submissionReplay({ leadId: null, status: "failed", ageMs: 120_000 }), "takeover");
});

test("viewing times require a timezone and are not confirmed bookings", () => {
  assert.equal(viewingInstant("2026-12-01T10:00:00").ok, false);
  const future = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const parsed = viewingInstant(future);
  assert.equal(parsed.ok, true);
});

test("preview fetches are not human visits and WhatsApp clicks are not leads", () => {
  assert.equal(classifyUserAgent("WhatsApp/2.1"), "preview");
  assert.equal(classifyUserAgent("facebookexternalhit/1.1"), "preview");
  assert.equal(classifyUserAgent("curl/8.0"), "automation");
  assert.equal(classifyUserAgent("Mozilla/5.0"), "human");
  const totals = totalsFromCounts([
    { eventType: "page_view", botClass: "preview", count: 40 },
    { eventType: "page_view", botClass: "human", count: 4 },
    { eventType: "whatsapp_click", botClass: "human", count: 2 },
    { eventType: "enquiry_submit", botClass: "human", count: 1 },
    { eventType: "whatsapp_conversation_confirmed", botClass: "human", count: 0 },
  ], 3);
  assert.equal(totals.visits, 4);
  assert.equal(totals.previewFetches, 40);
  assert.equal(totals.whatsappClicks, 2);
  assert.equal(totals.confirmedWhatsappLeads, 0);
  assert.equal(totals.enquiries, 1);
  assert.deepEqual(visitSeries([{ day: "2026-11-02", eventType: "page_view", botClass: "preview", count: 9 }]), []);
});

test("insights are omitted when there is no supporting count", () => {
  assert.deepEqual(factualInsights(totalsFromCounts([], 0), {}), []);
  const lines = factualInsights(totalsFromCounts([{ eventType: "page_view", botClass: "human", count: 24 }], 10), { whatsapp: 20, direct: 4 });
  assert.equal(lines.some((line) => line.includes("24")), true);
  assert.equal(lines.some((line) => line.includes("WhatsApp")), true);
});

test("deal notes do not claim a sale the link did not own", () => {
  assert.equal(dealOutcomeNote({ leadWon: false, transactionLinked: false, marketingAgentId: "a", operationalOwnerId: "b" }), null);
  assert.match(dealOutcomeNote({ leadWon: true, transactionLinked: true, marketingAgentId: "a", operationalOwnerId: "b" }) ?? "", /differ/);
});

test("public media paths are same-origin and not expiring storage URLs", () => {
  const path = publicMediaPath("borrowdale-ab12", 0, "token");
  assert.equal(mediaPathIsDurableMarketingAsset(path), true);
  assert.equal(path.includes("X-Amz-Signature"), false);
});

test("Harare days start two hours before UTC midnight", () => {
  const range = rangeForPreset("custom", new Date("2026-11-02T12:00:00Z"), "Africa/Harare", "2026-11-02", "2026-11-02");
  assert.equal(range?.from.toISOString(), "2026-11-01T22:00:00.000Z");
  assert.equal(range?.to.toISOString(), "2026-11-02T22:00:00.000Z");
  assert.equal(rangeForPreset("7d", new Date(), "Not/AZone"), null);
});

test("WhatsApp prefill uses the public slug rather than an internal id", () => {
  const text = whatsAppPrefill("Borrowdale", "borrowdale-ab12");
  assert.match(text, /Borrowdale/);
  assert.equal(text.includes(org), false);
  assert.equal(whatsAppLink("263771234567", text)?.startsWith("https://wa.me/263771234567?text="), true);
  assert.equal(whatsAppLink("077", text), null);
});

test("attribution keeps marketing separate from operational ownership", () => {
  assert.equal(ATTRIBUTION_WINDOW_DAYS_DEFAULT, 30);
  assert.equal(ATTRIBUTION_PRECEDENCE[0], "existing_operational_owner");
  assert.notEqual(ATTRIBUTION_PRECEDENCE.indexOf("whatsapp_click"), ATTRIBUTION_PRECEDENCE.indexOf("confirmed_inbound_whatsapp"));
});
