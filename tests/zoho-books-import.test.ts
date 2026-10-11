import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { zohoBooksGet, zohoBooksGetWithBackoff, ZohoBooksRequestError } from "../lib/zoho-books/http";
import {
  advanceInvoiceCursor,
  booksItemStatus,
  catalogItemDisposition,
  itemCatalogQuery,
  booksSyncAttention,
  classifyZohoFailure,
  commitAfterWrite,
  customerCandidates,
  customerListQuery,
  invoiceListQuery,
  itemListQuery,
  materializeCustomer,
  materializeItem,
  normalizeZohoPhone,
  planCustomer,
  planItem,
  presentBooksInvoice,
  quotaBackoff,
  resolvePlanAction,
  sameTenant,
  type BooksCustomer,
  type BooksItem,
  type LocalContact,
  type LocalProduct,
} from "../lib/zoho-books/import-plan";
import { parseCustomerRecord, parseInvoicePage, parseItemRecord } from "../lib/zoho-books/protocol";

const customer: BooksCustomer = {
  zohoId: "100",
  name: "Ada Books",
  companyName: "Ada Ltd",
  email: "ada@example.com",
  phoneRaw: "+263772000111",
  currencyCode: "EUR",
  status: "active",
  customerSubType: "business",
  firstName: null,
  lastName: null,
};

const item: BooksItem = {
  zohoId: "200",
  name: "Panel",
  sku: "PNL-1",
  rate: "100",
  currencyCode: null,
  taxPercentage: "15",
  taxName: "VAT",
  unit: "box",
  status: "inactive",
  description: "Catalogue text",
  productType: "goods",
  purchaseRate: "40",
  stockOnHand: "12",
  locationAvailableStock: "9",
  locationActualAvailableStock: "8",
  isTaxInclusive: null,
};

function contact(partial: Partial<LocalContact> & Pick<LocalContact, "id" | "clientId">): LocalContact {
  return {
    name: "Local",
    email: null,
    phone: null,
    customerType: null,
    primaryContactName: null,
    notes: "Keep this note",
    lifecycle: "pipeline",
    relationshipOwnerId: "owner-1",
    ...partial,
  };
}

