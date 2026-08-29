import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import {
  applyOfferMutation,
  canCreateOfferForAssignment,
  canTransitionOffer,
  canWriteOffer,
  effectiveOfferStatus,
  isOfferEditable,
  isOfferLocked,
  leadOfferStatusSnapshot,
  listingAllowsOffer,
  listingStatusAfterAccept,
  pickLeadOfferSnapshot,
  type OfferSnapshot,
} from "../lib/real-estate/offers";
import { resolveRePipelineStage, primaryActionForStage } from "../lib/real-estate/pipeline";
import { resolveSalesNavItems, SALES_NAVIGATION } from "../lib/sales/navigation/sales-nav-config";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function draft(overrides: Partial<OfferSnapshot> = {}): OfferSnapshot {
  return {
    status: "draft",
    original_offer_amount: 145000,
    current_offer_amount: 145000,
    conditions: "Cash purchase.",
    expiry_date: null,
    internal_notes: null,
    submitted_at: null,
    accepted_at: null,
    rejected_at: null,
    withdrawn_at: null,
    rejected_reason: null,
    withdrawn_reason: null,
    updated_at: "2026-08-29T08:00:00.000Z",
    ...overrides,
  };
}

describe("real-estate offers domain", () => {
  it("creates a draft without submitted behaviour", () => {
    const offer = draft();
    assert.equal(offer.status, "draft");
    assert.equal(offer.submitted_at, null);
    assert.equal(leadOfferStatusSnapshot("draft"), null);
    assert.equal(isOfferEditable("draft"), true);
    assert.equal(listingStatusAfterAccept("available"), "under_offer");
    const listed = listingStatusAfterAccept("available");
    assert.equal(listed, "under_offer");
    // Draft must not imply under_offer
    assert.notEqual(offer.status, "submitted");
  });

  it("submits a draft offer", () => {
    const now = new Date("2026-08-29T09:42:00.000Z");
    const result = applyOfferMutation(draft(), "submit", { now });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.next.status, "submitted");
    assert.equal(result.next.submitted_at, now.toISOString());
    assert.equal(result.next.original_offer_amount, 145000);
    assert.equal(result.event?.event_type, "OFFER_SUBMITTED");
    assert.equal(result.syncLead, true);
    assert.equal(result.listingToUnderOffer, false);
    assert.equal(leadOfferStatusSnapshot("submitted"), "submitted");
  });

  it("does not allow sold listings to receive offers", () => {
    assert.equal(listingAllowsOffer("available"), true);
    assert.equal(listingAllowsOffer("under_offer"), true);
    assert.equal(listingAllowsOffer("reserved"), true);
    assert.equal(listingAllowsOffer("sold"), false);
    assert.equal(listingAllowsOffer("let"), false);
  });

  it("records a seller counter without overwriting the original offer", () => {
    const submitted = applyOfferMutation(draft(), "submit");
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const countered = applyOfferMutation(submitted.next, "counter", {
      amount: 152000,
      note: "Seller will not go below this.",
    });
    assert.equal(countered.ok, true);
    if (!countered.ok) return;
    assert.equal(countered.next.original_offer_amount, 145000);
    assert.equal(countered.next.current_offer_amount, 152000);
    assert.equal(countered.next.status, "countered");
    assert.equal(countered.event?.event_type, "SELLER_COUNTER");
  });

  it("records a buyer revision and preserves original offer", () => {
    const submitted = applyOfferMutation(draft(), "submit");
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const countered = applyOfferMutation(submitted.next, "counter", { amount: 152000 });
    assert.equal(countered.ok, true);
    if (!countered.ok) return;
    const revised = applyOfferMutation(countered.next, "revise", { amount: 149000 });
    assert.equal(revised.ok, true);
    if (!revised.ok) return;
    assert.equal(revised.next.original_offer_amount, 145000);
    assert.equal(revised.next.current_offer_amount, 149000);
    assert.equal(revised.next.status, "negotiating");
    assert.equal(revised.event?.event_type, "BUYER_REVISED");
  });

  it("accepts an offer, stores accepted_at, and flags listing under_offer", () => {
    const now = new Date("2026-09-01T10:12:00.000Z");
    let cursor = draft();
    const submitted = applyOfferMutation(cursor, "submit");
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const countered = applyOfferMutation(submitted.next, "counter", { amount: 152000 });
    assert.equal(countered.ok, true);
    if (!countered.ok) return;
    const revised = applyOfferMutation(countered.next, "revise", { amount: 149000 });
    assert.equal(revised.ok, true);
    if (!revised.ok) return;
    const accepted = applyOfferMutation(revised.next, "accept", { amount: 149000, now });
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.next.status, "accepted");
    assert.equal(accepted.next.accepted_at, now.toISOString());
    assert.equal(accepted.next.current_offer_amount, 149000);
    assert.equal(accepted.next.original_offer_amount, 145000);
    assert.equal(accepted.listingToUnderOffer, true);
    assert.equal(listingStatusAfterAccept("available"), "under_offer");
    assert.equal(listingStatusAfterAccept("sold"), null);
    assert.equal(leadOfferStatusSnapshot("accepted"), "accepted");
  });

  it("rejects and withdraws without deleting history fields", () => {
    const submitted = applyOfferMutation(draft(), "submit");
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const rejected = applyOfferMutation(submitted.next, "reject", { reason: "Offer too low" });
    assert.equal(rejected.ok, true);
    if (!rejected.ok) return;
    assert.equal(rejected.next.status, "rejected");
    assert.ok(rejected.next.rejected_at);
    assert.equal(rejected.next.original_offer_amount, 145000);
    assert.equal(isOfferLocked("rejected"), true);

    const withdrawnStart = applyOfferMutation(draft(), "submit");
    assert.equal(withdrawnStart.ok, true);
    if (!withdrawnStart.ok) return;
    const withdrawn = applyOfferMutation(withdrawnStart.next, "withdraw", { note: "Buyer changed mind" });
    assert.equal(withdrawn.ok, true);
    if (!withdrawn.ok) return;
    assert.equal(withdrawn.next.status, "withdrawn");
    assert.ok(withdrawn.next.withdrawn_at);
    assert.equal(isOfferLocked("withdrawn"), true);
  });

  it("blocks direct amount edits after submit", () => {
    const submitted = applyOfferMutation(draft(), "submit");
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    const edited = applyOfferMutation(submitted.next, "edit_draft", { amount: 200000 });
    assert.equal(edited.ok, false);
    assert.equal(isOfferEditable("submitted"), false);
    assert.equal(isOfferEditable("accepted"), false);
    const acceptedEdit = applyOfferMutation(
      { ...submitted.next, status: "accepted", accepted_at: "2026-09-01T10:12:00.000Z" },
      "edit_draft",
      { amount: 1 }
    );
    assert.equal(acceptedEdit.ok, false);
    assert.equal(canTransitionOffer("accepted", "submitted"), false);
  });

  it("supports multiple offers per listing and per buyer in the lead snapshot picker", () => {
    const pick = pickLeadOfferSnapshot([
      {
        status: "submitted",
        current_offer_amount: 140000,
        listing_id: "listing-a",
        updated_at: "2026-08-29T08:00:00.000Z",
      },
      {
        status: "accepted",
        current_offer_amount: 149000,
        listing_id: "listing-b",
        updated_at: "2026-09-01T10:12:00.000Z",
      },
      {
        status: "rejected",
        current_offer_amount: 130000,
        listing_id: "listing-a",
        updated_at: "2026-08-30T08:00:00.000Z",
      },
    ]);
    assert.ok(pick);
    assert.equal(pick?.offer_status, "accepted");
    assert.equal(pick?.offer_amount, 149000);
    assert.equal(pick?.listing_id, "listing-b");
  });

  it("computes expiry without a cron", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");
    assert.equal(effectiveOfferStatus("submitted", "2026-09-01", now), "expired");
    assert.equal(effectiveOfferStatus("submitted", "2026-09-03", now), "submitted");
    assert.equal(effectiveOfferStatus("draft", "2026-09-01", now), "draft");
    assert.equal(effectiveOfferStatus("accepted", "2026-09-01", now), "accepted");
  });

  it("scopes agent writes to assigned offers and managers to the company", () => {
    assert.equal(
      canWriteOffer({
        role: "SALESPERSON",
        userId: "agent-1",
        userClientId: "client-a",
        offerClientId: "client-a",
        buyerAgentId: "agent-1",
      }),
      true
    );
    assert.equal(
      canWriteOffer({
        role: "SALESPERSON",
        userId: "agent-1",
        userClientId: "client-a",
        offerClientId: "client-a",
        buyerAgentId: "agent-2",
      }),
      false
    );
    assert.equal(
      canWriteOffer({
        role: "SALESPERSON",
        userId: "agent-1",
        userClientId: "client-a",
        offerClientId: "client-b",
        buyerAgentId: "agent-1",
      }),
      false
    );
    assert.equal(
      canWriteOffer({
        role: "CLIENT_MANAGER",
        userId: "mgr",
        userClientId: "client-a",
        offerClientId: "client-a",
        buyerAgentId: "agent-2",
      }),
      true
    );
    assert.equal(
      canCreateOfferForAssignment({
        role: "SALESPERSON",
        userId: "agent-1",
        userClientId: "client-a",
        clientId: "client-a",
        assignedToId: "agent-2",
      }),
      false
    );
  });

  it("maps accepted/submitted offers onto the existing pipeline without new trades stages", () => {
    assert.equal(
      resolveRePipelineStage({ leadStatus: "QUALIFIED", offerStatus: "submitted" }),
      "offer_submitted"
    );
    assert.equal(
      resolveRePipelineStage({ leadStatus: "QUALIFIED", offerStatus: "countered" }),
      "negotiating"
    );
    assert.equal(
      resolveRePipelineStage({ leadStatus: "QUALIFIED", offerStatus: "accepted" }),
      "offer_accepted"
    );
    assert.equal(primaryActionForStage("interested").label, "Create offer");
    assert.equal(primaryActionForStage("offer_accepted").id, "offer");
  });
});

