import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  agencyAttention,
  allocateCommission,
  canApproveCommission,
  canVerifyCommissionReceipt,
  capabilitiesForRole,
  commissionAfterTransactionFailure,
  documentReviewAfterUpload,
  grossCommissionCents,
  nextCommissionStatus,
  percentOfCents,
  planHandover,
  payoutProgress,
  reportSaleOnce,
  visibleDealSlice,
} from "../lib/real-estate/agency-operations";
import { canParticipateInDeal } from "../lib/real-estate/deal-access";
import { getCompanyNavigation, companyNavBySection } from "../lib/sales/navigation/company-nav-config";
import { resolveSalesNavItems, salesMobilePrimaryItems, SALES_NAVIGATION } from "../lib/sales/navigation/sales-nav-config";

describe("commission ledger", () => {
  it("calculates 3 percent of 18000000 cents as 540000 cents", () => {
    assert.equal(percentOfCents(18_000_000, 300), 540_000);
    assert.equal(grossCommissionCents({ basisCents: 18_000_000, mode: "percent", basisPoints: 300 }), 540_000);
  });

  it("rounds half a cent away from zero", () => {
    assert.equal(percentOfCents(50, 100), 1);
  });

  it("splits a commission and refuses an allocation above the distributable amount", () => {
    const ok = allocateCommission({
      distributableCents: 540_000,
      lines: [
        { id: "listing", beneficiaryId: "tendai", role: "listing_agent", mode: "percent", basisPoints: 5000 },
        { id: "buyer", beneficiaryId: "farai", role: "buyer_agent", mode: "percent", basisPoints: 5000, absorbsRemainder: true },
      ],
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.lines.reduce((sum, line) => sum + line.cents, 0), 540_000);
      assert.equal(ok.remainderCents, 0);
    }
    const over = allocateCommission({
      distributableCents: 1000,
      lines: [
        { id: "a", beneficiaryId: "a", role: "listing_agent", mode: "fixed", fixedCents: 600 },
        { id: "b", beneficiaryId: "b", role: "buyer_agent", mode: "fixed", fixedCents: 600 },
      ],
    });
    assert.equal(over.ok, false);
  });

  it("does not let an agent approve their own allocation or treat a report as verified", () => {
    assert.equal(canApproveCommission({ actorId: "farai", beneficiaryId: "farai", role: "CLIENT_MANAGER", capabilities: [] }), false);
    assert.equal(canApproveCommission({ actorId: "manager", beneficiaryId: "farai", role: "CLIENT_MANAGER", capabilities: [] }), true);
    assert.equal(canVerifyCommissionReceipt({ role: "SALESPERSON", capabilities: [] }), false);
    assert.equal(nextCommissionStatus({ current: "projected", action: "report_receipt" }), "reported_received");
    assert.equal(nextCommissionStatus({ current: "reported_received", action: "verify_receipt" }), "verified_received");
    assert.equal(documentReviewAfterUpload(), "awaiting_review");
  });

  it("cancels unverified commission when a transaction falls through and tracks partial payout", () => {
    const failed = commissionAfterTransactionFailure();
    assert.equal(failed.verifiedReceived, false);
    assert.equal(failed.status, "cancelled");
    assert.equal(payoutProgress({ approvedCents: 1000, paidCents: 400 }), "partially_paid");
    assert.equal(payoutProgress({ approvedCents: 1000, paidCents: 1000 }), "paid");
  });
});