describe("zoho books import planning", () => {
  it("reads customers with the documented customer filter and keeps pages small", () => {
    const query = customerListQuery("20096054919", 2);
    assert.equal(query.contact_type, "customer");
    assert.equal(query.per_page, "5");
    assert.equal(query.page, "2");
    assert.equal(itemListQuery("20096054919", 1).filter_by, "Status.All");
    assert.equal(itemCatalogQuery("20096054919", 21).page, "21");
    assert.equal(itemCatalogQuery("20096054919", 21).per_page, "25");
    assert.equal(catalogItemDisposition("create"), "apply");
    assert.equal(catalogItemDisposition("update"), "apply");
    assert.equal(catalogItemDisposition("conflict"), "hold");
    assert.equal(catalogItemDisposition("blocked"), "skip");
    assert.equal(invoiceListQuery("20096054919", "100", 1).customer_id, "100");
    assert.equal(parseCustomerRecord({ contact: { contact_id: "9", contact_name: "Vendor", contact_type: "vendor" } }), null);
  });

  it("does not match a customer by name and requires an explicit link", () => {
    const sameName = contact({ id: "c-1", clientId: "company-a", name: "Ada Ltd", email: "other@example.com" });
    const emailMatch = contact({ id: "c-2", clientId: "company-a", email: "ADA@example.com" });
    const otherCompany = contact({ id: "c-3", clientId: "company-b", email: "ada@example.com" });
    const plan = planCustomer({
      actorClientId: "company-a",
      books: customer,
      dialCode: "263",
      link: null,
      contact: null,
      contacts: [sameName, emailMatch, otherCompany],
      linkedExternalBySegmiqId: new Map(),
      previousCurrency: null,
    });
    assert.equal(plan.action, "conflict");
    assert.deepEqual(plan.candidates.map((row) => row.id), ["c-2"]);
    assert.equal(resolvePlanAction(plan, { zohoId: "100", decision: "create" }).ok, false);
    const linked = resolvePlanAction(plan, { zohoId: "100", decision: "link", linkToId: "c-2" });
    assert.equal(linked.ok, true);
    if (linked.ok) assert.equal(linked.segmiqId, "c-2");
  });

  it("updates the same linked customer on reimport and leaves SegmiQ notes alone", () => {
    const local = contact({
      id: "c-1",
      clientId: "company-a",
      name: "Old name",
      email: "ada@example.com",
      phone: "+263772000111",
      lifecycle: "customer",
    });
    const plan = planCustomer({
      actorClientId: "company-a",
      books: { ...customer, name: "Ada Books" },
      dialCode: "263",
      link: { segmiqId: "c-1", clientId: "company-a" },
      contact: local,
      contacts: [local],
      linkedExternalBySegmiqId: new Map([["c-1", "100"]]),
      previousCurrency: "EUR",
    });
    assert.equal(plan.action, "update");
    assert.equal(plan.segmiqId, "c-1");
    const first = materializeCustomer({
      books: customer,
      dialCode: "263",
      mode: "create",
      existingSegmiqId: null,
      reservedId: "c-1",
      currentLifecycle: null,
    });
    const second = materializeCustomer({
      books: { ...customer, name: "Ada Renamed" },
      dialCode: "263",
      mode: "update",
      existingSegmiqId: first.segmiqId,
      reservedId: "different",
      currentLifecycle: "customer",
    });
    assert.equal(second.segmiqId, "c-1");
    assert.equal(second.setLifecycleCustomer, false);
    assert.equal("notes" in second.patch, false);
    assert.equal(second.patch.name, "Ada Ltd");
  });

  it("refuses a link that belongs to another company", () => {
    const plan = planCustomer({
      actorClientId: "company-a",
      books: customer,
      dialCode: null,
      link: { segmiqId: "c-9", clientId: "company-b" },
      contact: null,
      contacts: [],
      linkedExternalBySegmiqId: new Map(),
      previousCurrency: null,
    });
    assert.equal(plan.action, "blocked");
    assert.equal(sameTenant("company-a", "company-b"), false);
  });

  it("normalises a phone only when the number or the company dial code identifies a country", () => {
    assert.equal(normalizeZohoPhone("+263772000111", null).normalized, true);
    assert.equal(normalizeZohoPhone("0772000111", null).normalized, false);
    assert.equal(normalizeZohoPhone("0772000111", null).phone, "0772000111");
    assert.equal(normalizeZohoPhone("0772000111", "999").normalized, false);
    const local = normalizeZohoPhone("772000111", "263");
    assert.equal(local.normalized, true);
    assert.equal(local.phone, "+263772000111");
    const candidates = customerCandidates({
      actorClientId: "company-a",
      phone: "0772000111",
      phoneNormalized: false,
      email: null,
      contacts: [contact({ id: "c-1", clientId: "company-a", phone: "0772000111" })],
      linkedExternalBySegmiqId: new Map(),
      currentZohoId: "100",
    });
    assert.equal(candidates.length, 0);
  });

  it("keeps an inactive item, its currency, and its tax without converting the price", () => {
    assert.equal(booksItemStatus("inactive"), "INACTIVE");
    const plan = planItem({
      actorClientId: "company-a",
      books: item,
      organisationCurrency: "EUR",
      link: null,
      product: null,
      products: [],
      linkedExternalBySegmiqId: new Map(),
      fetchedAt: "2026-10-11T18:00:00.000Z",
    });
    assert.equal(plan.action, "create");
    assert.equal(plan.currencyCode, "EUR");
    assert.equal(plan.currencySource, "organisation");
    assert.equal(plan.price, "100");
    assert.equal(plan.taxPercent, "15");
    assert.match(plan.stockNote ?? "", /stock_on_hand/);
    assert.match(plan.stockNote ?? "", /does not treat it as available stock/);
    const material = materializeItem({
      books: item,
      organisationCurrency: "EUR",
      mode: "create",
      existingSegmiqId: null,
      reservedId: "p-1",
      localStatus: null,
      fetchedAt: "2026-10-11T18:00:00.000Z",
    });
    assert.equal("error" in material, false);
    if ("error" in material) return;
    assert.equal(material.patch.selling_price, 100);
    assert.equal(material.patch.currency, "EUR");
    assert.equal(material.patch.tax_rate, 15);
    assert.equal(material.patch.status, "INACTIVE");
    assert.equal(material.patch.unit, "box");
    assert.equal("track_inventory" in material.patch, false);
  });

  it("asks before linking a product with the same SKU and keeps an archived product archived", () => {
    const existing: LocalProduct = {
      id: "p-9",
      clientId: "company-a",
      name: "Other panel",
      sku: "pnl-1",
      sellingPrice: "80",
      currency: "EUR",
      taxRate: "15",
      unit: "box",
      status: "ARCHIVED",
      description: "Local",
      costPrice: "30",
      quotationDescription: "Quote text",
    };
    const conflict = planItem({
      actorClientId: "company-a",
      books: { ...item, currencyCode: "EUR", status: "active" },
      organisationCurrency: "EUR",
      link: null,
      product: null,
      products: [existing, { ...existing, id: "p-other", clientId: "company-b" }],
      linkedExternalBySegmiqId: new Map(),
      fetchedAt: "2026-10-11T18:00:00.000Z",
    });
    assert.equal(conflict.action, "conflict");
    assert.deepEqual(conflict.candidates.map((row) => row.id), ["p-9"]);
    assert.equal(resolvePlanAction(conflict, { zohoId: "200", decision: "create" }).ok, false);
    const linked = planItem({
      actorClientId: "company-a",
      books: { ...item, currencyCode: "EUR", status: "active", rate: "120" },
      organisationCurrency: "EUR",
      link: { segmiqId: "p-9", clientId: "company-a" },
      product: existing,
      products: [existing],
      linkedExternalBySegmiqId: new Map([["p-9", "200"]]),
      fetchedAt: "2026-10-11T18:00:00.000Z",
    });
    assert.equal(linked.action, "update");
    assert.equal(linked.changes.some((change) => change.field === "Status" && change.to === "ARCHIVED (kept)"), true);
    assert.equal(linked.changes.some((change) => change.field === "Selling price" && change.to === "120"), true);
    const material = materializeItem({
      books: { ...item, currencyCode: "EUR", status: "active" },
      organisationCurrency: "EUR",
      mode: "update",
      existingSegmiqId: "p-9",
      reservedId: "new",
      localStatus: "ARCHIVED",
      fetchedAt: "2026-10-11T18:00:00.000Z",
    });
    if ("error" in material) throw new Error(material.error);
    assert.equal(material.segmiqId, "p-9");
    assert.equal(material.patch.status, undefined);
    assert.equal(material.patch.selling_price, 100);
  });

  it("shows a partial payment and a void invoice from Books fields without recording cash", () => {
    const partial = presentBooksInvoice({
      status: "partially_paid",
      total: "200",
      balance: "50",
      creditsApplied: "10",
      currencyCode: "EUR",
    });
    assert.equal(partial.outstanding, "50");
    assert.equal(partial.total, "200");
    assert.equal(partial.partialPayment, true);
    assert.equal(partial.recordsCash, false);
    assert.equal(partial.marksDealsWon, false);
    const voided = presentBooksInvoice({ status: "void", total: "200", balance: "0", creditsApplied: "0", currencyCode: "EUR" });
    assert.equal(voided.voided, true);
    assert.equal(voided.outstanding, "0");
    const parsed = parseInvoicePage({
      invoices: [{ invoice_id: "1", customer_id: "100", status: "partially_paid", total: "200.00", balance: "50.00", currency_code: "EUR" }],
    });
    assert.equal(parsed[0]?.balance, "50");
    assert.equal(parsed[0]?.total, "200");
  });

  it("resumes after a failed record without repeating the records already saved", async () => {
    const written: string[] = [];
    const first = await commitAfterWrite({
      pending: ["a", "b", "c"],
      completedKeys: [],
      keyOf: (id) => id,
      write: async (id) => {
        if (id === "c") throw new ZohoBooksRequestError("Zoho Books daily API limit was reached for this organisation.", 429, false, { quota: true });
        written.push(id);
      },
      save: async () => undefined,
    });
    assert.deepEqual(first.completedKeys, ["a", "b"]);
    assert.equal(first.pausedOn, "c");
    const second = await commitAfterWrite({
      pending: ["a", "b", "c"],
      completedKeys: first.completedKeys,
      keyOf: (id) => id,
      write: async (id) => {
        written.push(id);
      },
      save: async () => undefined,
    });
    assert.deepEqual(second.completedKeys, ["a", "b", "c"]);
    assert.deepEqual(written, ["a", "b", "c"]);
  });

  it("stops a Books page cursor until the local invoice write succeeds", () => {
    const first = { customerIndex: 0, page: 1 };
    assert.deepEqual(advanceInvoiceCursor(first, true, 2), { customerIndex: 0, page: 2 });
    assert.deepEqual(advanceInvoiceCursor({ customerIndex: 0, page: 5 }, true, 2), { customerIndex: 1, page: 1 });
    assert.equal(advanceInvoiceCursor({ customerIndex: 1, page: 1 }, false, 2), "done");
    assert.deepEqual(first, { customerIndex: 0, page: 1 });
  });

  it("treats revoked access and quota differently, and retries a 429 only once", async () => {
    assert.equal(classifyZohoFailure(401, null), "revoked");
    assert.equal(classifyZohoFailure(403, null), "revoked");
    assert.equal(classifyZohoFailure(429, 45), "quota");
    assert.equal(classifyZohoFailure(429, 44), "quota");
    assert.equal(classifyZohoFailure(429, 1070), "quota");
    assert.deepEqual(quotaBackoff(0, 30), { stop: false, retryMs: 2000 });
    assert.deepEqual(quotaBackoff(1, 1), { stop: true });
    assert.match(booksSyncAttention("paused", "Zoho Books daily API limit was reached for this organisation.") ?? "", /Sync now/);
    assert.match(booksSyncAttention("failed", "Reconnect Zoho Books to continue.") ?? "", /links stay stored/);
    assert.equal(booksSyncAttention("completed", null), null);

    let quotaCalls = 0;
    const slept: number[] = [];
    await zohoBooksGetWithBackoff(
      {
        apiDomain: "https://www.zohoapis.eu",
        accessToken: "token-value",
        path: "/books/v3/contacts",
        fetchImpl: async () => {
          quotaCalls += 1;
          if (quotaCalls === 1) return new Response(JSON.stringify({ code: 45, message: "daily" }), { status: 429, headers: { "retry-after": "9" } });
          return new Response(JSON.stringify({ contacts: [] }), { status: 200 });
        },
      },
      { sleep: async (ms) => void slept.push(ms) }
    );
    assert.equal(quotaCalls, 2);
    assert.deepEqual(slept, [2000]);

    let revokedCalls = 0;
    await assert.rejects(
      () =>
        zohoBooksGetWithBackoff(
          {
            apiDomain: "https://www.zohoapis.eu",
            accessToken: "token-value",
            path: "/books/v3/contacts",
            fetchImpl: async () => {
              revokedCalls += 1;
              return new Response(JSON.stringify({ code: 57, message: "revoked" }), { status: 401 });
            },
          },
          { sleep: async () => undefined }
        ),
      (error: unknown) => error instanceof ZohoBooksRequestError && error.revoked && !error.quota
    );
    assert.equal(revokedCalls, 1);
    const quotaError = await zohoBooksGet({
      apiDomain: "https://www.zohoapis.eu",
      accessToken: "token-value",
      path: "/books/v3/items",
      fetchImpl: async () => new Response(JSON.stringify({ code: 44 }), { status: 429 }),
    }).catch((error: unknown) => error);
    assert.equal(quotaError instanceof ZohoBooksRequestError && quotaError.quota && !quotaError.revoked, true);
  });

  it("reads an item price and tax without flattening them", () => {
    const parsed = parseItemRecord({
      item: { item_id: "200", name: "Panel", rate: 100, tax_percentage: "15", currency_code: "EUR", status: "inactive", stock_on_hand: 4 },
    });
    assert.equal(parsed?.rate, "100");
    assert.equal(parsed?.taxPercentage, "15");
    assert.equal(parsed?.currencyCode, "EUR");
    assert.equal(parsed?.status, "inactive");
    assert.equal(parsed?.stockOnHand, "4");
  });
});
