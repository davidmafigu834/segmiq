import { resolveZohoRegion, type ZohoRegion } from "./regions";

/**
 * Read scopes for the features that are turned on.
 * settings.READ covers items, taxes, and currencies.
 * contacts.READ covers customer contacts filtered with contact_type=customer.
 * invoices.READ covers invoice status, total, and unpaid balance.
 * Customer-payment scopes are not requested. Outstanding balance is the invoice
 * balance field. Draft create and update scopes live in ZOHO_BOOKS_WRITE_SCOPES.
 * Adding a scope later requires the manager to reconnect, because Zoho only
 * applies new scopes after consent.
 */
export const ZOHO_BOOKS_READ_SCOPES = [
  "ZohoBooks.settings.READ",
  "ZohoBooks.contacts.READ",
  "ZohoBooks.invoices.READ",
] as const;

/**
 * Write scopes for reviewed draft documents only.
 * contacts.CREATE is used solely by the separate "create Books customer" action.
 * estimates and invoices CREATE/UPDATE save drafts. UPDATE is limited in SegmiQ
 * to a document this company already linked, and only while Books still says draft.
 * READ on estimates is required to reconcile a lost response by reference_number.
 * DELETE, ALL, customer-payment, and email scopes are not requested.
 * Adding these scopes requires the manager to reconnect and approve again.
 */
export const ZOHO_BOOKS_WRITE_SCOPES = [
  "ZohoBooks.contacts.CREATE",
  "ZohoBooks.estimates.READ",
  "ZohoBooks.estimates.CREATE",
  "ZohoBooks.estimates.UPDATE",
  "ZohoBooks.invoices.CREATE",
  "ZohoBooks.invoices.UPDATE",
] as const;

export const ZOHO_BOOKS_SCOPES = [...ZOHO_BOOKS_READ_SCOPES, ...ZOHO_BOOKS_WRITE_SCOPES] as const;

export const ZOHO_BOOKS_INVOICE_SCOPE = "ZohoBooks.invoices.READ";

export function draftWritesGranted(scopes: readonly string[] | null | undefined): boolean {
  return ZOHO_BOOKS_WRITE_SCOPES.every((scope) => Boolean(scopes?.includes(scope)));
}

export function invoiceReadsGranted(scopes: readonly string[] | null | undefined): boolean {
  return Boolean(scopes?.includes(ZOHO_BOOKS_INVOICE_SCOPE));
}

export const ZOHO_BOOKS_SCOPE_PARAM = ZOHO_BOOKS_SCOPES.join(",");

export const ACCESS_REFRESH_SKEW_MS = 120_000;
export const OAUTH_STATE_TTL_MS = 10 * 60_000;

export function accessTokenNeedsRefresh(expiresAt: string | null | undefined, now: number): boolean {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return true;
  return expiry - now <= ACCESS_REFRESH_SKEW_MS;
}

export function buildAuthorizeUrl(input: {
  accountsServer: string;
  clientId: string;
  redirectUri: string;
  state: string;
}): string | null {
  const region = resolveZohoRegion({ accountsServer: input.accountsServer });
  if (!region || !input.clientId || !input.redirectUri || !input.state) return null;
  const url = new URL("/oauth/v2/auth", region.accounts);
  url.searchParams.set("scope", ZOHO_BOOKS_SCOPE_PARAM);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

/**
 * Zoho documents /oauth/v2/token as POST with parameters in the query string,
 * not a JSON body.
 * https://www.zoho.com/books/api/v3/oauth/
 */
export function buildTokenRequest(
  accountsServer: string,
  params: Record<string, string>
): { url: string; method: "POST" } | null {
  const region = resolveZohoRegion({ accountsServer });
  if (!region) return null;
  const url = new URL("/oauth/v2/token", region.accounts);
  for (const [key, value] of Object.entries(params)) {
    if (!value) return null;
    url.searchParams.set(key, value);
  }
  return { url: url.toString(), method: "POST" };
}

export function buildRevokeRequest(accountsServer: string, token: string): { url: string; method: "POST" } | null {
  const region = resolveZohoRegion({ accountsServer });
  if (!region || !token) return null;
  const url = new URL("/oauth/v2/token/revoke", region.accounts);
  url.searchParams.set("token", token);
  return { url: url.toString(), method: "POST" };
}

export type ZohoTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  apiDomain: string;
  expiresIn: number;
  region: ZohoRegion;
};

export function parseTokenResponse(body: unknown): ZohoTokenResponse | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const accessToken = typeof row.access_token === "string" ? row.access_token : "";
  const apiDomain = typeof row.api_domain === "string" ? row.api_domain : "";
  const expiresIn = Number(row.expires_in);
  const region = resolveZohoRegion({ apiDomain });
  if (!accessToken || !region || !Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  const refreshToken = typeof row.refresh_token === "string" && row.refresh_token ? row.refresh_token : null;
  return { accessToken, refreshToken, apiDomain: region.api, expiresIn, region };
}

