import { createRequire } from "node:module";
import path from "node:path";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { ONBOARDING_COUNTRIES } from "@/lib/onboarding/constants";

type PhoneParser = (input: string, country?: CountryCode) => { isValid: () => boolean; format: (style: "E.164") => string } | undefined;

let commonJsParser: PhoneParser | null = null;

function parsePhone(input: string, country?: CountryCode) {
  try {
    const parsed = country ? parsePhoneNumberFromString(input, country) : parsePhoneNumberFromString(input);
    if (parsed?.isValid()) return parsed.format("E.164");
    return null;
  } catch {
    try {
      if (!commonJsParser) {
        const require = createRequire(path.join(process.cwd(), "package.json"));
        commonJsParser = require("libphonenumber-js").parsePhoneNumberFromString as PhoneParser;
      }
      const parsed = country ? commonJsParser(input, country) : commonJsParser(input);
      if (parsed?.isValid()) return parsed.format("E.164");
    } catch {
      return undefined;
    }
    return null;
  }
}

function fallbackE164(input: string, country?: CountryCode): string | null {
  const digits = input.replace(/\D/g, "").replace(/^00/, "");
  if (input.startsWith("+") || input.startsWith("00")) {
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (!country) return null;
  const dial = Object.entries(DIAL_TO_ISO).find(([, iso]) => iso === country)?.[0];
  if (!dial) return null;
  const national = digits.startsWith("0") ? digits.slice(1) : digits;
  const full = national.startsWith(dial) ? national : `${dial}${national}`;
  return /^[1-9]\d{7,14}$/.test(full) ? `+${full}` : null;
}

export const PREVIEW_PAGE_SIZE = 5;
export const CATALOG_PAGE_SIZE = 25;
export const MAX_PREVIEW_PAGE = 20;
export const IMPORT_BATCH_LIMIT = 5;
export const INVOICE_PAGE_SIZE = 20;
export const INVOICE_MAX_PAGES = 5;

const DIAL_TO_ISO: Record<string, CountryCode> = Object.fromEntries(
  ONBOARDING_COUNTRIES.map((country) => [country.dialCode, country.code as CountryCode])
);

export type FieldChange = { field: string; from: string | null; to: string | null };

export type BooksCustomer = {
  zohoId: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phoneRaw: string | null;
  currencyCode: string | null;
  status: string | null;
  customerSubType: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type LocalContact = {
  id: string;
  clientId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  customerType: string | null;
  primaryContactName: string | null;
  notes: string | null;
  lifecycle: string | null;
  relationshipOwnerId: string | null;
};

export type BooksItem = {
  zohoId: string;
  name: string;
  sku: string | null;
  rate: string | null;
  currencyCode: string | null;
  taxPercentage: string | null;
  taxName: string | null;
  unit: string | null;
  status: string | null;
  description: string | null;
  productType: string | null;
  purchaseRate: string | null;
  stockOnHand: string | null;
  locationAvailableStock: string | null;
  locationActualAvailableStock: string | null;
  isTaxInclusive: boolean | null;
};

export type LocalProduct = {
  id: string;
  clientId: string;
  name: string;
  sku: string | null;
  sellingPrice: string | null;
  currency: string | null;
  taxRate: string | null;
  unit: string | null;
  status: string | null;
  description: string | null;
  costPrice: string | null;
  quotationDescription: string | null;
};

export type MatchCandidate = {
  id: string;
  name: string;
  match: "phone" | "email" | "sku";
  alreadyLinked: boolean;
};

export type CustomerPlan = {
  zohoId: string;
  name: string;
  email: string | null;
  phone: string | null;
  phoneNormalized: boolean;
  currencyCode: string | null;
  action: "create" | "update" | "conflict" | "blocked";
  changes: FieldChange[];
  preserved: string[];
  candidates: MatchCandidate[];
  blockedReason: string | null;
  segmiqId: string | null;
};

export type ItemPlan = {
  zohoId: string;
  name: string;
  sku: string | null;
  price: string | null;
  currencyCode: string | null;
  currencySource: "record" | "organisation" | "missing";
  taxPercent: string | null;
  taxName: string | null;
  unit: string | null;
  booksStatus: string | null;
  stockNote: string | null;
  priceNote: string;
  action: "create" | "update" | "conflict" | "blocked";
  changes: FieldChange[];
  preserved: string[];
  candidates: MatchCandidate[];
  blockedReason: string | null;
  segmiqId: string | null;
};

export type ImportDecision = {
  zohoId: string;
  decision: "create" | "update" | "link" | "skip";
  linkToId?: string;
};

const CUSTOMER_PRESERVED = [
  "notes",
  "tags",
  "relationship owner",
  "lifecycle after the first link",
  "leads, deals, follow-ups, and packages",
];

const ITEM_PRESERVED = [
  "quotation description",
  "cost price",
  "minimum selling price",
  "warranty",
  "inventory tracking, reservations, and issues",
  "packages",
  "archived status",
];

export function clampPreviewPage(value: string | null | undefined): number {
  const page = Number(value ?? "1");
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, MAX_PREVIEW_PAGE);
}

export function customerListQuery(organizationId: string, page: number): Record<string, string> {
  return {
    organization_id: organizationId,
    contact_type: "customer",
    page: String(clampPreviewPage(String(page))),
    per_page: String(PREVIEW_PAGE_SIZE),
  };
}

export function itemCatalogQuery(organizationId: string, page: number): Record<string, string> {
  const safePage = Number.isInteger(page) && page > 0 ? Math.min(page, 400) : 1;
  return {
    organization_id: organizationId,
    filter_by: "Status.All",
    page: String(safePage),
    per_page: String(CATALOG_PAGE_SIZE),
  };
}

export function catalogItemDisposition(action: "create" | "update" | "conflict" | "blocked"): "apply" | "hold" | "skip" {
  if (action === "conflict") return "hold";
  if (action === "blocked") return "skip";
  return "apply";
}

export function itemListQuery(organizationId: string, page: number): Record<string, string> {
  return {
    organization_id: organizationId,
    filter_by: "Status.All",
    page: String(clampPreviewPage(String(page))),
    per_page: String(PREVIEW_PAGE_SIZE),
  };
}

export function invoiceListQuery(organizationId: string, customerId: string, page: number): Record<string, string> {
  return {
    organization_id: organizationId,
    customer_id: customerId,
    page: String(page),
    per_page: String(INVOICE_PAGE_SIZE),
  };
}

export function parseDecisions(value: unknown): ImportDecision[] | null {
  if (!Array.isArray(value) || value.length > IMPORT_BATCH_LIMIT) return null;
  const decisions: ImportDecision[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const record = row as Record<string, unknown>;
    const zohoId = String(record.zohoId ?? "").trim();
    const decision = record.decision;
    if (!/^\d{1,40}$/.test(zohoId)) return null;
    if (decision !== "create" && decision !== "update" && decision !== "link" && decision !== "skip") return null;
    const linkToId = typeof record.linkToId === "string" && record.linkToId.trim() ? record.linkToId.trim() : undefined;
    decisions.push({ zohoId, decision, linkToId });
  }
  if (new Set(decisions.map((row) => row.zohoId)).size !== decisions.length) return null;
  return decisions;
}

export function parseZohoIdList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > IMPORT_BATCH_LIMIT) return null;
  const ids = value.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (ids.length !== value.length) return null;
  if (new Set(ids).size !== ids.length) return null;
  if (ids.some((id) => !/^\d{1,40}$/.test(id))) return null;
  return ids;
}

