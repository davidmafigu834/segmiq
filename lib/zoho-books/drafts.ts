/**
 * Reviewed Zoho Books draft estimates and invoices.
 *
 * Books owns the document number, the customer currency, the tax stored on
 * each item, and the total it calculates. SegmiQ sends the mapped customer,
 * mapped item ids, quantities, rates, and discounts, then stores the id,
 * number, status, and total Books returns.
 *
 * Zoho's create estimate and create invoice pages do not document an
 * idempotency key. reference_number is the documented external identifier.
 * A lost response is reconciled by that value. It is never posted again
 * until a search shows the document was not created.
 */

export type DraftKind = "estimate" | "invoice";

export type WriteStatus = "reserved" | "uncertain" | "succeeded" | "failed" | "needs_reconciliation";

export type DraftSourceLine = {
  name: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number | null;
  taxInclusive: boolean;
  itemId: string | null;
  optional: boolean;
};

export type DraftSource = {
  quotationId: string;
  kind: DraftKind;
  currency: string;
  headerDiscountPercent: number;
  proposedTotal: number;
  customerId: string | null;
  customerCurrency: string | null;
  customerVerified: boolean;
  lines: DraftSourceLine[];
  stockAcknowledged: boolean;
};

export type ReviewedLine = {
  name: string;
  quantity: number;
  rate: number;
  discount: string | null;
  taxRate: number | null;
  taxInclusive: boolean;
  itemId: string;
};

export type DraftReview = {
  ready: boolean;
  blockers: string[];
  referenceNumber: string;
  currency: string;
  customerId: string | null;
  lines: ReviewedLine[];
  excludedOptionalCount: number;
  proposedTotal: number;
  taxNote: string;
  numberingNote: string;
  currencyNote: string;
  stockNote: string | null;
  payload: Record<string, unknown> | null;
};

export const WRITE_LOCK_MS = 120_000;
export const MAX_DRAFT_LINES = 30;

const TAX_NOTE =
  "The tax rates below are from the SegmiQ quotation. This draft does not send a tax code. Books applies the tax already stored on each mapped item. The total Books returns is the accounting total.";

const NUMBERING_NOTE = "Books assigns the document number. SegmiQ does not send a number.";

const CURRENCY_NOTE = "The Books customer currency is used. SegmiQ does not convert amounts.";

const STOCK_NOTE =
  "SegmiQ does not send a stock adjustment and does not call Books inventory endpoints. Books can still follow this organisation's own inventory preference when an invoice is saved. Create the draft invoice only after you have checked that preference and confirmed a draft does not issue stock.";

export function referenceNumber(kind: DraftKind, quotationId: string): string {
  const prefix = kind === "estimate" ? "segmiq-est-" : "segmiq-inv-";
  return `${prefix}${quotationId}`.slice(0, 100);
}

export function booksOrganisationUrl(location: string | null, organizationId: string): string | null {
  const hosts: Record<string, string> = {
    us: "https://books.zoho.com",
    eu: "https://books.zoho.eu",
    in: "https://books.zoho.in",
    au: "https://books.zoho.com.au",
    jp: "https://books.zoho.jp",
    ca: "https://books.zoho.ca",
    cn: "https://books.zoho.com.cn",
    sa: "https://books.zoho.sa",
    ae: "https://books.zoho.ae",
  };
  const host = location ? hosts[location] : null;
  if (!host || !/^[A-Za-z0-9]+$/.test(organizationId)) return null;
  return `${host}/app/${organizationId}`;
}

export function currencyConflict(quoteCurrency: string, booksCurrency: string | null): string | null {
  const quote = quoteCurrency.trim().toUpperCase();
  const books = booksCurrency?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{3}$/.test(books)) return "Books did not return a currency for this customer.";
  if (!/^[A-Z]{3}$/.test(quote)) return "This quotation has no currency code.";
  if (quote !== books) {
    return `This quotation is ${quote} and the Books customer is ${books}. SegmiQ will not convert it.`;
  }
  return null;
}

export function lineDiscount(percent: number, amount: number): string | null {
  if (percent > 0 && amount > 0) return null;
  if (percent > 0) return `${trimNumber(percent)}%`;
  if (amount > 0) return trimNumber(amount);
  return null;
}

