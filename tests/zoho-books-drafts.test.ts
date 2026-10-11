import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ZOHO_BOOKS_READ_SCOPES,
  ZOHO_BOOKS_SCOPE_PARAM,
  ZOHO_BOOKS_SCOPES,
  ZOHO_BOOKS_WRITE_SCOPES,
  booksWriteUrl,
  draftWritesGranted,
} from "../lib/zoho-books/protocol";
import {
  buildCustomerPayload,
  buildDraftReview,
  booksOrganisationUrl,
  confirmDraftState,
  customerCreateReady,
  decideCreateAttempt,
  decideReconcile,
  documentUpdateAllowed,
  draftAccessDecision,
  forbiddenPayloadKeys,
  interpretReferenceSearch,
  parseContactEmailMatches,
  parseCreatedDocument,
  parseReferenceMatches,
  parseVerifiedContact,
  parseVerifiedItem,
  preCreateSearchDecision,
  referenceNumber,
  totalDifference,
  type DraftSource,
} from "../lib/zoho-books/drafts";

const QUOTE = "11111111-1111-4111-8111-111111111111";

function source(overrides: Partial<DraftSource> = {}): DraftSource {
  return {
    quotationId: QUOTE,
    kind: "estimate",
    currency: "USD",
    headerDiscountPercent: 0,
    proposedTotal: 110,
    customerId: "501",
    customerCurrency: "USD",
    customerVerified: true,
    stockAcknowledged: false,
    lines: [
      {
        name: "Panel",
        quantity: 2,
        rate: 50,
        discountPercent: 10,
        discountAmount: 0,
        taxRate: 15,
        taxInclusive: false,
        itemId: "900",
        optional: false,
      },
    ],
    ...overrides,
  };
}

describe("zoho books draft permissions", () => {
  it("asks for the draft scopes and not delete, payment, or all-access scopes", () => {
    assert.deepEqual([...ZOHO_BOOKS_SCOPES], [
      ...ZOHO_BOOKS_READ_SCOPES,
      ...ZOHO_BOOKS_WRITE_SCOPES,
    ]);
    assert.equal(ZOHO_BOOKS_SCOPE_PARAM.includes(".ALL"), false);
    assert.equal(ZOHO_BOOKS_SCOPE_PARAM.includes("DELETE"), false);
    assert.equal(ZOHO_BOOKS_SCOPE_PARAM.includes("customerpayments"), false);
    assert.equal(draftWritesGranted([...ZOHO_BOOKS_READ_SCOPES]), false);
    assert.equal(draftWritesGranted([...ZOHO_BOOKS_SCOPES]), true);
  });

  it("lets a company manager and the assigned salesperson prepare a draft for their own company", () => {
    assert.equal(
      draftAccessDecision({
        role: "CLIENT_MANAGER",
        sessionClientId: "company-a",
        quotationClientId: "company-a",
        assignedToId: "someone-else",
        userId: "manager",
        method: "POST",
        impersonating: false,
        supportAccess: false,
      }).allowed,
      true
    );
    assert.equal(
      draftAccessDecision({
        role: "SALESPERSON",
        sessionClientId: "company-a",
        quotationClientId: "company-a",
        assignedToId: "rep",
        userId: "rep",
        method: "POST",
        impersonating: false,
        supportAccess: false,
      }).allowed,
      true
    );
  });

  it("denies another company, an unassigned salesperson, and a platform admin write", () => {
    assert.equal(
      draftAccessDecision({
        role: "CLIENT_MANAGER",
        sessionClientId: "company-b",
        quotationClientId: "company-a",
        assignedToId: null,
        userId: "manager",
        method: "POST",
        impersonating: false,
        supportAccess: false,
      }).status,
      403
    );
    const salesperson = draftAccessDecision({
      role: "SALESPERSON",
      sessionClientId: "company-b",
      quotationClientId: "company-a",
      assignedToId: "rep",
      userId: "rep",
      method: "GET",
      impersonating: false,
      supportAccess: false,
    });
    assert.equal(salesperson.status, 404);
    assert.equal(
      draftAccessDecision({
        role: "SALESPERSON",
        sessionClientId: "company-a",
        quotationClientId: "company-a",
        assignedToId: "other",
        userId: "rep",
        method: "POST",
        impersonating: false,
        supportAccess: false,
      }).status,
      403
    );
    assert.equal(
      draftAccessDecision({
        role: "SUPER_ADMIN",
        sessionClientId: null,
        quotationClientId: "company-a",
        assignedToId: null,
        userId: "admin",
        method: "POST",
        impersonating: false,
        supportAccess: true,
      }).status,
      403
    );
  });
});

