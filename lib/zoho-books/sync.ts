import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ZohoBooksRequestError } from "./http";
import {
  advanceInvoiceCursor,
  commitAfterWrite,
  customerWriteFromBooks,
  IMPORT_BATCH_LIMIT,
  INVOICE_MAX_PAGES,
  invoiceListQuery,
  materializeCustomer,
  materializeItem,
  planCustomer,
  planItem,
  resolvePlanAction,
  sameTenant,
  type BooksCustomer,
  type BooksItem,
  type CustomerPlan,
  type ImportDecision,
  type ItemPlan,
  type LocalContact,
  type LocalProduct,
} from "./import-plan";
import {
  invoiceReadsGranted,
  parseCustomerRecord,
  parseHasMore,
  parseInvoicePage,
  parseItemRecord,
  parseOrganisationCurrency,
  type ZohoCustomerPreview,
  type ZohoItemPreview,
} from "./protocol";
import { recordZohoEvent, zohoBooksRead } from "./store";

const STALE_RUN_MS = 15 * 60 * 1000;

export class ImportDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportDecisionError";
  }
}

type Connected = {
  id: string;
  clientId: string;
  organizationId: string;
  scopes: string[];
};

type Checkpoint = {
  completedCustomerIds: string[];
  completedItemIds: string[];
  reservedIds: Record<string, string>;
  invoiceCustomerIndex: number;
  invoicePage: number;
  invoiceTruncated: boolean;
  unavailableCustomerIds: string[];
};

type RunRow = {
  id: string;
  client_id: string;
  connection_id: string;
  zoho_organization_id: string;
  kind: "import" | "refresh";
  status: "running" | "needs_decision" | "completed" | "paused" | "failed";
  checkpoint: Partial<Checkpoint> | null;
  counts: Record<string, number> | null;
  last_error: string | null;
  updated_at: string;
};

export type PublicRun = {
  id: string;
  kind: "import" | "refresh";
  status: RunRow["status"];
  counts: Record<string, number>;
  lastError: string | null;
  invoiceReconnect: boolean;
};

function emptyCheckpoint(): Checkpoint {
  return {
    completedCustomerIds: [],
    completedItemIds: [],
    reservedIds: {},
    invoiceCustomerIndex: 0,
    invoicePage: 1,
    invoiceTruncated: false,
    unavailableCustomerIds: [],
  };
}

function readCheckpoint(value: Partial<Checkpoint> | null): Checkpoint {
  const base = emptyCheckpoint();
  if (!value || typeof value !== "object") return base;
  return {
    completedCustomerIds: Array.isArray(value.completedCustomerIds) ? value.completedCustomerIds.map(String) : [],
    completedItemIds: Array.isArray(value.completedItemIds) ? value.completedItemIds.map(String) : [],
    reservedIds: value.reservedIds && typeof value.reservedIds === "object" ? value.reservedIds : {},
    invoiceCustomerIndex: Number.isInteger(value.invoiceCustomerIndex) ? Number(value.invoiceCustomerIndex) : 0,
    invoicePage: Number.isInteger(value.invoicePage) && Number(value.invoicePage) > 0 ? Number(value.invoicePage) : 1,
    invoiceTruncated: value.invoiceTruncated === true,
    unavailableCustomerIds: Array.isArray(value.unavailableCustomerIds) ? value.unavailableCustomerIds.map(String) : [],
  };
}

function asBooksCustomer(row: ZohoCustomerPreview): BooksCustomer {
  return {
    zohoId: row.id,
    name: row.name,
    companyName: row.companyName,
    email: row.email,
    phoneRaw: row.phone,
    currencyCode: row.currencyCode,
    status: row.status,
    customerSubType: row.customerSubType,
    firstName: row.firstName,
    lastName: row.lastName,
  };
}

function asBooksItem(row: ZohoItemPreview): BooksItem {
  return {
    zohoId: row.id,
    name: row.name,
    sku: row.sku,
    rate: row.rate,
    currencyCode: row.currencyCode,
    taxPercentage: row.taxPercentage,
    taxName: row.taxName,
    unit: row.unit,
    status: row.status,
    description: row.description,
    productType: row.productType,
    purchaseRate: row.purchaseRate,
    stockOnHand: row.stockOnHand,
    locationAvailableStock: row.locationAvailableStock,
    locationActualAvailableStock: row.locationActualAvailableStock,
    isTaxInclusive: row.isTaxInclusive,
  };
}

function safeMessage(error: unknown): string {
  if (error instanceof ZohoBooksRequestError || error instanceof ImportDecisionError) return error.message.slice(0, 300);
  return "The sync stopped before the next record was saved.";
}