export function sameTenant(actorClientId: string, resourceClientId: string): boolean {
  return Boolean(actorClientId) && actorClientId === resourceClientId;
}

export function normalizeZohoPhone(
  raw: string | null | undefined,
  dialCode: string | null | undefined
): { phone: string | null; normalized: boolean } {
  if (!raw?.trim()) return { phone: null, normalized: false };
  const input = raw.trim();
  const international = input.startsWith("+") || input.startsWith("00");
  const digits = (dialCode ?? "").replace(/\D/g, "");
  const country = !international && digits ? DIAL_TO_ISO[digits] : undefined;
  if (!international && !country) return { phone: input, normalized: false };
  const parsed = international ? parsePhone(input.startsWith("00") ? `+${input.replace(/\D/g, "").replace(/^00/, "")}` : input) : parsePhone(input, country);
  if (typeof parsed === "string") return { phone: parsed, normalized: true };
  if (parsed === null) return { phone: input, normalized: false };
  const fallback = fallbackE164(input, country);
  return fallback ? { phone: fallback, normalized: true } : { phone: input, normalized: false };
}

export function customerWriteFromBooks(books: BooksCustomer, dialCode: string | null): {
  name: string;
  email: string | null;
  phone: string | null;
  phoneNormalized: boolean;
  customerType: "company" | "individual" | null;
  primaryContactName: string | null;
  currencyCode: string | null;
} {
  const subtype = (books.customerSubType ?? "").toLowerCase();
  const customerType = subtype === "business" ? "company" : subtype === "individual" ? "individual" : null;
  const person = [books.firstName, books.lastName].filter(Boolean).join(" ").trim();
  let name = books.name;
  let primaryContactName: string | null = null;
  if (customerType === "company" && books.companyName && books.companyName !== books.name) {
    name = books.companyName;
    primaryContactName = books.name;
  } else if (person && person !== books.name) {
    primaryContactName = person;
  }
  const phone = normalizeZohoPhone(books.phoneRaw, dialCode);
  return {
    name,
    email: books.email?.trim() || null,
    phone: phone.phone,
    phoneNormalized: phone.normalized,
    customerType,
    primaryContactName,
    currencyCode: books.currencyCode,
  };
}