export function isRevokedZohoTokenError(status: number, body: unknown): boolean {
  if (status === 401) return true;
  if (!body || typeof body !== "object") return false;
  const row = body as Record<string, unknown>;
  const error = String(row.error ?? row.message ?? "").toLowerCase();
  return (
    error.includes("invalid_code") ||
    error.includes("invalid_grant") ||
    error.includes("invalid_token") ||
    error.includes("invalid_oauthtoken") ||
    error.includes("access_denied")
  );
}

export type ZohoOrganisation = { id: string; name: string };

export function parseOrganisations(body: unknown): ZohoOrganisation[] {
  if (!body || typeof body !== "object") return [];
  const rows = (body as { organizations?: unknown }).organizations;
  if (!Array.isArray(rows)) return [];
  const parsed: ZohoOrganisation[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = String(item.organization_id ?? "").trim();
    const name = String(item.name ?? "").trim();
    if (!id || !name) continue;
    parsed.push({ id, name });
  }
  return parsed;
}

export type ZohoCustomerPreview = {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  currencyCode: string | null;
  customerSubType: string | null;
  firstName: string | null;
  lastName: string | null;
};

function readCustomer(item: Record<string, unknown>): ZohoCustomerPreview | null {
  const contactType = String(item.contact_type ?? "customer").toLowerCase();
  if (contactType !== "customer") return null;
  const id = String(item.contact_id ?? "").trim();
  const name = String(item.contact_name ?? "").trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    companyName: stringOrNull(item.company_name),
    email: stringOrNull(item.email),
    phone: stringOrNull(item.phone ?? item.mobile),
    status: stringOrNull(item.status),
    currencyCode: currencyOrNull(item.currency_code),
    customerSubType: stringOrNull(item.customer_sub_type),
    firstName: stringOrNull(item.first_name),
    lastName: stringOrNull(item.last_name),
  };
}

export function parseCustomerPreview(body: unknown, limit = 5): ZohoCustomerPreview[] {
  if (!body || typeof body !== "object") return [];
  const rows = (body as { contacts?: unknown }).contacts;
  if (!Array.isArray(rows)) return [];
  const parsed: ZohoCustomerPreview[] = [];
  for (const row of rows) {
    if (parsed.length >= limit) break;
    if (!row || typeof row !== "object") continue;
    const customer = readCustomer(row as Record<string, unknown>);
    if (customer) parsed.push(customer);
  }
  return parsed;
}

export function parseCustomerRecord(body: unknown): ZohoCustomerPreview | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const row = record.contact ?? record;
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  return readCustomer(row as Record<string, unknown>);
}

export type ZohoItemPreview = {
  id: string;
  name: string;
  sku: string | null;
  rate: string | null;
  unit: string | null;
  status: string | null;
  currencyCode: string | null;
  taxPercentage: string | null;
  taxName: string | null;
  description: string | null;
  productType: string | null;
  purchaseRate: string | null;
  stockOnHand: string | null;
  locationAvailableStock: string | null;
  locationActualAvailableStock: string | null;
  isTaxInclusive: boolean | null;
};

function readItem(item: Record<string, unknown>): ZohoItemPreview | null {
  const id = String(item.item_id ?? "").trim();
  const name = String(item.name ?? "").trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    sku: stringOrNull(item.sku),
    rate: decimalOrNull(item.rate),
    unit: stringOrNull(item.unit),
    status: stringOrNull(item.status),
    currencyCode: currencyOrNull(item.currency_code),
    taxPercentage: decimalOrNull(item.tax_percentage),
    taxName: stringOrNull(item.tax_name),
    description: stringOrNull(item.description),
    productType: stringOrNull(item.product_type),
    purchaseRate: decimalOrNull(item.purchase_rate),
    stockOnHand: decimalOrNull(item.stock_on_hand),
    locationAvailableStock: decimalOrNull(item.location_available_stock),
    locationActualAvailableStock: decimalOrNull(item.location_actual_available_stock),
    isTaxInclusive: typeof item.is_inclusive_tax === "boolean" ? item.is_inclusive_tax : null,
  };
}

export function parseItemPreview(body: unknown, limit = 5): ZohoItemPreview[] {
  if (!body || typeof body !== "object") return [];
  const rows = (body as { items?: unknown }).items;
  if (!Array.isArray(rows)) return [];
  const parsed: ZohoItemPreview[] = [];
  for (const row of rows) {
    if (parsed.length >= limit) break;
    if (!row || typeof row !== "object") continue;
    const item = readItem(row as Record<string, unknown>);
    if (item) parsed.push(item);
  }
  return parsed;
}

export function parseItemRecord(body: unknown): ZohoItemPreview | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const row = record.item ?? record;
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  return readItem(row as Record<string, unknown>);
}

export type ZohoInvoiceRow = {
  externalInvoiceId: string;
  externalCustomerId: string;
  invoiceNumber: string | null;
  status: string | null;
  currencyCode: string | null;
  total: string | null;
  balance: string | null;
  creditsApplied: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
};

