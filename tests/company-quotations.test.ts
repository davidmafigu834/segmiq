import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COMPANY_QUOTATION_FILTERS,
  buildCompanyQuotationsCsv,
  companyQuotationAttention,
  companyQuotationEmptyKind,
  companyQuotationEngagement,
  companyQuotationMatchesFilters,
  companyQuotationMatchesSearch,
  companyQuotationMatchesTab,
  companyQuotationMoreFiltersActive,
  companyQuotationNeedsAttention,
  companyQuotationNextAction,
  companyQuotationPageItems,
  companyQuotationSendLabel,
  sortCompanyQuotations,
} from "../lib/sales/company-quotations";
import type { CompanyQuotationRow } from "../components/dashboard/company/quotations/types";

function quote(partial: Partial<CompanyQuotationRow> = {}): CompanyQuotationRow {
  return {
    id: "quote-1",
    clientId: "client-1",
    leadId: "lead-1",
    contactId: "contact-1",
    dealId: "deal-1",
    quoteNumber: "SQ-2032",
    revisionNumber: 1,
    title: "Solar Installation System",
    customerName: "Shield Roofing",
    customerPhone: "+263 77 123 4567",
    customerEmail: "hello@shield.example",
    dealName: "Solar Installation",
    dealStage: "NEGOTIATING",
    dealValue: 12000,
    amount: 12000,
    currency: "USD",
    status: "sent",
    effectiveStatus: "sent",
    owner: { id: "owner-1", name: "Tendai Moyo", avatarUrl: null },
    preparedByName: "Tendai Moyo",
    quoteDate: "2026-05-23T08:24:00.000Z",
    validUntil: "2026-06-22",
    sentAt: "2026-05-23T08:24:00.000Z",
    viewedAt: null,
    lastViewedAt: null,
    viewCount: 0,
    createdAt: "2026-05-23T08:20:00.000Z",
    updatedAt: "2026-05-23T08:24:00.000Z",
    publicToken: "public-token",
    approvalStatus: "not_required",
    approvalNote: null,
    approvalReasons: [],
    approvalRequestedAt: null,
    approvedAt: null,
    approvedByName: null,
    discountPercent: 3,
    discountExceedsAuthority: false,
    maxDiscountPercent: 5,
    minMarginPercent: 25,
    marginPercent: 31,
    marginHealth: "healthy",
    costTotal: 8280,
    standardValue: 12400,
    subtotal: 12000,
    taxAmount: 0,
    otherAmount: 0,
    customerResponseType: null,
    customerResponseCategory: null,
    customerResponseMessage: null,
    acceptedTotal: null,
    declinedReason: null,
    parentQuotationId: null,
    previousVersion: null,
    selectedOptionLabel: null,
    ...partial,
  };
}