function changed(field: string, from: string | null | undefined, to: string | null | undefined, changes: FieldChange[]) {
  const before = from?.trim() || null;
  const after = to?.trim() || null;
  if (before === after) return;
  changes.push({ field, from: before, to: after });
}

export function customerCandidates(input: {
  actorClientId: string;
  phone: string | null;
  phoneNormalized: boolean;
  email: string | null;
  contacts: LocalContact[];
  linkedExternalBySegmiqId: Map<string, string>;
  currentZohoId: string;
}): MatchCandidate[] {
  const email = input.email?.trim().toLowerCase() || null;
  const found: MatchCandidate[] = [];
  for (const contact of input.contacts) {
    if (!sameTenant(input.actorClientId, contact.clientId)) continue;
    const linkedTo = input.linkedExternalBySegmiqId.get(contact.id);
    if (linkedTo === input.currentZohoId) continue;
    const emailMatch = Boolean(email && contact.email?.trim().toLowerCase() === email);
    const phoneMatch = Boolean(input.phoneNormalized && input.phone && contact.phone === input.phone);
    if (!emailMatch && !phoneMatch) continue;
    found.push({
      id: contact.id,
      name: contact.name || "Unnamed contact",
      match: phoneMatch ? "phone" : "email",
      alreadyLinked: Boolean(linkedTo),
    });
  }
  return found.slice(0, 5);
}

export function planCustomer(input: {
  actorClientId: string;
  books: BooksCustomer;
  dialCode: string | null;
  link: { segmiqId: string; clientId: string } | null;
  contact: LocalContact | null;
  contacts: LocalContact[];
  linkedExternalBySegmiqId: Map<string, string>;
  previousCurrency: string | null;
}): CustomerPlan {
  const write = customerWriteFromBooks(input.books, input.dialCode);
  const base = {
    zohoId: input.books.zohoId,
    name: write.name,
    email: write.email,
    phone: write.phone,
    phoneNormalized: write.phoneNormalized,
    currencyCode: write.currencyCode,
    preserved: CUSTOMER_PRESERVED,
    segmiqId: null as string | null,
  };
  if (input.link && !sameTenant(input.actorClientId, input.link.clientId)) {
    return { ...base, action: "blocked", changes: [], candidates: [], blockedReason: "That Books record is linked to another company." };
  }
  if (input.link) {
    if (input.contact && !sameTenant(input.actorClientId, input.contact.clientId)) {
      return { ...base, action: "blocked", changes: [], candidates: [], blockedReason: "The linked contact belongs to another company." };
    }
    const changes: FieldChange[] = [];
    changed("Name", input.contact?.name, write.name, changes);
    changed("Email", input.contact?.email, write.email, changes);
    changed("Phone", input.contact?.phone, write.phone, changes);
    changed("Customer type", input.contact?.customerType, write.customerType, changes);
    changed("Primary contact", input.contact?.primaryContactName, write.primaryContactName, changes);
    changed("Books currency", input.previousCurrency, write.currencyCode, changes);
    return {
      ...base,
      action: "update",
      changes,
      candidates: [],
      blockedReason: null,
      segmiqId: input.link.segmiqId,
    };
  }
  const candidates = customerCandidates({
    actorClientId: input.actorClientId,
    phone: write.phone,
    phoneNormalized: write.phoneNormalized,
    email: write.email,
    contacts: input.contacts,
    linkedExternalBySegmiqId: input.linkedExternalBySegmiqId,
    currentZohoId: input.books.zohoId,
  });
  if (candidates.length > 0) {
    return { ...base, action: "conflict", changes: [], candidates, blockedReason: null };
  }
  const changes: FieldChange[] = [];
  changed("Name", null, write.name, changes);
  changed("Email", null, write.email, changes);
  changed("Phone", null, write.phone, changes);
  changed("Customer type", null, write.customerType, changes);
  changed("Primary contact", null, write.primaryContactName, changes);
  changed("Books currency", null, write.currencyCode, changes);
  changed("Lifecycle", null, "customer", changes);
  return { ...base, action: "create", changes, candidates: [], blockedReason: null };
}