describe("real-estate offers architecture — source contracts", () => {
  it("uses dedicated tables, not a second lead-level amount field", () => {
    const migration = read("supabase/migrations/20260829120000_real_estate_offers.sql");
    assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS real_estate_offers"));
    assert.ok(migration.includes("real_estate_offer_events"));
    assert.ok(migration.includes("ENABLE ROW LEVEL SECURITY"));
    assert.ok(!migration.toLowerCase().includes("drop column"));
    assert.ok(migration.includes("leads.offer_amount"));
  });

  it("validates listing and contact against the current client", () => {
    const src = read("lib/real-estate/offer-service.ts");
    assert.ok(src.includes('.eq("client_id", opts.clientId)'));
    assert.ok(src.includes("Listing not found"));
    assert.ok(src.includes("Contact not found"));
    assert.ok(src.includes("applyOfferMutation"));
    assert.equal(src.includes("notifyOfferUpdate"), false);
  });

  it("does not auto-reject sibling offers on accept", () => {
    const src = read("lib/real-estate/offer-service.ts");
    assert.ok(src.includes("siblingActiveCount"));
    assert.ok(!src.includes('update({ status: "rejected" })'));
    assert.ok(!src.includes("auto-reject"));
  });

  it("keeps WhatsApp notify off the mutation path so send failure cannot corrupt state", () => {
    const patch = read("app/api/clients/[clientId]/offers/[offerId]/route.ts");
    const notify = read("app/api/clients/[clientId]/offers/[offerId]/notify/route.ts");
    assert.equal(patch.includes("notifyOfferUpdate"), false);
    assert.ok(notify.includes("notifyOfferUpdate"));
    assert.ok(notify.includes("soft") || notify.includes("sent: false"));
  });

  it("does not touch trades quotation routes", () => {
    const quotes = read("app/api/clients/[clientId]/offers/route.ts");
    assert.ok(quotes.includes("createRealEstateOffer"));
    assert.ok(quotes.includes("assertRealEstateClient"));
    const navTrades = resolveSalesNavItems(false, "trades");
    assert.ok(navTrades.some((i) => i.id === "quotes"));
    assert.equal(navTrades.some((i) => i.id === "offers"), false);
    const navRe = resolveSalesNavItems(false, "real_estate");
    assert.ok(navRe.some((i) => i.id === "offers"));
    assert.equal(navRe.some((i) => i.id === "quotes"), false);
    assert.deepEqual(
      resolveSalesNavItems(false, "trades").map((i) => i.id),
      SALES_NAVIGATION.map((i) => i.id)
    );
  });
});