export function parseInvoicePage(body: unknown): ZohoInvoiceRow[] {
  if (!body || typeof body !== "object") return [];
  const rows = (body as { invoices?: unknown }).invoices;
  if (!Array.isArray(rows)) return [];
  const parsed: ZohoInvoiceRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const externalInvoiceId = String(item.invoice_id ?? "").trim();
    const externalCustomerId = String(item.customer_id ?? "").trim();
    if (!externalInvoiceId || !externalCustomerId) continue;
    parsed.push({
      externalInvoiceId,
      externalCustomerId,
      invoiceNumber: stringOrNull(item.invoice_number),
      status: stringOrNull(item.status),
      currencyCode: currencyOrNull(item.currency_code),
      total: decimalOrNull(item.total),
      balance: decimalOrNull(item.balance),
      creditsApplied: decimalOrNull(item.credits_applied),
      invoiceDate: dateOrNull(item.date),
      dueDate: dateOrNull(item.due_date),
    });
  }
  return parsed;
}

export function parseHasMore(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const context = (body as { page_context?: { has_more_page?: unknown } }).page_context;
  return context?.has_more_page === true;
}

export function parseOrganisationCurrency(body: unknown, organizationId: string): string | null {
  if (!body || typeof body !== "object") return null;
  const rows = (body as { organizations?: unknown }).organizations;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (String(item.organization_id ?? "").trim() !== organizationId) continue;
    return currencyOrNull(item.currency_code);
  }
  return null;
}

export function parseOrganisationPlan(body: unknown, organizationId: string): string | null {
  if (!body || typeof body !== "object") return null;
  const rows = (body as { organizations?: unknown }).organizations;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (String(item.organization_id ?? "").trim() !== organizationId) continue;
    const plan = stringOrNull(item.plan_name) ?? stringOrNull(item.plan_type);
    return plan;
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function currencyOrNull(value: unknown): string | null {
  const code = stringOrNull(value)?.toUpperCase() ?? null;
  return code && /^[A-Z]{3}$/.test(code) ? code : null;
}

function decimalOrNull(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : null;
}

function dateOrNull(value: unknown): string | null {
  const date = stringOrNull(value);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

const SECRET_KEYS = new Set([
  "access_token",
  "refresh_token",
  "client_secret",
  "token",
  "authorization",
  "access_token_sealed",
  "refresh_token_sealed",
  "token_sealed",
]);

export function omitSecrets<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SECRET_KEYS.has(key)) continue;
    copy[key] = value;
  }
  return copy;
}

export type OAuthStateRecord = {
  userId: string;
  clientId: string;
  sessionId: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type OAuthStateDecision =
  | { ok: true }
  | { ok: false; reason: "missing" | "expired" | "replay" | "wrong_user" | "wrong_company" | "wrong_session" };

export function evaluateOAuthState(input: {
  record: OAuthStateRecord | null;
  now: number;
  session: { userId: string; clientId: string; sessionId: string };
}): OAuthStateDecision {
  const record = input.record;
  if (!record) return { ok: false, reason: "missing" };
  if (record.consumedAt) return { ok: false, reason: "replay" };
  if (new Date(record.expiresAt).getTime() <= input.now) return { ok: false, reason: "expired" };
  if (record.userId !== input.session.userId) return { ok: false, reason: "wrong_user" };
  if (record.clientId !== input.session.clientId) return { ok: false, reason: "wrong_company" };
  if (record.sessionId !== input.session.sessionId) return { ok: false, reason: "wrong_session" };
  return { ok: true };
}

export function booksUrl(apiDomain: string, path: string, query: Record<string, string>): string | null {
  const region = resolveZohoRegion({ apiDomain });
  if (!region) return null;
  const url = new URL(path.startsWith("/") ? path : `/${path}`, region.api);
  if (!url.pathname.startsWith("/books/v3/")) return null;
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

const BOOKS_WRITE_RULES: ReadonlyArray<{ method: "POST" | "PUT"; pattern: RegExp }> = [
  { method: "POST", pattern: /^\/books\/v3\/estimates$/ },
  { method: "PUT", pattern: /^\/books\/v3\/estimates\/[0-9]+$/ },
  { method: "POST", pattern: /^\/books\/v3\/invoices$/ },
  { method: "PUT", pattern: /^\/books\/v3\/invoices\/[0-9]+$/ },
  { method: "POST", pattern: /^\/books\/v3\/contacts$/ },
];

/**
 * Allow only the reviewed create/update calls. Email, status, approve, void,
 * and payment paths are rejected even if a caller builds them by hand.
 * Estimates and invoices always include send=false. Number generation stays
 * with Books, so ignore_auto_number_generation is rejected.
 */
export function booksWriteUrl(
  apiDomain: string,
  method: "POST" | "PUT",
  path: string,
  query: Record<string, string>
): string | null {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!BOOKS_WRITE_RULES.some((rule) => rule.method === method && rule.pattern.test(normalized))) return null;
  if (/email|status|approve|void|payment|creditnote/i.test(normalized)) return null;
  const next = { ...query };
  if ("ignore_auto_number_generation" in next) return null;
  const document = /\/estimates|\/invoices/.test(normalized);
  if (document) {
    if (next.send && next.send !== "false") return null;
    next.send = "false";
  }
  return booksUrl(apiDomain, normalized, next);
}