describe("Company Quotations table behavior", () => {
  it("keeps declined quotation status separate from Deal outcome", () => {
    const declined = quote({ status: "rejected", effectiveStatus: "rejected" });
    assert.equal(companyQuotationMatchesTab(declined, "declined"), true);
    assert.equal(declined.dealId, "deal-1");
  });

  it("finds quotation number, Customer, Deal, and owner", () => {
    const row = quote();
    assert.equal(companyQuotationMatchesSearch(row, "2032"), true);
    assert.equal(companyQuotationMatchesSearch(row, "shield"), true);
    assert.equal(companyQuotationMatchesSearch(row, "solar installation"), true);
    assert.equal(companyQuotationMatchesSearch(row, "tendai"), true);
    assert.equal(companyQuotationMatchesSearch(row, "unrelated"), false);
  });

  it("applies owner and Deal filters together", () => {
    const row = quote();
    assert.equal(
      companyQuotationMatchesFilters(row, {
        ...DEFAULT_COMPANY_QUOTATION_FILTERS,
        ownerId: "owner-1",
        dealId: "deal-1",
      }),
      true
    );
    assert.equal(
      companyQuotationMatchesFilters(row, {
        ...DEFAULT_COMPANY_QUOTATION_FILTERS,
        dealId: "another-deal",
      }),
      false
    );
  });

  it("matches Pending approval, Needs attention, and Expired primary tabs", () => {
    const pending = quote({ status: "draft", approvalStatus: "pending" });
    const expired = quote({ status: "sent", effectiveStatus: "expired" });
    const viewed = quote({ status: "viewed", effectiveStatus: "viewed", viewedAt: "2026-05-24T08:00:00.000Z" });
    assert.equal(companyQuotationMatchesTab(pending, "pending_approval"), true);
    assert.equal(companyQuotationMatchesTab(pending, "needs_attention"), true);
    assert.equal(companyQuotationMatchesTab(expired, "expired"), true);
    assert.equal(companyQuotationMatchesTab(expired, "sent"), false);
    assert.equal(companyQuotationMatchesTab(viewed, "sent"), true);
  });

  it("treats approval, customer changes, and accepted open Deals as needs attention", () => {
    const now = new Date("2026-05-28T08:00:00.000Z");
    assert.equal(
      companyQuotationNeedsAttention(quote({ approvalStatus: "changes_requested" }), now),
      true
    );
    assert.equal(
      companyQuotationNeedsAttention(
        quote({ customerResponseType: "changes_requested" }),
        now
      ),
      true
    );
    assert.equal(
      companyQuotationNeedsAttention(
        quote({
          status: "accepted",
          effectiveStatus: "accepted",
          dealStage: "NEGOTIATING",
        }),
        now
      ),
      true
    );
    assert.equal(
      companyQuotationNeedsAttention(
        quote({
          status: "accepted",
          effectiveStatus: "accepted",
          dealStage: "WON",
        }),
        now
      ),
      false
    );
  });

  it("keeps quotation status, approval, and customer engagement separate", () => {
    const row = quote({
      effectiveStatus: "sent",
      approvalStatus: "approved",
      viewedAt: "2026-05-24T08:00:00.000Z",
    });
    assert.equal(companyQuotationMatchesTab(row, "sent"), true);
    assert.equal(companyQuotationEngagement(row), "viewed");
    assert.equal(companyQuotationNextAction(row, new Date("2026-05-24T10:00:00.000Z")), "—");
  });

  it("exports operational fields without calling value revenue", () => {
    const csv = buildCompanyQuotationsCsv([quote()]);
    assert.match(csv, /"Quotation","Version","Customer"/);
    assert.match(csv, /"SQ-2032"/);
    assert.match(csv, /"12000","USD","sent"/);
    assert.doesNotMatch(csv, /Revenue/);
  });

  it("treats advanced commercial filters as active filters", () => {
    assert.equal(
      companyQuotationMoreFiltersActive({
        ...DEFAULT_COMPANY_QUOTATION_FILTERS,
        ownerId: "owner-1",
      }),
      false
    );
    assert.equal(
      companyQuotationMoreFiltersActive({
        ...DEFAULT_COMPANY_QUOTATION_FILTERS,
        expiry: "expired",
      }),
      true
    );
  });

  it("computes attention metrics without inventing revenue", () => {
    const metrics = companyQuotationAttention([
      quote({ approvalStatus: "pending", amount: 10000 }),
      quote({
        id: "q2",
        status: "accepted",
        effectiveStatus: "accepted",
        acceptedTotal: 8000,
        amount: 8000,
      }),
      quote({
        id: "q3",
        status: "sent",
        effectiveStatus: "sent",
        validUntil: "2026-05-30",
        sentAt: "2026-05-20T08:00:00.000Z",
      }),
    ], new Date("2026-05-28T08:00:00.000Z"));
    assert.equal(metrics.pendingApproval, 1);
    assert.equal(metrics.pendingApprovalValue, 10000);
    assert.equal(metrics.acceptedValue, 8000);
    assert.equal(metrics.expiringSoon, 1);
    assert.ok(metrics.needsAttention >= 2);
  });

  it("sorts by last updated without mixing quotation identity", () => {
    const older = quote({ id: "a", updatedAt: "2026-05-01T08:00:00.000Z" });
    const newer = quote({ id: "b", updatedAt: "2026-05-23T08:24:00.000Z" });
    assert.deepEqual(
      sortCompanyQuotations([older, newer], "updated_desc").map((row) => row.id),
      ["b", "a"]
    );
    assert.deepEqual(
      sortCompanyQuotations([older, newer], "updated_asc").map((row) => row.id),
      ["a", "b"]
    );
  });

  it("shows Send Again only for sent or viewed quotations", () => {
    assert.equal(companyQuotationSendLabel("draft"), "Send");
    assert.equal(companyQuotationSendLabel("sent"), "Send Again");
    assert.equal(companyQuotationSendLabel("viewed"), "Send Again");
    assert.equal(companyQuotationSendLabel("accepted"), null);
    assert.equal(companyQuotationSendLabel("rejected"), null);
    assert.equal(companyQuotationSendLabel("expired"), null);
  });

  it("distinguishes empty page, search, filter, and tab states", () => {
    assert.equal(
      companyQuotationEmptyKind({
        allCount: 0,
        filteredCount: 0,
        search: "",
        filtersActive: false,
      }),
      "none"
    );
    assert.equal(
      companyQuotationEmptyKind({
        allCount: 8,
        filteredCount: 0,
        search: "shield",
        filtersActive: false,
      }),
      "search"
    );
    assert.equal(
      companyQuotationEmptyKind({
        allCount: 8,
        filteredCount: 0,
        search: "",
        filtersActive: true,
      }),
      "filters"
    );
    assert.equal(
      companyQuotationEmptyKind({
        allCount: 8,
        filteredCount: 0,
        search: "",
        filtersActive: false,
      }),
      "tab"
    );
  });

  it("keeps first, last, and nearby pages with ellipsis", () => {
    assert.deepEqual(companyQuotationPageItems(1, 3), [1, 2, 3]);
    assert.deepEqual(companyQuotationPageItems(1, 16), [1, 2, "ellipsis", 16]);
    assert.deepEqual(companyQuotationPageItems(8, 16), [1, "ellipsis", 7, 8, 9, "ellipsis", 16]);
  });
});