export function resolveItemCurrency(
  itemCurrency: string | null,
  organisationCurrency: string | null
): { code: string | null; source: "record" | "organisation" | "missing" } {
  if (itemCurrency && /^[A-Z]{3}$/.test(itemCurrency)) return { code: itemCurrency, source: "record" };
  if (organisationCurrency && /^[A-Z]{3}$/.test(organisationCurrency)) {
    return { code: organisationCurrency, source: "organisation" };
  }
  return { code: null, source: "missing" };
}

export function booksItemStatus(status: string | null): "ACTIVE" | "INACTIVE" | null {
  const value = status?.trim().toLowerCase();
  if (value === "active") return "ACTIVE";
  if (value === "inactive") return "INACTIVE";
  return null;
}

export function booksItemType(productType: string | null): "PRODUCT" | "SERVICE" {
  const value = productType?.trim().toLowerCase() ?? "";
  if (value.includes("service")) return "SERVICE";
  return "PRODUCT";
}

export function booksStockNote(
  item: Pick<BooksItem, "stockOnHand" | "locationAvailableStock" | "locationActualAvailableStock">,
  fetchedAt: string
): string | null {
  const lines: string[] = [];
  if (item.stockOnHand != null) {
    lines.push(
      `Books stock_on_hand: ${item.stockOnHand}. Zoho describes this as current stock for a location. SegmiQ does not treat it as available stock.`
    );
  }
  if (item.locationAvailableStock != null) {
    lines.push(`Books location_available_stock: ${item.locationAvailableStock}.`);
  }
  if (item.locationActualAvailableStock != null) {
    lines.push(`Books location_actual_available_stock: ${item.locationActualAvailableStock}.`);
  }
  if (lines.length === 0) return null;
  return `${lines.join(" ")} Fetched ${fetchedAt}. Reservations and issues in SegmiQ are unchanged.`;
}

export function itemPriceNote(isTaxInclusive: boolean | null): string {
  const tax =
    isTaxInclusive == null
      ? "Books did not say whether this rate includes tax. The rate is stored as sent."
      : `Books is_inclusive_tax is ${isTaxInclusive ? "true" : "false"}. The rate was not recalculated.`;
  return `Books rate is the selling price. Tax percent is stored only when Books sends tax_percentage. ${tax}`;
}

export function itemCandidates(input: {
  actorClientId: string;
  sku: string | null;
  products: LocalProduct[];
  linkedExternalBySegmiqId: Map<string, string>;
  currentZohoId: string;
}): MatchCandidate[] {
  const sku = input.sku?.trim().toLowerCase() || null;
  if (!sku) return [];
  const found: MatchCandidate[] = [];
  for (const product of input.products) {
    if (!sameTenant(input.actorClientId, product.clientId)) continue;
    if ((product.sku ?? "").trim().toLowerCase() !== sku) continue;
    const linkedTo = input.linkedExternalBySegmiqId.get(product.id);
    if (linkedTo === input.currentZohoId) continue;
    found.push({
      id: product.id,
      name: product.name,
      match: "sku",
      alreadyLinked: Boolean(linkedTo),
    });
  }
  return found.slice(0, 5);
}