describe("zoho books draft payload", () => {
  it("builds a draft body without a status, a number, a tax code, or a send flag", () => {
    const review = buildDraftReview(source());
    assert.equal(review.ready, true);
    assert.deepEqual(forbiddenPayloadKeys(review.payload!), []);
    assert.equal(review.payload!.customer_id, "501");
    assert.equal(review.payload!.reference_number, referenceNumber("estimate", QUOTE));
    const line = (review.payload!.line_items as Array<Record<string, unknown>>)[0];
    assert.equal(line.item_id, "900");
    assert.equal(line.discount, "10%");
    assert.equal(line.tax_id, undefined);
    assert.equal(review.lines[0].taxRate, 15);
    assert.match(review.taxNote, /does not send a tax code/);
    assert.match(review.numberingNote, /does not send a number/);
  });

  it("blocks a currency mismatch and a missing Books item", () => {
    const currency = buildDraftReview(source({ customerCurrency: "ZWL" }));
    assert.equal(currency.ready, false);
    assert.match(currency.blockers.join(" "), /will not convert/);
    const missing = buildDraftReview(
      source({
        lines: [{ ...source().lines[0], itemId: null, name: "Labour" }],
      })
    );
    assert.match(missing.blockers.join(" "), /Labour is not linked/);
    assert.equal(missing.payload, null);
  });

  it("keeps optional lines out of the draft and blocks mixed discounts", () => {
    const review = buildDraftReview(
      source({
        lines: [
          source().lines[0],
          { ...source().lines[0], name: "Optional visit", optional: true, itemId: null },
        ],
      })
    );
    assert.equal(review.excludedOptionalCount, 1);
    assert.equal((review.payload!.line_items as unknown[]).length, 1);
    const mixed = buildDraftReview(source({ headerDiscountPercent: 5 }));
    assert.match(mixed.blockers.join(" "), /header discount and line discounts/);
  });

  it("requires an invoice stock check and leaves estimates without one", () => {
    const invoice = buildDraftReview(source({ kind: "invoice" }));
    assert.match(invoice.blockers.join(" "), /does not send a stock adjustment/);
    const acknowledged = buildDraftReview(source({ kind: "invoice", stockAcknowledged: true }));
    assert.equal(acknowledged.ready, true);
    assert.equal(acknowledged.stockNote?.includes("inventory preference"), true);
    assert.equal(buildDraftReview(source()).stockNote, null);
  });

  it("forces send=false and rejects email, status, and payment paths", () => {
    const url = booksWriteUrl("https://www.zohoapis.eu", "POST", "/books/v3/estimates", {
      organization_id: "20096054919",
    });
    assert.ok(url);
    const parsed = new URL(url!);
    assert.equal(parsed.searchParams.get("send"), "false");
    assert.equal(parsed.searchParams.get("ignore_auto_number_generation"), null);
    assert.equal(parsed.searchParams.get("organization_id"), "20096054919");
    assert.equal(
      booksWriteUrl("https://www.zohoapis.eu", "POST", "/books/v3/estimates/1/email", { organization_id: "1" }),
      null
    );
    assert.equal(
      booksWriteUrl("https://www.zohoapis.eu", "POST", "/books/v3/invoices/1/status/sent", { organization_id: "1" }),
      null
    );
    assert.equal(
      booksWriteUrl("https://www.zohoapis.eu", "POST", "/books/v3/customerpayments", { organization_id: "1" }),
      null
    );
    assert.equal(
      booksWriteUrl("https://www.zohoapis.eu", "POST", "/books/v3/estimates", {
        organization_id: "1",
        send: "true",
      }),
      null
    );
  });

  it("creates a customer only as its own payload and only with an email", () => {
    assert.match(customerCreateReady({ name: "Ada", email: null, alreadyLinked: false }) ?? "", /email/);
    const body = buildCustomerPayload({ name: "Ada", email: "ada@example.com", phone: null, company: false });
    assert.equal(body.contact_type, "customer");
    assert.equal(body.currency_id, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(body, "status"), false);
  });
});