function migrationError(error: { code?: string; message?: string } | null): Error | null {
  if (!error) return null;
  if (error.code === "42P01" || error.code === "PGRST205" || /zoho_books_/i.test(error.message ?? "")) {
    const missing = new Error("migration_required");
    missing.name = "ZohoMigrationRequired";
    return missing;
  }
  return null;
}

async function requireConnected(clientId: string): Promise<Connected> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zoho_books_connections")
    .select("id, client_id, status, zoho_organization_id, scopes")
    .eq("client_id", clientId)
    .maybeSingle();
  const missing = migrationError(error);
  if (missing) throw missing;
  if (error) throw new Error("Could not load the Zoho Books connection.");
  if (!data || data.status !== "connected" || !data.zoho_organization_id) {
    throw new ZohoBooksRequestError("Choose a Zoho Books organisation before importing.", 409, false);
  }
  if (!sameTenant(clientId, String(data.client_id))) {
    throw new ZohoBooksRequestError("This connection belongs to another company.", 403, false);
  }
  return {
    id: String(data.id),
    clientId,
    organizationId: String(data.zoho_organization_id),
    scopes: Array.isArray(data.scopes) ? data.scopes.map(String) : [],
  };
}

async function loadDialCode(clientId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("clients").select("dial_code").eq("id", clientId).maybeSingle();
  const dial = typeof data?.dial_code === "string" ? data.dial_code.trim() : "";
  return dial || null;
}

async function findLink(clientId: string, organizationId: string, resourceType: "customer" | "item", externalId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("zoho_books_record_links")
    .select("id, client_id, segmiq_id, books_snapshot")
    .eq("client_id", clientId)
    .eq("zoho_organization_id", organizationId)
    .eq("resource_type", resourceType)
    .eq("external_id", externalId)
    .maybeSingle();
  if (!data) return null;
  const snapshot =
    data.books_snapshot && typeof data.books_snapshot === "object" ? (data.books_snapshot as Record<string, unknown>) : null;
  return {
    id: String(data.id),
    clientId: String(data.client_id),
    segmiqId: data.segmiq_id ? String(data.segmiq_id) : null,
    currencyCode: typeof snapshot?.currencyCode === "string" ? snapshot.currencyCode : null,
  };
}

async function linkedExternalMap(clientId: string, organizationId: string, resourceType: "customer" | "item", segmiqIds: string[]) {
  const map = new Map<string, string>();
  if (segmiqIds.length === 0) return map;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("zoho_books_record_links")
    .select("segmiq_id, external_id, client_id")
    .eq("client_id", clientId)
    .eq("zoho_organization_id", organizationId)
    .eq("resource_type", resourceType)
    .in("segmiq_id", segmiqIds);
  for (const row of data ?? []) {
    if (!sameTenant(clientId, String(row.client_id)) || !row.segmiq_id) continue;
    map.set(String(row.segmiq_id), String(row.external_id));
  }
  return map;
}

function contactFromRow(row: Record<string, unknown>): LocalContact {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    name: typeof row.name === "string" ? row.name : null,
    email: typeof row.email === "string" ? row.email : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    customerType: typeof row.customer_type === "string" ? row.customer_type : null,
    primaryContactName: typeof row.primary_contact_name === "string" ? row.primary_contact_name : null,
    notes: typeof row.notes === "string" ? row.notes : null,
    lifecycle: typeof row.lifecycle === "string" ? row.lifecycle : null,
    relationshipOwnerId: typeof row.relationship_owner_id === "string" ? row.relationship_owner_id : null,
  };
}

const CONTACT_COLUMNS =
  "id, client_id, name, email, phone, customer_type, primary_contact_name, notes, lifecycle, relationship_owner_id";

async function findContact(clientId: string, contactId: string): Promise<LocalContact | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("contacts").select(CONTACT_COLUMNS).eq("client_id", clientId).eq("id", contactId).maybeSingle();
  return data ? contactFromRow(data as Record<string, unknown>) : null;
}

async function candidateContacts(clientId: string, phone: string | null, phoneNormalized: boolean, email: string | null) {
  const supabase = createAdminClient();
  const rows: LocalContact[] = [];
  if (email && !/[%_\\]/.test(email)) {
    const { data } = await supabase.from("contacts").select(CONTACT_COLUMNS).eq("client_id", clientId).ilike("email", email).limit(5);
    for (const row of data ?? []) rows.push(contactFromRow(row as Record<string, unknown>));
  }
  if (phoneNormalized && phone) {
    const { data } = await supabase.from("contacts").select(CONTACT_COLUMNS).eq("client_id", clientId).eq("phone", phone).limit(5);
    for (const row of data ?? []) {
      const contact = contactFromRow(row as Record<string, unknown>);
      if (!rows.some((existing) => existing.id === contact.id)) rows.push(contact);
    }
  }
  return rows;
}

