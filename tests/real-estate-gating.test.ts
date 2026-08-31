import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { shouldRedirectFromRealEstateRoute } from "../lib/real-estate/gating";
import {
  viewingCompanyKpis,
  viewingCompanyTabCounts,
  viewingIsOverdue,
  viewingIsToday,
  viewingMatchesCompanyTab,
  viewingMatchesTab,
  viewingsFetchPlan,
} from "../lib/real-estate/viewings";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("real-estate route guard", () => {
  it("blocks trades and unknown companies from real-estate-only routes", () => {
    assert.equal(shouldRedirectFromRealEstateRoute("trades"), true);
    assert.equal(shouldRedirectFromRealEstateRoute(null), true);
    assert.equal(shouldRedirectFromRealEstateRoute(undefined), true);
    assert.equal(shouldRedirectFromRealEstateRoute("other"), true);
    assert.equal(shouldRedirectFromRealEstateRoute("real_estate"), false);
  });

  it("keeps listings, developments and viewings pages behind the same guard", () => {
    const gatedPages = [
      "app/client/listings/page.tsx",
      "app/client/listings/[listingId]/page.tsx",
      "app/client/developments/page.tsx",
      "app/client/viewings/page.tsx",
      "app/client/offers/page.tsx",
      "app/client/compliance/page.tsx",
      "app/client/marketing/sources/page.tsx",
      "app/client/marketing/website-leads/page.tsx",
      "app/client/feedback/page.tsx",
      "app/client/agents/performance/page.tsx",
    ];
    for (const rel of gatedPages) {
      const src = read(rel);
      assert.ok(
        src.includes("redirectIfNotRealEstate"),
        `${rel} must call redirectIfNotRealEstate`
      );
    }
    const salesOffers = read("app/sales/offers/page.tsx");
    assert.ok(salesOffers.includes("shouldRedirectFromRealEstateRoute"));
  });

  it("does not remove existing listing and development API business_type checks", () => {
    const listingsPost = read("app/api/clients/[clientId]/listings/route.ts");
    const developmentsPost = read("app/api/clients/[clientId]/developments/route.ts");
    assert.ok(listingsPost.includes('client.business_type !== "real_estate"'));
    assert.ok(developmentsPost.includes('client.business_type !== "real_estate"'));
  });
});

describe("viewings company scoping", () => {
  it("does not query viewings when the client has no listings", () => {
    assert.deepEqual(viewingsFetchPlan([]), { kind: "empty", listingIds: [] });
    assert.deepEqual(viewingsFetchPlan([null, undefined, ""]), {
      kind: "empty",
      listingIds: [],
    });
  });

  it("scopes viewings to unique listing ids that belong to the client", () => {
    assert.deepEqual(viewingsFetchPlan(["listing-a", "listing-a", "listing-b"]), {
      kind: "scoped",
      listingIds: ["listing-a", "listing-b"],
    });
  });

  it("maps viewing statuses onto workspace tabs without dropping no_show", () => {
    assert.equal(viewingMatchesTab("scheduled", "upcoming"), true);
    assert.equal(viewingMatchesTab("completed", "completed"), true);
    assert.equal(viewingMatchesTab("cancelled", "cancelled"), true);
    assert.equal(viewingMatchesTab("no_show", "cancelled"), true);
    assert.equal(viewingMatchesTab("no_show", "upcoming"), false);
    assert.equal(viewingMatchesTab("scheduled", "all"), true);
  });

  it("splits upcoming, today, and overdue for the company workspace", () => {
    const now = Date.parse("2026-08-31T12:00:00.000Z");
    const upcoming = { status: "scheduled", scheduled_at: "2026-08-31T18:00:00.000Z" };
    const overdue = { status: "scheduled", scheduled_at: "2026-08-31T09:00:00.000Z" };
    const done = { status: "completed", scheduled_at: "2026-08-30T09:00:00.000Z" };
    assert.equal(viewingMatchesCompanyTab(upcoming, "upcoming", now), true);
    assert.equal(viewingMatchesCompanyTab(overdue, "upcoming", now), false);
    assert.equal(viewingMatchesCompanyTab(overdue, "overdue", now), true);
    assert.equal(viewingMatchesCompanyTab(done, "overdue", now), false);
    assert.equal(viewingIsOverdue("scheduled", overdue.scheduled_at, now), true);
    const localNow = new Date(now);
    const todayLocal = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate(), 8, 0, 0);
    const yesterdayLocal = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate() - 1, 8, 0, 0);
    assert.equal(viewingIsToday(todayLocal.toISOString(), localNow), true);
    assert.equal(viewingIsToday(yesterdayLocal.toISOString(), localNow), false);
    const kpis = viewingCompanyKpis(
      [
        { ...upcoming, feedback_text: null },
        { ...overdue, feedback_text: null },
        { ...done, feedback_text: null },
      ],
      now
    );
    assert.equal(kpis.length, 5);
    assert.equal(kpis[0]?.value, "1");
    assert.equal(kpis[2]?.value, "1");
    assert.equal(viewingCompanyTabCounts([upcoming, overdue, done], now).all, 3);
  });

  it("loads viewings only after listing ids for the current client", () => {
    const src = read("app/client/viewings/page.tsx");
    assert.ok(src.includes("viewingsFetchPlan"));
    assert.ok(src.includes('.eq("client_id", session.clientId)'));
    assert.ok(src.includes('.in("listing_id", listingIds)'));
    assert.ok(src.includes('.eq("client_id", session.clientId).in("id", contactIds)'));
    assert.ok(src.includes('.eq("client_id", session.clientId).in("id", agentIds)'));
  });
});