describe("collaboration, handover and reporting", () => {
  it("shows a buyer agent the buyer, not the owner, and never shares WhatsApp", () => {
    const slice = visibleDealSlice({ roles: ["buyer_agent"], isManager: false, capabilities: [] });
    assert.equal(slice.buyerContact, true);
    assert.equal(slice.ownerContact, false);
    assert.equal(slice.whatsapp, false);
    assert.equal(slice.commission, false);
  });

  it("lets an explicit participant see the deal and blocks another company", () => {
    assert.equal(canParticipateInDeal({
      role: "SALESPERSON",
      userId: "coordinator",
      userClientId: "org-a",
      resourceClientId: "org-a",
      participantIds: ["coordinator"],
    }), true);
    assert.equal(canParticipateInDeal({
      role: "SALESPERSON",
      userId: "stranger",
      userClientId: "org-b",
      resourceClientId: "org-a",
      participantIds: ["stranger"],
    }), false);
  });

  it("moves current work and keeps the original contributor id", () => {
    const plan = planHandover({
      fromUserId: "tendai",
      defaultReplacementId: "farai",
      replacementByType: {},
      assignments: [
        { recordType: "listing", recordId: "l1", currentAssigneeId: "tendai", originalContributorId: "tendai" },
        { recordType: "buyer_search", recordId: "s1", currentAssigneeId: "other", originalContributorId: "other" },
      ],
    });
    assert.equal(plan.ok, true);
    if (plan.ok) {
      assert.equal(plan.changes.length, 1);
      assert.equal(plan.changes[0]?.nextAssigneeId, "farai");
      assert.deepEqual(plan.preservedContributorIds, ["tendai"]);
    }
  });

  it("names the reason for each attention item and counts one sale once", () => {
    const items = agencyAttention({
      mandatesPending: [],
      listingsPending: [{ id: "l1", label: "Greendale house" }],
      mandatesExpiring: [],
      offersWaiting: [],
      documentsOverdue: [],
      paymentsUnverified: [{ id: "c1", label: "Commission receipt" }],
      commissionsPending: [],
      handoversOpen: [],
      stalledTransactions: [],
    });
    assert.equal(items.length, 2);
    assert.match(items[1]?.reason ?? "", /not verified/);
    const report = reportSaleOnce([
      { transactionId: "t1", agreedCents: 18_000_000 },
      { transactionId: "t1", agreedCents: 18_000_000 },
    ]);
    assert.equal(report.transactions, 1);
    assert.equal(report.volumeCents, 18_000_000);
    assert.equal(report.duplicatesIgnored, 1);
  });

  it("gives managers financial capabilities and leaves a negotiator without them", () => {
    assert.ok(capabilitiesForRole("CLIENT_MANAGER").includes("approve_commission"));
    assert.deepEqual(capabilitiesForRole("SALESPERSON"), []);
  });
});

describe("final real estate navigation", () => {
  it("groups manager destinations and leaves trades navigation unchanged", () => {
    const trades = resolveSalesNavItems(false, "trades");
    assert.deepEqual(
      trades.map((item) => item.id),
      SALES_NAVIGATION.map((item) => item.id).filter((id) => id !== "projects" && id !== "myWork")
    );
    const manager = getCompanyNavigation("real_estate");
    const main = companyNavBySection(manager, "main").map((item) => item.id);
    assert.deepEqual(main, ["overview", "whatsapp", "calendar"]);
    const agency = companyNavBySection(manager, "agency").map((item) => item.id);
    for (const id of ["listings", "transactions", "agents", "commissions", "reports"]) {
      assert.equal(agency.includes(id), true);
    }
    assert.equal(companyNavBySection(manager, "more_tools").some((item) => item.id === "developments"), true);
    assert.equal(getCompanyNavigation("trades").some((item) => item.id === "commissions"), false);
    const agent = resolveSalesNavItems(false, "real_estate");
    assert.equal(agent.some((item) => item.href === "/sales/commissions"), true);
    assert.deepEqual(
      salesMobilePrimaryItems(agent, "real_estate").map((item) => item.id),
      ["dashboard", "whatsapp", "listings", "tasks"]
    );
    assert.deepEqual(
      salesMobilePrimaryItems(trades).map((item) => item.id),
      ["dashboard", "pipeline", "whatsapp", "tasks"]
    );
  });

  it("does not send WhatsApp from commission failure handling", () => {
    const source = readFileSync("lib/real-estate/agency-service.ts", "utf8");
    assert.equal(source.includes("notifyPropertyMatch"), false);
    assert.match(source, /\.eq\("client_id", input\.clientId\)|\.eq\("client_id", clientId\)/);
    assert.match(readFileSync("supabase/migrations/20261016180000_real_estate_phase4_agency_operations.sql", "utf8"), /REVOKE ALL/);
  });
});