function trimNumber(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

export function buildDraftReview(source: DraftSource): DraftReview {
  const blockers: string[] = [];
  const included = source.lines.filter((line) => !line.optional);
  const excludedOptionalCount = source.lines.length - included.length;
  if (included.length === 0) blockers.push("This quotation has no priced lines to send.");
  if (included.length > MAX_DRAFT_LINES) blockers.push(`This quotation has more than ${MAX_DRAFT_LINES} lines.`);
  if (!source.customerId) blockers.push("Link a Books customer before creating a draft.");
  else if (!source.customerVerified) blockers.push("The linked Books customer could not be confirmed in the selected organisation.");
  const currencyBlock = source.customerId ? currencyConflict(source.currency, source.customerCurrency) : null;
  if (currencyBlock) blockers.push(currencyBlock);

  const taxFlags = new Set(included.map((line) => line.taxInclusive));
  if (taxFlags.size > 1) blockers.push("Some lines include tax in the price and some do not. Make them consistent before creating a draft.");

  const lineDiscounts = included.some((line) => line.discountPercent > 0 || line.discountAmount > 0);
  if (source.headerDiscountPercent > 0 && lineDiscounts) {
    blockers.push("This quotation has a header discount and line discounts. Remove one in SegmiQ before creating the draft.");
  }
  if (source.kind === "invoice" && !source.stockAcknowledged) blockers.push(STOCK_NOTE);

  const reviewed: ReviewedLine[] = [];
  for (const line of included) {
    if (!line.itemId) {
      blockers.push(`${line.name} is not linked to a Books item in this organisation.`);
      continue;
    }
    if (!(line.quantity > 0) || !(line.rate >= 0)) {
      blockers.push(`${line.name} needs a quantity and a price.`);
      continue;
    }
    if (line.discountPercent > 0 && line.discountAmount > 0) {
      blockers.push(`${line.name} has both a percent discount and an amount discount.`);
      continue;
    }
    reviewed.push({
      name: line.name,
      quantity: line.quantity,
      rate: line.rate,
      discount: lineDiscount(line.discountPercent, line.discountAmount),
      taxRate: line.taxRate,
      taxInclusive: line.taxInclusive,
      itemId: line.itemId,
    });
  }

  const ready = blockers.length === 0 && reviewed.length > 0 && reviewed.length === included.length;
  const payload = ready ? buildPayload(source, reviewed) : null;
  return {
    ready,
    blockers,
    referenceNumber: referenceNumber(source.kind, source.quotationId),
    currency: source.currency.trim().toUpperCase(),
    customerId: source.customerId,
    lines: reviewed,
    excludedOptionalCount,
    proposedTotal: source.proposedTotal,
    taxNote: TAX_NOTE,
    numberingNote: NUMBERING_NOTE,
    currencyNote: CURRENCY_NOTE,
    stockNote: source.kind === "invoice" ? STOCK_NOTE : null,
    payload,
  };
}

function buildPayload(source: DraftSource, lines: ReviewedLine[]): Record<string, unknown> {
  const lineItems = lines.map((line) => {
    const row: Record<string, unknown> = {
      item_id: line.itemId,
      quantity: line.quantity,
      rate: line.rate,
    };
    if (line.discount) row.discount = line.discount;
    return row;
  });
  const body: Record<string, unknown> = {
    customer_id: source.customerId,
    reference_number: referenceNumber(source.kind, source.quotationId),
    line_items: lineItems,
  };
  const inclusive = lines.every((line) => line.taxInclusive);
  body.is_inclusive_tax = inclusive;
  if (source.headerDiscountPercent > 0) {
    body.discount = `${trimNumber(source.headerDiscountPercent)}%`;
    body.discount_type = "entity_level";
  } else if (lines.some((line) => line.discount)) {
    body.discount_type = "item_level";
  }
  return body;
}

export function forbiddenPayloadKeys(payload: Record<string, unknown>): string[] {
  const banned = ["status", "estimate_number", "invoice_number", "ignore_auto_number_generation", "send", "tax_id"];
  return banned.filter((key) => Object.prototype.hasOwnProperty.call(payload, key));
}

export type WriteOpState = {
  status: WriteStatus;
  updatedAt: number;
  externalId: string | null;
};

export function decideCreateAttempt(
  existing: WriteOpState | null,
  now: number
): "create" | "return_existing" | "wait" | "reconcile" {
  if (!existing) return "create";
  if (existing.status === "succeeded" && existing.externalId) return "return_existing";
  if (existing.status === "failed") return "create";
  if (existing.status === "reserved" && now - existing.updatedAt < WRITE_LOCK_MS) return "wait";
  return "reconcile";
}

export type ReferenceMatch = {
  id: string;
  number: string | null;
  status: string | null;
  reference: string;
  total: number | null;
  customerId: string | null;
};

export function preCreateSearchDecision(input: { exactCount: number; hasMore: boolean }): "post" | "adopt" | "ambiguous" | "incomplete" {
  if (input.exactCount === 1) return "adopt";
  if (input.exactCount > 1) return "ambiguous";
  if (input.hasMore) return "incomplete";
  return "post";
}

export function interpretReferenceSearch(matches: ReferenceMatch[]): "adopt" | "not_found" | "ambiguous" {
  if (matches.length === 1) return "adopt";
  if (matches.length === 0) return "not_found";
  return "ambiguous";
}

export function decideReconcile(input: {
  search: "adopt" | "not_found" | "ambiguous";
  searchIncomplete: boolean;
  confirmNotCreated: boolean;
}): "adopt" | "clear_for_retry" | "needs_reconciliation" {
  if (input.search === "adopt") return "adopt";
  if (input.search === "ambiguous" || input.searchIncomplete) return "needs_reconciliation";
  if (input.confirmNotCreated) return "clear_for_retry";
  return "needs_reconciliation";
}

export function confirmDraftState(status: string | null): { draft: boolean; message: string } {
  if (status === "draft") return { draft: true, message: "Books returned this document as a draft." };
  return {
    draft: false,
    message: `Books returned status ${status ?? "unknown"}. SegmiQ did not mark it sent, email it, or record a payment.`,
  };
}

export function totalDifference(proposed: number, books: number | null): {
  booksTotal: number | null;
  difference: number | null;
  differs: boolean;
} {
  if (books == null || !Number.isFinite(books)) return { booksTotal: null, difference: null, differs: false };
  const difference = Math.round((books - proposed) * 100) / 100;
  return { booksTotal: books, difference, differs: Math.abs(difference) >= 0.01 };
}

export function documentUpdateAllowed(input: {
  linked: boolean;
  booksStatus: string | null;
  booksTotal: number | null;
  snapshotTotal: number | null;
  acknowledgeBooksChanges: boolean;
}): { allowed: boolean; message: string } {
  if (!input.linked) return { allowed: false, message: "This quotation is not linked to a Books document." };
  if (input.booksStatus !== "draft") {
    return { allowed: false, message: `Books status is ${input.booksStatus ?? "unknown"}. SegmiQ will not change a document that is no longer a draft.` };
  }
  const booksChanged =
    input.snapshotTotal != null &&
    input.booksTotal != null &&
    Math.abs(input.booksTotal - input.snapshotTotal) >= 0.01;
  if (booksChanged && !input.acknowledgeBooksChanges) {
    return {
      allowed: false,
      message: "Books has a different total from the last snapshot. Review that difference before replacing the draft.",
    };
  }
  return { allowed: true, message: "Books still has this document as a draft." };
}

export function draftAccessDecision(input: {
  role: string;
  sessionClientId: string | null;
  quotationClientId: string;
  assignedToId: string | null;
  userId: string;
  method: "GET" | "POST";
  impersonating: boolean;
  supportAccess: boolean;
}): { allowed: boolean; status: 200 | 403 | 404 } {
  if (input.role === "SUPER_ADMIN" && !input.impersonating) {
    if (input.method !== "GET") return { allowed: false, status: 403 };
    return input.supportAccess ? { allowed: true, status: 200 } : { allowed: false, status: 403 };
  }
  if (input.role === "CLIENT_MANAGER") {
    if (input.sessionClientId !== input.quotationClientId) return { allowed: false, status: 403 };
    return { allowed: true, status: 200 };
  }
  if (input.role === "SALESPERSON") {
    if (input.sessionClientId !== input.quotationClientId) return { allowed: false, status: 404 };
    if (input.assignedToId !== input.userId) return { allowed: false, status: 403 };
    return { allowed: true, status: 200 };
  }
  return { allowed: false, status: 403 };
}

export function customerCreateReady(input: { name: string | null; email: string | null; alreadyLinked: boolean }): string | null {
  if (input.alreadyLinked) return "This contact is already linked to a Books customer.";
  if (!input.name?.trim()) return "The SegmiQ contact needs a name before a Books customer can be created.";
  if (!input.email?.trim() || !input.email.includes("@")) {
    return "Add an email on the SegmiQ contact before creating a Books customer, so a lost response can be checked without matching by name.";
  }
  return null;
}

export function buildCustomerPayload(input: { name: string; email: string; phone: string | null; company: boolean }): Record<string, unknown> {
  const body: Record<string, unknown> = {
    contact_name: input.name.trim(),
    contact_type: "customer",
    email: input.email.trim(),
  };
  if (input.company) body.company_name = input.name.trim();
  if (input.phone?.trim()) body.phone = input.phone.trim();
  return body;
}

function recordOf(body: unknown, key: string): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>)[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseCreatedDocument(
  kind: DraftKind,
  body: unknown,
  expectedReference: string
): ReferenceMatch | null {
  const key = kind === "estimate" ? "estimate" : "invoice";
  const row = recordOf(body, key);
  if (!row) return null;
  const id = text(row[kind === "estimate" ? "estimate_id" : "invoice_id"]);
  const reference = text(row.reference_number);
  if (!id || reference !== expectedReference) return null;
  return {
    id,
    number: text(row[kind === "estimate" ? "estimate_number" : "invoice_number"]),
    status: text(row.status),
    reference,
    total: num(row.total),
    customerId: text(row.customer_id),
  };
}

export function parseReferenceMatches(kind: DraftKind, body: unknown, reference: string): ReferenceMatch[] {
  if (!body || typeof body !== "object") return [];
  const key = kind === "estimate" ? "estimates" : "invoices";
  const rows = (body as Record<string, unknown>)[key];
  if (!Array.isArray(rows)) return [];
  const matches: ReferenceMatch[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (text(item.reference_number) !== reference) continue;
    const id = text(item[kind === "estimate" ? "estimate_id" : "invoice_id"]);
    if (!id) continue;
    matches.push({
      id,
      number: text(item[kind === "estimate" ? "estimate_number" : "invoice_number"]),
      status: text(item.status),
      reference,
      total: num(item.total),
      customerId: text(item.customer_id),
    });
  }
  return matches;
}

export function parseVerifiedContact(body: unknown, expectedId: string): { id: string; currency: string | null; email: string | null } | null {
  const row = recordOf(body, "contact") ?? (body && typeof body === "object" ? (body as Record<string, unknown>) : null);
  if (!row) return null;
  const nested = recordOf(body, "contact") ?? row;
  const id = text(nested.contact_id);
  const type = text(nested.contact_type)?.toLowerCase();
  if (!id || id !== expectedId || type !== "customer") return null;
  return { id, currency: text(nested.currency_code)?.toUpperCase() ?? null, email: text(nested.email) };
}

export function parseVerifiedItem(body: unknown, expectedId: string): { id: string } | null {
  const row = recordOf(body, "item");
  if (!row) return null;
  const id = text(row.item_id);
  if (!id || id !== expectedId) return null;
  return { id };
}

export function parseContactEmailMatches(body: unknown, email: string): string[] {
  if (!body || typeof body !== "object") return [];
  const rows = (body as { contacts?: unknown }).contacts;
  if (!Array.isArray(rows)) return [];
  const wanted = email.trim().toLowerCase();
  const ids: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (text(item.email)?.toLowerCase() !== wanted) continue;
    if (text(item.contact_type)?.toLowerCase() !== "customer") continue;
    const id = text(item.contact_id);
    if (id) ids.push(id);
  }
  return ids;
}