describe("zoho books draft writes", () => {
  it("does not post again after a timeout, a double click, or an existing document", () => {
    const now = 1_000_000;
    assert.equal(decideCreateAttempt(null, now), "create");
    assert.equal(decideCreateAttempt({ status: "reserved", updatedAt: now - 1_000, externalId: null }, now), "wait");
    assert.equal(
      decideCreateAttempt({ status: "uncertain", updatedAt: now - 999_999, externalId: null }, now),
      "reconcile"
    );
    assert.equal(
      decideCreateAttempt({ status: "reserved", updatedAt: now - 130_000, externalId: null }, now),
      "reconcile"
    );
    assert.equal(
      decideCreateAttempt({ status: "succeeded", updatedAt: now, externalId: "55" }, now),
      "return_existing"
    );
    assert.equal(decideCreateAttempt({ status: "failed", updatedAt: now, externalId: null }, now), "create");
  });

  it("adopts one matching reference, blocks many, and retries only after an empty confirmed search", () => {
    assert.equal(preCreateSearchDecision({ exactCount: 0, hasMore: false }), "post");
    assert.equal(preCreateSearchDecision({ exactCount: 0, hasMore: true }), "incomplete");
    assert.equal(preCreateSearchDecision({ exactCount: 1, hasMore: false }), "adopt");
    assert.equal(preCreateSearchDecision({ exactCount: 2, hasMore: false }), "ambiguous");
    assert.equal(interpretReferenceSearch([]), "not_found");
    assert.equal(
      decideReconcile({ search: "not_found", searchIncomplete: false, confirmNotCreated: false }),
      "needs_reconciliation"
    );
    assert.equal(
      decideReconcile({ search: "not_found", searchIncomplete: false, confirmNotCreated: true }),
      "clear_for_retry"
    );
    assert.equal(
      decideReconcile({ search: "not_found", searchIncomplete: true, confirmNotCreated: true }),
      "needs_reconciliation"
    );
    assert.equal(
      decideReconcile({ search: "ambiguous", searchIncomplete: false, confirmNotCreated: true }),
      "needs_reconciliation"
    );
    assert.equal(
      decideReconcile({ search: "adopt", searchIncomplete: false, confirmNotCreated: false }),
      "adopt"
    );
  });

  it("accepts only an exact reference and a draft status, and shows a different Books total", () => {
    const created = parseCreatedDocument(
      "estimate",
      {
        code: 0,
        estimate: {
          estimate_id: "55",
          estimate_number: "EST-00002",
          status: "draft",
          total: 112.5,
          reference_number: referenceNumber("estimate", QUOTE),
          customer_id: "501",
        },
      },
      referenceNumber("estimate", QUOTE)
    );
    assert.equal(created?.status, "draft");
    assert.equal(confirmDraftState(created?.status ?? null).draft, true);
    assert.equal(confirmDraftState("sent").draft, false);
    assert.equal(
      parseCreatedDocument("estimate", { estimate: { estimate_id: "55", reference_number: "other", status: "draft" } }, referenceNumber("estimate", QUOTE)),
      null
    );
    const page = parseReferenceMatches(
      "invoice",
      {
        invoices: [
          { invoice_id: "9", reference_number: "other", status: "draft" },
          { invoice_id: "8", reference_number: referenceNumber("invoice", QUOTE), status: "draft", total: 40 },
        ],
      },
      referenceNumber("invoice", QUOTE)
    );
    assert.equal(page.length, 1);
    assert.equal(page[0].id, "8");
    const diff = totalDifference(110, 112.5);
    assert.equal(diff.differs, true);
    assert.equal(diff.difference, 2.5);
    assert.equal(diff.booksTotal, 112.5);
  });

  it("updates only a linked draft and requires acknowledgement when Books changed the total", () => {
    assert.equal(documentUpdateAllowed({ linked: false, booksStatus: "draft", booksTotal: 1, snapshotTotal: 1, acknowledgeBooksChanges: true }).allowed, false);
    assert.match(
      documentUpdateAllowed({ linked: true, booksStatus: "sent", booksTotal: 1, snapshotTotal: 1, acknowledgeBooksChanges: true }).message,
      /no longer a draft/
    );
    assert.equal(
      documentUpdateAllowed({ linked: true, booksStatus: "draft", booksTotal: 20, snapshotTotal: 10, acknowledgeBooksChanges: false }).allowed,
      false
    );
    assert.equal(
      documentUpdateAllowed({ linked: true, booksStatus: "draft", booksTotal: 20, snapshotTotal: 10, acknowledgeBooksChanges: true }).allowed,
      true
    );
  });

  it("verifies the customer and item belong to the returned record", () => {
    assert.equal(parseVerifiedContact({ contact: { contact_id: "501", contact_type: "customer", currency_code: "usd" } }, "501")?.currency, "USD");
    assert.equal(parseVerifiedContact({ contact: { contact_id: "501", contact_type: "vendor" } }, "501"), null);
    assert.equal(parseVerifiedContact({ contact: { contact_id: "999", contact_type: "customer" } }, "501"), null);
    assert.deepEqual(parseVerifiedItem({ item: { item_id: "900" } }, "900"), { id: "900" });
    assert.equal(parseVerifiedItem({ item: { item_id: "901" } }, "900"), null);
    assert.deepEqual(
      parseContactEmailMatches(
        { contacts: [{ contact_id: "5", email: "Ada@Example.com", contact_type: "customer" }, { contact_id: "6", email: "other@example.com", contact_type: "customer" }] },
        "ada@example.com"
      ),
      ["5"]
    );
    assert.equal(booksOrganisationUrl("eu", "20096054919"), "https://books.zoho.eu/app/20096054919");
    assert.equal(booksOrganisationUrl("eu", "../other"), null);
  });
});