export function planItem(input: {
  actorClientId: string;
  books: BooksItem;
  organisationCurrency: string | null;
  link: { segmiqId: string; clientId: string } | null;
  product: LocalProduct | null;
  products: LocalProduct[];
  linkedExternalBySegmiqId: Map<string, string>;
  fetchedAt: string;
}): ItemPlan {
  const currency = resolveItemCurrency(input.books.currencyCode, input.organisationCurrency);
  const status = booksItemStatus(input.books.status);
  const stockNote = booksStockNote(input.books, input.fetchedAt);
  const base = {
    zohoId: input.books.zohoId,
    name: input.books.name,
    sku: input.books.sku,
    price: input.books.rate,
    currencyCode: currency.code,
    currencySource: currency.source,
    taxPercent: input.books.taxPercentage,
    taxName: input.books.taxName,
    unit: input.books.unit,
    booksStatus: input.books.status,
    stockNote,
    priceNote: itemPriceNote(input.books.isTaxInclusive),
    preserved: ITEM_PRESERVED,
    segmiqId: null as string | null,
  };
  if (!input.books.rate) {
    return { ...base, action: "blocked", changes: [], candidates: [], blockedReason: "Books did not send a price for this item." };
  }
  if (!currency.code) {
    return {
      ...base,
      action: "blocked",
      changes: [],
      candidates: [],
      blockedReason: "Books did not send a currency for this item or its organisation.",
    };
  }
  if (input.link && !sameTenant(input.actorClientId, input.link.clientId)) {
    return { ...base, action: "blocked", changes: [], candidates: [], blockedReason: "That Books item is linked to another company." };
  }
  const currencyLabel = currency.source === "organisation" ? "Currency (Books organisation)" : "Currency";
  if (input.link) {
    if (input.product && !sameTenant(input.actorClientId, input.product.clientId)) {
      return { ...base, action: "blocked", changes: [], candidates: [], blockedReason: "The linked product belongs to another company." };
    }
    const changes: FieldChange[] = [];
    changed("Name", input.product?.name, input.books.name, changes);
    changed("SKU", input.product?.sku, input.books.sku, changes);
    changed("Selling price", input.product?.sellingPrice, input.books.rate, changes);
    changed(currencyLabel, input.product?.currency, currency.code, changes);
    if (input.books.taxPercentage != null) changed("Tax percent", input.product?.taxRate, input.books.taxPercentage, changes);
    if (input.books.unit) changed("Unit", input.product?.unit, input.books.unit, changes);
    if (input.books.description) changed("Description", input.product?.description, input.books.description, changes);
    if (status && input.product?.status !== "ARCHIVED") changed("Status", input.product?.status, status, changes);
    if (input.product?.status === "ARCHIVED") {
      changes.push({ field: "Status", from: "ARCHIVED", to: "ARCHIVED (kept)" });
    }
    if (input.books.purchaseRate && input.product?.costPrice && input.books.purchaseRate !== input.product.costPrice) {
      changes.push({
        field: "Books purchase rate",
        from: input.product.costPrice,
        to: `${input.books.purchaseRate} (SegmiQ cost price stays ${input.product.costPrice})`,
      });
    }
    return { ...base, action: "update", changes, candidates: [], blockedReason: null, segmiqId: input.link.segmiqId };
  }
  const candidates = itemCandidates({
    actorClientId: input.actorClientId,
    sku: input.books.sku,
    products: input.products,
    linkedExternalBySegmiqId: input.linkedExternalBySegmiqId,
    currentZohoId: input.books.zohoId,
  });
  if (candidates.length > 0) {
    return { ...base, action: "conflict", changes: [], candidates, blockedReason: null };
  }
  const changes: FieldChange[] = [];
  changed("Name", null, input.books.name, changes);
  changed("SKU", null, input.books.sku, changes);
  changed("Selling price", null, input.books.rate, changes);
  changed(currencyLabel, null, currency.code, changes);
  changed("Tax percent", null, input.books.taxPercentage, changes);
  changed("Unit", null, input.books.unit ?? "Each (Books did not send a unit)", changes);
  changed("Status", null, status ?? "ACTIVE", changes);
  return { ...base, action: "create", changes, candidates: [], blockedReason: null };
}