function productFromRow(row: Record<string, unknown>): LocalProduct {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    name: String(row.name ?? ""),
    sku: typeof row.sku === "string" ? row.sku : null,
    sellingPrice: row.selling_price == null ? null : String(row.selling_price),
    currency: typeof row.currency === "string" ? row.currency : null,
    taxRate: row.tax_rate == null ? null : String(row.tax_rate),
    unit: typeof row.unit === "string" ? row.unit : null,
    status: typeof row.status === "string" ? row.status : null,
    description: typeof row.description === "string" ? row.description : null,
    costPrice: row.cost_price == null ? null : String(row.cost_price),
    quotationDescription: typeof row.quotation_description === "string" ? row.quotation_description : null,
  };
}

const PRODUCT_COLUMNS =
  "id, client_id, name, sku, selling_price, currency, tax_rate, unit, status, description, cost_price, quotation_description";

async function findProduct(clientId: string, productId: string): Promise<LocalProduct | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("products").select(PRODUCT_COLUMNS).eq("client_id", clientId).eq("id", productId).maybeSingle();
  return data ? productFromRow(data as Record<string, unknown>) : null;
}

async function candidateProducts(clientId: string, sku: string | null) {
  if (!sku || /[%_\\]/.test(sku)) return [];
  const supabase = createAdminClient();
  const { data } = await supabase.from("products").select(PRODUCT_COLUMNS).eq("client_id", clientId).ilike("sku", sku).limit(5);
  return (data ?? []).map((row) => productFromRow(row as Record<string, unknown>));
}

async function organisationCurrency(clientId: string, organizationId: string): Promise<string | null> {
  const body = await zohoBooksRead(clientId, "/books/v3/organizations", {});
  return parseOrganisationCurrency(body, organizationId);
}

async function buildCustomerPlan(
  connection: Connected,
  zohoId: string,
  dialCode: string | null
): Promise<{ plan: CustomerPlan; books: BooksCustomer }> {
  const body = await zohoBooksRead(connection.clientId, `/books/v3/contacts/${zohoId}`, {
    organization_id: connection.organizationId,
  });
  const parsed = parseCustomerRecord(body);
  if (!parsed) throw new ImportDecisionError("Books did not return this customer. Vendor records are not imported.");
  const books = asBooksCustomer(parsed);
  const write = customerWriteFromBooks(books, dialCode);
  const link = await findLink(connection.clientId, connection.organizationId, "customer", zohoId);
  const contact = link?.segmiqId ? await findContact(connection.clientId, link.segmiqId) : null;
  const contacts = await candidateContacts(connection.clientId, write.phone, write.phoneNormalized, write.email);
  const links = await linkedExternalMap(
    connection.clientId,
    connection.organizationId,
    "customer",
    contacts.map((row) => row.id)
  );
  return {
    books,
    plan: planCustomer({
      actorClientId: connection.clientId,
      books,
      dialCode,
      link: link?.segmiqId ? { segmiqId: link.segmiqId, clientId: link.clientId } : null,
      contact,
      contacts,
      linkedExternalBySegmiqId: links,
      previousCurrency: link?.currencyCode ?? null,
    }),
  };
}

async function buildItemPlan(
  connection: Connected,
  zohoId: string,
  currency: string | null,
  fetchedAt: string
): Promise<{ plan: ItemPlan; books: BooksItem }> {
  const body = await zohoBooksRead(connection.clientId, `/books/v3/items/${zohoId}`, {
    organization_id: connection.organizationId,
  });
  const parsed = parseItemRecord(body);
  if (!parsed) throw new ImportDecisionError("Books did not return this item.");
  const books = asBooksItem(parsed);
  const link = await findLink(connection.clientId, connection.organizationId, "item", zohoId);
  const product = link?.segmiqId ? await findProduct(connection.clientId, link.segmiqId) : null;
  const products = await candidateProducts(connection.clientId, books.sku);
  const links = await linkedExternalMap(
    connection.clientId,
    connection.organizationId,
    "item",
    products.map((row) => row.id)
  );
  return {
    books,
    plan: planItem({
      actorClientId: connection.clientId,
      books,
      organisationCurrency: currency,
      link: link?.segmiqId ? { segmiqId: link.segmiqId, clientId: link.clientId } : null,
      product,
      products,
      linkedExternalBySegmiqId: links,
      fetchedAt,
    }),
  };
}