export function resolvePlanAction(
  plan: { action: CustomerPlan["action"]; segmiqId: string | null; candidates: MatchCandidate[] },
  decision: ImportDecision | undefined
): { ok: true; mode: "create" | "update" | "link" | "skip"; segmiqId: string | null } | { ok: false; reason: string } {
  if (!decision) return { ok: false, reason: "Choose what to do with this record before importing it." };
  if (decision.decision === "skip") return { ok: true, mode: "skip", segmiqId: null };
  if (plan.action === "blocked") return { ok: false, reason: "This record cannot be imported until the missing Books field is available." };
  if (plan.action === "update") {
    if (decision.decision !== "update") return { ok: false, reason: "This Books record is already linked. Update it or skip it." };
    return { ok: true, mode: "update", segmiqId: plan.segmiqId };
  }
  if (plan.action === "conflict") {
    if (decision.decision !== "link" || !decision.linkToId) {
      return { ok: false, reason: "A possible existing record needs an explicit link or skip." };
    }
    const candidate = plan.candidates.find((row) => row.id === decision.linkToId);
    if (!candidate) return { ok: false, reason: "The selected record is not one of the matches." };
    if (candidate.alreadyLinked) return { ok: false, reason: "That SegmiQ record is already linked to a different Books record." };
    return { ok: true, mode: "link", segmiqId: candidate.id };
  }
  if (decision.decision !== "create") return { ok: false, reason: "Confirm create or skip for this new record." };
  return { ok: true, mode: "create", segmiqId: null };
}

export type CustomerMaterial = {
  mode: "create" | "update" | "link";
  segmiqId: string;
  patch: {
    name: string;
    email: string | null;
    phone: string | null;
    customer_type: "company" | "individual" | null;
    primary_contact_name: string | null;
  };
  setLifecycleCustomer: boolean;
  snapshot: { currencyCode: string | null; phoneNormalized: boolean };
};

export function materializeCustomer(input: {
  books: BooksCustomer;
  dialCode: string | null;
  mode: "create" | "update" | "link";
  existingSegmiqId: string | null;
  reservedId: string;
  currentLifecycle: string | null;
}): CustomerMaterial {
  const write = customerWriteFromBooks(input.books, input.dialCode);
  const segmiqId = input.mode === "create" ? input.reservedId : input.existingSegmiqId || input.reservedId;
  return {
    mode: input.mode,
    segmiqId,
    patch: {
      name: write.name,
      email: write.email,
      phone: write.phone,
      customer_type: write.customerType,
      primary_contact_name: write.primaryContactName,
    },
    setLifecycleCustomer: input.mode !== "update" && input.currentLifecycle !== "customer",
    snapshot: { currencyCode: write.currencyCode, phoneNormalized: write.phoneNormalized },
  };
}

export type ItemMaterial = {
  mode: "create" | "update" | "link";
  segmiqId: string;
  patch: {
    name: string;
    sku: string | null;
    selling_price: number;
    currency: string;
    tax_rate: number | null;
    unit?: string;
    status?: "ACTIVE" | "INACTIVE";
    description?: string;
    item_type: "PRODUCT" | "SERVICE";
  };
  applyTax: boolean;
  snapshot: Record<string, string | number | boolean | null>;
};