export async function planBooksImport(clientId: string, userId: string, input: { customerIds: string[]; itemIds: string[] }) {
  if (input.customerIds.length + input.itemIds.length === 0) {
    throw new ZohoBooksRequestError("Select at least one customer or item.", 400, false);
  }
  const connection = await requireConnected(clientId);
  const dialCode = await loadDialCode(clientId);
  const currency = input.itemIds.length > 0 ? await organisationCurrency(clientId, connection.organizationId) : null;
  const fetchedAt = new Date().toISOString();
  const customers: CustomerPlan[] = [];
  for (const zohoId of input.customerIds) customers.push((await buildCustomerPlan(connection, zohoId, dialCode)).plan);
  const items: ItemPlan[] = [];
  for (const zohoId of input.itemIds) items.push((await buildItemPlan(connection, zohoId, currency, fetchedAt)).plan);
  await recordZohoEvent(clientId, userId, "import_planned", {
    customers: String(customers.length),
    items: String(items.length),
    conflicts: String(customers.filter((row) => row.action === "conflict").length + items.filter((row) => row.action === "conflict").length),
  });
  return { customers, items, invoiceReadsGranted: invoiceReadsGranted(connection.scopes) };
}

async function activeRun(clientId: string): Promise<RunRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("zoho_books_sync_runs")
    .select("id, client_id, connection_id, zoho_organization_id, kind, status, checkpoint, counts, last_error, updated_at")
    .eq("client_id", clientId)
    .in("status", ["running", "needs_decision", "paused"])
    .maybeSingle();
  return (data as RunRow | null) ?? null;
}

async function saveRun(clientId: string, runId: string, patch: Record<string, unknown>) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("zoho_books_sync_runs").update(patch).eq("client_id", clientId).eq("id", runId);
  if (error) throw new Error("Could not save sync progress.");
}

function publicRun(row: RunRow, invoiceReconnect = false): PublicRun {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    counts: row.counts ?? {},
    lastError: row.last_error,
    invoiceReconnect,
  };
}