export function materializeItem(input: {
  books: BooksItem;
  organisationCurrency: string | null;
  mode: "create" | "update" | "link";
  existingSegmiqId: string | null;
  reservedId: string;
  localStatus: string | null;
  fetchedAt: string;
}): ItemMaterial | { error: string } {
  const currency = resolveItemCurrency(input.books.currencyCode, input.organisationCurrency);
  if (!input.books.rate || !currency.code) return { error: "Books price or currency is missing." };
  const price = Number(input.books.rate);
  if (!Number.isFinite(price)) return { error: "Books price is not a number." };
  const status = booksItemStatus(input.books.status);
  const keepArchived = input.localStatus === "ARCHIVED";
  const segmiqId = input.mode === "create" ? input.reservedId : input.existingSegmiqId || input.reservedId;
  const patch: ItemMaterial["patch"] = {
    name: input.books.name,
    sku: input.books.sku,
    selling_price: price,
    currency: currency.code,
    tax_rate: input.books.taxPercentage == null ? null : Number(input.books.taxPercentage),
    item_type: booksItemType(input.books.productType),
  };
  if (input.books.unit) patch.unit = input.books.unit;
  else if (input.mode === "create") patch.unit = "Each";
  if (status && !keepArchived) patch.status = status;
  else if (input.mode === "create" && !status) patch.status = "ACTIVE";
  if (input.books.description) patch.description = input.books.description;
  return {
    mode: input.mode,
    segmiqId,
    patch,
    applyTax: input.books.taxPercentage != null,
    snapshot: {
      currencySource: currency.source,
      taxName: input.books.taxName,
      isTaxInclusive: input.books.isTaxInclusive,
      purchaseRate: input.books.purchaseRate,
      stockOnHand: input.books.stockOnHand,
      locationAvailableStock: input.books.locationAvailableStock,
      locationActualAvailableStock: input.books.locationActualAvailableStock,
      stockNote: booksStockNote(input.books, input.fetchedAt),
      fetchedAt: input.fetchedAt,
    },
  };
}

export type InvoiceCursor = { customerIndex: number; page: number };

export function advanceInvoiceCursor(
  cursor: InvoiceCursor,
  hasMore: boolean,
  customerCount: number
): InvoiceCursor | "done" {
  if (cursor.customerIndex >= customerCount) return "done";
  if (hasMore && cursor.page < INVOICE_MAX_PAGES) {
    return { customerIndex: cursor.customerIndex, page: cursor.page + 1 };
  }
  const nextIndex = cursor.customerIndex + 1;
  if (nextIndex >= customerCount) return "done";
  return { customerIndex: nextIndex, page: 1 };
}

export function presentBooksInvoice(row: {
  status: string | null;
  total: string | null;
  balance: string | null;
  creditsApplied: string | null;
  currencyCode: string | null;
}): {
  status: string | null;
  total: string | null;
  outstanding: string | null;
  creditsApplied: string | null;
  currencyCode: string | null;
  partialPayment: boolean;
  voided: boolean;
  recordsCash: false;
  marksDealsWon: false;
} {
  return {
    status: row.status,
    total: row.total,
    outstanding: row.balance,
    creditsApplied: row.creditsApplied,
    currencyCode: row.currencyCode,
    partialPayment: row.status === "partially_paid",
    voided: row.status === "void",
    recordsCash: false,
    marksDealsWon: false,
  };
}

export function quotaBackoff(
  attempt: number,
  retryAfterSeconds: number | null
): { stop: false; retryMs: number } | { stop: true } {
  if (attempt >= 1) return { stop: true };
  const headerMs = retryAfterSeconds != null && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 1000;
  return { stop: false, retryMs: Math.min(headerMs, 2000) };
}

export function booksSyncAttention(status: string, lastError: string | null): string | null {
  if (status === "reconnect_required" || (lastError && /reconnect/i.test(lastError))) {
    return "Reconnect required. Customer and item links stay stored.";
  }
  if (lastError && /limit was reached|rate limit|too many requests/i.test(lastError)) {
    return "Books paused this sync because the organisation hit a request limit. Wait, then use Sync now. Nothing retries it on a schedule.";
  }
  return lastError;
}

export function classifyZohoFailure(status: number, zohoCode: number | null): "revoked" | "quota" | "other" {
  if (zohoCode === 44 || zohoCode === 45 || zohoCode === 1070 || status === 429) return "quota";
  if (status === 401 || status === 403) return "revoked";
  return "other";
}

export async function commitAfterWrite<T>(input: {
  pending: T[];
  completedKeys: string[];
  keyOf: (item: T) => string;
  write: (item: T) => Promise<void>;
  save: (completedKeys: string[]) => Promise<void>;
}): Promise<{ completedKeys: string[]; pausedOn: string | null; error: string | null }> {
  const completed = [...input.completedKeys];
  const done = new Set(completed);
  for (const item of input.pending) {
    const key = input.keyOf(item);
    if (done.has(key)) continue;
    try {
      await input.write(item);
      completed.push(key);
      done.add(key);
      await input.save(completed);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Import stopped before the next record was saved.";
      return { completedKeys: completed, pausedOn: key, error: message };
    }
  }
  return { completedKeys: completed, pausedOn: null, error: null };
}