async function ensureRun(clientId: string, userId: string, connection: Connected, kind: "import" | "refresh", runId?: string) {
  const existing = await activeRun(clientId);
  if (existing && !sameTenant(clientId, existing.client_id)) {
    throw new ZohoBooksRequestError("This sync belongs to another company.", 403, false);
  }
  if (existing && Date.now() - new Date(existing.updated_at).getTime() > STALE_RUN_MS) {
    await saveRun(clientId, existing.id, {
      status: "failed",
      last_error: "The previous sync stopped responding.",
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else if (existing) {
    if (existing.kind !== kind || (runId && existing.id !== runId) || (!runId && kind === "import")) {
      throw new ZohoBooksRequestError("A sync is already in progress for this company. Resume it or discard it first.", 409, false);
    }
    if (runId && existing.id === runId) return existing;
    if (kind === "refresh") return existing;
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zoho_books_sync_runs")
    .insert({
      client_id: clientId,
      connection_id: connection.id,
      zoho_organization_id: connection.organizationId,
      kind,
      status: "running",
      actor_user_id: userId,
      checkpoint: emptyCheckpoint(),
      counts: {},
    })
    .select("id, client_id, connection_id, zoho_organization_id, kind, status, checkpoint, counts, last_error, updated_at")
    .single();
  if (error || !data) throw new ZohoBooksRequestError("A sync is already in progress for this company.", 409, false);
  return data as RunRow;
}

async function persistCustomer(
  connection: Connected,
  zohoId: string,
  decision: ImportDecision,
  dialCode: string | null,
  checkpoint: Checkpoint
) {
  const built = await buildCustomerPlan(connection, zohoId, dialCode);
  const resolved = resolvePlanAction(built.plan, decision);
  if (!resolved.ok) throw new ImportDecisionError(resolved.reason);
  if (resolved.mode === "skip") return "skipped" as const;
  const link = await findLink(connection.clientId, connection.organizationId, "customer", zohoId);
  const reserved = checkpoint.reservedIds[`customer:${zohoId}`] ?? link?.segmiqId ?? randomUUID();
  checkpoint.reservedIds[`customer:${zohoId}`] = reserved;
  const existingId = link?.segmiqId ?? (resolved.mode === "link" ? resolved.segmiqId : null);
  const contact = existingId ? await findContact(connection.clientId, existingId) : null;
  const material = materializeCustomer({
    books: built.books,
    dialCode,
    mode: link?.segmiqId ? "update" : resolved.mode,
    existingSegmiqId: existingId,
    reservedId: reserved,
    currentLifecycle: contact?.lifecycle ?? null,
  });
  if (!sameTenant(connection.clientId, connection.clientId)) {
    throw new ZohoBooksRequestError("This connection belongs to another company.", 403, false);
  }
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  if (!link) {
    const { error } = await supabase.from("zoho_books_record_links").insert({
      client_id: connection.clientId,
      connection_id: connection.id,
      zoho_organization_id: connection.organizationId,
      resource_type: "customer",
      external_id: zohoId,
      segmiq_id: material.segmiqId,
      books_snapshot: material.snapshot,
      updated_at: now,
    });
    if (error && error.code !== "23505") throw new Error("Could not save the customer link.");
    if (error?.code === "23505") {
      const raced = await findLink(connection.clientId, connection.organizationId, "customer", zohoId);
      if (!raced?.segmiqId) throw new ImportDecisionError("That SegmiQ contact is already linked to a different Books customer.");
      material.segmiqId = raced.segmiqId;
    }
  }
  const contactPayload = {
    ...material.patch,
    ...(material.setLifecycleCustomer ? { lifecycle: "customer" } : {}),
    updated_at: now,
  };
  if (contact) {
    const { error } = await supabase.from("contacts").update(contactPayload).eq("client_id", connection.clientId).eq("id", material.segmiqId);
    if (error) throw new Error("Could not update the customer.");
  } else {
    const { error } = await supabase.from("contacts").insert({
      id: material.segmiqId,
      client_id: connection.clientId,
      ...contactPayload,
      source: "Zoho Books",
      lead_origin: "client",
      lifecycle: "customer",
    });
    if (error?.code === "23505") {
      const { error: updateError } = await supabase
        .from("contacts")
        .update(contactPayload)
        .eq("client_id", connection.clientId)
        .eq("id", material.segmiqId);
      if (updateError) throw new Error("Could not save the customer.");
    } else if (error) {
      throw new Error("Could not save the customer.");
    }
  }
  await supabase
    .from("zoho_books_record_links")
    .update({ segmiq_id: material.segmiqId, books_snapshot: material.snapshot, updated_at: now })
    .eq("client_id", connection.clientId)
    .eq("zoho_organization_id", connection.organizationId)
    .eq("resource_type", "customer")
    .eq("external_id", zohoId);
  return material.mode;
}

async function persistItem(
  connection: Connected,
  userId: string,
  zohoId: string,
  decision: ImportDecision,
  currency: string | null,
  checkpoint: Checkpoint
) {
  const fetchedAt = new Date().toISOString();
  const built = await buildItemPlan(connection, zohoId, currency, fetchedAt);
  const resolved = resolvePlanAction(built.plan, decision);
  if (!resolved.ok) throw new ImportDecisionError(resolved.reason);
  if (resolved.mode === "skip") return "skipped" as const;
  const link = await findLink(connection.clientId, connection.organizationId, "item", zohoId);
  const reserved = checkpoint.reservedIds[`item:${zohoId}`] ?? link?.segmiqId ?? randomUUID();
  checkpoint.reservedIds[`item:${zohoId}`] = reserved;
  const existingId = link?.segmiqId ?? (resolved.mode === "link" ? resolved.segmiqId : null);
  const product = existingId ? await findProduct(connection.clientId, existingId) : null;
  const material = materializeItem({
    books: built.books,
    organisationCurrency: currency,
    mode: link?.segmiqId ? "update" : resolved.mode,
    existingSegmiqId: existingId,
    reservedId: reserved,
    localStatus: product?.status ?? null,
    fetchedAt,
  });
  if ("error" in material) throw new ImportDecisionError(material.error);
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  if (!link) {
    const { error } = await supabase.from("zoho_books_record_links").insert({
      client_id: connection.clientId,
      connection_id: connection.id,
      zoho_organization_id: connection.organizationId,
      resource_type: "item",
      external_id: zohoId,
      segmiq_id: material.segmiqId,
      books_snapshot: material.snapshot,
      updated_at: now,
    });
    if (error && error.code !== "23505") throw new Error("Could not save the item link.");
    if (error?.code === "23505") {
      const raced = await findLink(connection.clientId, connection.organizationId, "item", zohoId);
      if (!raced?.segmiqId) throw new ImportDecisionError("That SegmiQ product is already linked to a different Books item.");
      material.segmiqId = raced.segmiqId;
    }
  }
  const { tax_rate: taxRate, ...rest } = material.patch;
  const productPayload = {
    ...rest,
    ...(material.applyTax ? { tax_rate: taxRate } : {}),
    external_system: "zoho_books",
    external_id: zohoId,
    external_sku: material.patch.sku,
    last_synced_at: now,
    sync_status: "synced",
    updated_by: userId,
    updated_at: now,
  };
  if (product) {
    const { error } = await supabase.from("products").update(productPayload).eq("client_id", connection.clientId).eq("id", material.segmiqId);
    if (error) throw new Error("Could not update the product.");
  } else {
    const { error } = await supabase.from("products").insert({
      id: material.segmiqId,
      client_id: connection.clientId,
      ...productPayload,
      ...(material.applyTax ? {} : { tax_rate: null }),
      track_inventory: false,
      created_by: userId,
    });
    if (error?.code === "23505") {
      await supabase
        .from("zoho_books_record_links")
        .delete()
        .eq("client_id", connection.clientId)
        .eq("zoho_organization_id", connection.organizationId)
        .eq("resource_type", "item")
        .eq("external_id", zohoId)
        .eq("segmiq_id", material.segmiqId);
      throw new ImportDecisionError("A product with this SKU already exists. Link it or skip it.");
    }
    if (error) throw new Error("Could not save the product.");
  }
  await supabase
    .from("zoho_books_record_links")
    .update({ segmiq_id: material.segmiqId, books_snapshot: material.snapshot, updated_at: now })
    .eq("client_id", connection.clientId)
    .eq("zoho_organization_id", connection.organizationId)
    .eq("resource_type", "item")
    .eq("external_id", zohoId);
  return material.mode;
}

function bump(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

export async function applyBooksImport(
  clientId: string,
  userId: string,
  input: { runId?: string; customers: ImportDecision[]; items: ImportDecision[] }
) {
  if (input.customers.length > IMPORT_BATCH_LIMIT || input.items.length > IMPORT_BATCH_LIMIT) {
    throw new ZohoBooksRequestError("Import five customers and five items at a time.", 400, false);
  }
  const connection = await requireConnected(clientId);
  const run = await ensureRun(clientId, userId, connection, "import", input.runId);
  const checkpoint = readCheckpoint(run.checkpoint);
  const counts = { ...(run.counts ?? {}) };
  const dialCode = await loadDialCode(clientId);
  const currency = input.items.length > 0 ? await organisationCurrency(clientId, connection.organizationId) : null;
  await saveRun(clientId, run.id, { status: "running", last_error: null, updated_at: new Date().toISOString() });

  const customerResult = await commitAfterWrite({
    pending: input.customers,
    completedKeys: checkpoint.completedCustomerIds,
    keyOf: (row) => row.zohoId,
    write: async (row) => {
      const mode = await persistCustomer(connection, row.zohoId, row, dialCode, checkpoint);
      bump(counts, mode === "skipped" ? "customersSkipped" : mode === "update" ? "customersUpdated" : mode === "link" ? "customersLinked" : "customersCreated");
    },
    save: async (completedKeys) => {
      checkpoint.completedCustomerIds = completedKeys;
      await saveRun(clientId, run.id, {
        checkpoint,
        counts,
        status: "running",
        updated_at: new Date().toISOString(),
      });
    },
  });
  checkpoint.completedCustomerIds = customerResult.completedKeys;
  if (customerResult.error) {
    return finishPaused(clientId, userId, run, checkpoint, counts, customerResult.error, customerResult.error.includes("link or skip") ? "needs_decision" : undefined);
  }

  const itemResult = await commitAfterWrite({
    pending: input.items,
    completedKeys: checkpoint.completedItemIds,
    keyOf: (row) => row.zohoId,
    write: async (row) => {
      const mode = await persistItem(connection, userId, row.zohoId, row, currency, checkpoint);
      bump(counts, mode === "skipped" ? "itemsSkipped" : mode === "update" ? "itemsUpdated" : mode === "link" ? "itemsLinked" : "itemsCreated");
    },
    save: async (completedKeys) => {
      checkpoint.completedItemIds = completedKeys;
      await saveRun(clientId, run.id, { checkpoint, counts, status: "running", updated_at: new Date().toISOString() });
    },
  });
  checkpoint.completedItemIds = itemResult.completedKeys;
  if (itemResult.error) {
    const status = itemResult.error.includes("link or skip") || itemResult.error.includes("SKU") ? "needs_decision" : undefined;
    return finishPaused(clientId, userId, run, checkpoint, counts, itemResult.error, status);
  }

  await saveRun(clientId, run.id, {
    checkpoint,
    counts,
    status: "completed",
    last_error: null,
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await recordZohoEvent(clientId, userId, "import_completed", {
    customers: String((counts.customersCreated ?? 0) + (counts.customersUpdated ?? 0) + (counts.customersLinked ?? 0)),
    items: String((counts.itemsCreated ?? 0) + (counts.itemsUpdated ?? 0) + (counts.itemsLinked ?? 0)),
    status: "completed",
  });
  return publicRun({ ...run, status: "completed", counts, last_error: null });
}

async function finishPaused(
  clientId: string,
  userId: string,
  run: RunRow,
  checkpoint: Checkpoint,
  counts: Record<string, number>,
  message: string,
  forced?: RunRow["status"]
) {
  const quota = /limit was reached|rate limit|too many requests/i.test(message);
  const decision = /link or skip|cannot be imported|SKU|not one of the matches/i.test(message);
  const revoked = /rejected the connection|revoked|Reconnect Zoho Books/i.test(message);
  const status = forced ?? (decision ? "needs_decision" : revoked ? "failed" : quota ? "paused" : "paused");
  await saveRun(clientId, run.id, {
    checkpoint,
    counts,
    status,
    last_error: message.slice(0, 300),
    updated_at: new Date().toISOString(),
  });
  await recordZohoEvent(clientId, userId, "import_paused", { status, message: message.slice(0, 300) });
  return publicRun({ ...run, status, counts, last_error: message.slice(0, 300) });
}

async function listLinks(clientId: string, organizationId: string, resourceType: "customer" | "item") {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("zoho_books_record_links")
    .select("external_id, segmiq_id, client_id")
    .eq("client_id", clientId)
    .eq("zoho_organization_id", organizationId)
    .eq("resource_type", resourceType)
    .order("external_id", { ascending: true });
  return (data ?? [])
    .filter((row) => sameTenant(clientId, String(row.client_id)) && row.segmiq_id)
    .map((row) => ({ externalId: String(row.external_id), segmiqId: String(row.segmiq_id) }));
}

export async function stepBooksSync(clientId: string, userId: string) {
  const connection = await requireConnected(clientId);
  const run = await ensureRun(clientId, userId, connection, "refresh");
  const checkpoint = readCheckpoint(run.checkpoint);
  const counts = { ...(run.counts ?? {}) };
  const customers = await listLinks(clientId, connection.organizationId, "customer");
  const pendingCustomer = customers.find((row) => !checkpoint.completedCustomerIds.includes(row.externalId));
  if (pendingCustomer) {
    try {
      await persistCustomer(
        connection,
        pendingCustomer.externalId,
        { zohoId: pendingCustomer.externalId, decision: "update" },
        await loadDialCode(clientId),
        checkpoint
      );
      checkpoint.completedCustomerIds.push(pendingCustomer.externalId);
      bump(counts, "customersUpdated");
      await saveRun(clientId, run.id, { checkpoint, counts, status: "running", last_error: null, updated_at: new Date().toISOString() });
      return publicRun({ ...run, status: "running", counts, last_error: null });
    } catch (error) {
      if (error instanceof ImportDecisionError) {
        checkpoint.unavailableCustomerIds.push(pendingCustomer.externalId);
        checkpoint.completedCustomerIds.push(pendingCustomer.externalId);
        bump(counts, "unavailable");
        await saveRun(clientId, run.id, {
          checkpoint,
          counts,
          status: "running",
          last_error: safeMessage(error),
          updated_at: new Date().toISOString(),
        });
        return publicRun({ ...run, status: "running", counts, last_error: safeMessage(error) });
      }
      return finishPaused(clientId, userId, run, checkpoint, counts, safeMessage(error));
    }
  }

  const items = await listLinks(clientId, connection.organizationId, "item");
  const pendingItem = items.find((row) => !checkpoint.completedItemIds.includes(row.externalId));
  if (pendingItem) {
    try {
      const currency = await organisationCurrency(clientId, connection.organizationId);
      await persistItem(
        connection,
        userId,
        pendingItem.externalId,
        { zohoId: pendingItem.externalId, decision: "update" },
        currency,
        checkpoint
      );
      checkpoint.completedItemIds.push(pendingItem.externalId);
      bump(counts, "itemsUpdated");
      await saveRun(clientId, run.id, { checkpoint, counts, status: "running", last_error: null, updated_at: new Date().toISOString() });
      return publicRun({ ...run, status: "running", counts, last_error: null });
    } catch (error) {
      return finishPaused(clientId, userId, run, checkpoint, counts, safeMessage(error));
    }
  }

  if (!invoiceReadsGranted(connection.scopes)) {
    await saveRun(clientId, run.id, {
      checkpoint,
      counts,
      status: "completed",
      last_error: null,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await recordZohoEvent(clientId, userId, "refresh_completed", {
      customers: String(checkpoint.completedCustomerIds.length),
      items: String(checkpoint.completedItemIds.length),
      invoices: "reconnect_required",
      status: "completed",
    });
    return publicRun({ ...run, status: "completed", counts, last_error: null }, true);
  }

  if (checkpoint.invoiceCustomerIndex >= customers.length) {
    await saveRun(clientId, run.id, {
      checkpoint,
      counts,
      status: "completed",
      last_error: null,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await recordZohoEvent(clientId, userId, "refresh_completed", {
      customers: String(checkpoint.completedCustomerIds.length),
      items: String(checkpoint.completedItemIds.length),
      invoices: String(counts.invoices ?? 0),
      status: "completed",
    });
    return publicRun({ ...run, status: "completed", counts, last_error: null });
  }

  const customer = customers[checkpoint.invoiceCustomerIndex];
  try {
    const body = await zohoBooksRead(
      clientId,
      "/books/v3/invoices",
      invoiceListQuery(connection.organizationId, customer.externalId, checkpoint.invoicePage)
    );
    const invoices = parseInvoicePage(body).filter((row) => row.externalCustomerId === customer.externalId);
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    if (invoices.length > 0) {
      const { error } = await supabase.from("zoho_books_invoice_snapshots").upsert(
        invoices.map((row) => ({
          client_id: connection.clientId,
          connection_id: connection.id,
          zoho_organization_id: connection.organizationId,
          external_invoice_id: row.externalInvoiceId,
          external_customer_id: row.externalCustomerId,
          contact_id: customer.segmiqId,
          invoice_number: row.invoiceNumber,
          status: row.status,
          currency_code: row.currencyCode,
          total: row.total == null ? null : Number(row.total),
          balance: row.balance == null ? null : Number(row.balance),
          credits_applied: row.creditsApplied == null ? null : Number(row.creditsApplied),
          invoice_date: row.invoiceDate,
          due_date: row.dueDate,
          fetched_at: now,
          updated_at: now,
        })),
        { onConflict: "client_id,zoho_organization_id,external_invoice_id" }
      );
      if (error) throw new Error("Could not save invoice status.");
    }
    const hasMore = parseHasMore(body);
    if (hasMore && checkpoint.invoicePage >= INVOICE_MAX_PAGES) checkpoint.invoiceTruncated = true;
    const next = advanceInvoiceCursor(
      { customerIndex: checkpoint.invoiceCustomerIndex, page: checkpoint.invoicePage },
      hasMore && checkpoint.invoicePage < INVOICE_MAX_PAGES,
      customers.length
    );
    if (next === "done") {
      checkpoint.invoiceCustomerIndex = customers.length;
    } else {
      checkpoint.invoiceCustomerIndex = next.customerIndex;
      checkpoint.invoicePage = next.page;
    }
    counts.invoices = (counts.invoices ?? 0) + invoices.length;
    const done = checkpoint.invoiceCustomerIndex >= customers.length;
    await saveRun(clientId, run.id, {
      checkpoint,
      counts,
      status: done ? "completed" : "running",
      last_error: checkpoint.invoiceTruncated ? "Some customers have more than 100 invoices. The rest were not loaded." : null,
      finished_at: done ? now : null,
      updated_at: now,
    });
    if (done) {
      await recordZohoEvent(clientId, userId, "refresh_completed", {
        customers: String(customers.length),
        items: String(items.length),
        invoices: String(counts.invoices ?? 0),
        status: "completed",
      });
    }
    return publicRun({
      ...run,
      status: done ? "completed" : "running",
      counts,
      last_error: checkpoint.invoiceTruncated ? "Some customers have more than 100 invoices. The rest were not loaded." : null,
    });
  } catch (error) {
    return finishPaused(clientId, userId, run, checkpoint, counts, safeMessage(error));
  }
}

export async function discardBooksSync(clientId: string, userId: string) {
  const existing = await activeRun(clientId);
  if (!existing || !sameTenant(clientId, existing.client_id)) return null;
  await saveRun(clientId, existing.id, {
    status: "failed",
    last_error: "Discarded by a manager.",
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await recordZohoEvent(clientId, userId, "sync_discarded", { status: "failed" });
  return publicRun({ ...existing, status: "failed", last_error: "Discarded by a manager." });
}

export async function listBooksInvoices(clientId: string) {
  const connection = await requireConnected(clientId);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zoho_books_invoice_snapshots")
    .select("invoice_number, status, currency_code, total, balance, credits_applied, fetched_at, contact_id, external_customer_id, client_id")
    .eq("client_id", clientId)
    .eq("zoho_organization_id", connection.organizationId)
    .order("fetched_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Could not load invoice status.");
  const contactIds = [...new Set((data ?? []).map((row) => row.contact_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase.from("contacts").select("id, name, client_id").eq("client_id", clientId).in("id", contactIds);
    for (const contact of contacts ?? []) {
      if (sameTenant(clientId, String(contact.client_id))) names.set(String(contact.id), String(contact.name ?? ""));
    }
  }
  return {
    invoiceReadsGranted: invoiceReadsGranted(connection.scopes),
    invoices: (data ?? [])
      .filter((row) => sameTenant(clientId, String(row.client_id)))
      .map((row) => ({
        invoiceNumber: row.invoice_number,
        status: row.status,
        currencyCode: row.currency_code,
        total: row.total == null ? null : String(row.total),
        balance: row.balance == null ? null : String(row.balance),
        creditsApplied: row.credits_applied == null ? null : String(row.credits_applied),
        fetchedAt: row.fetched_at,
        customerName: row.contact_id ? names.get(String(row.contact_id)) ?? null : null,
      })),
  };
}

