import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  booksOrganisationUrl,
  buildCustomerPayload,
  buildDraftReview,
  confirmDraftState,
  customerCreateReady,
  decideCreateAttempt,
  decideReconcile,
  documentUpdateAllowed,
  interpretReferenceSearch,
  parseContactEmailMatches,
  parseCreatedDocument,
  parseReferenceMatches,
  parseVerifiedContact,
  parseVerifiedItem,
  preCreateSearchDecision,
  referenceNumber,
  totalDifference,
  WRITE_LOCK_MS,
  type DraftKind,
  type DraftReview,
  type DraftSourceLine,
  type ReferenceMatch,
  type WriteStatus,
} from "./drafts";
import { ZohoBooksRequestError } from "./http";
import { draftWritesGranted, parseHasMore, parseOrganisationPlan } from "./protocol";
import { recordZohoEvent, zohoBooksMutate, zohoBooksRead } from "./store";

export type DraftActionResult = { status: number; body: Record<string, unknown> };

type ConnectionRow = {
  id: string;
  status: string;
  zoho_organization_id: string | null;
  zoho_organization_name: string | null;
  location: string | null;
  scopes: string[] | null;
};

type QuoteRow = {
  id: string;
  lead_id: string;
  currency: string;
  total: number | string;
  discount_percent: number | string | null;
};

type LineRow = {
  item_name: string;
  quantity: number | string;
  unit_price: number | string;
  discount_percent: number | string | null;
  discount_amount: number | string | null;
  tax_rate: number | string | null;
  tax_inclusive: boolean | null;
  is_optional: boolean | null;
  product_id: string | null;
};

type ContactRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  customer_type: string | null;
};

type LinkRow = {
  external_id: string;
  zoho_organization_id: string;
  segmiq_id: string | null;
};

type OpRow = {
  id: string;
  status: WriteStatus;
  updated_at: string;
  external_id: string | null;
  reference_number: string | null;
  details: Record<string, unknown> | null;
};

function json(status: number, body: Record<string, unknown>): DraftActionResult {
  return { status, body };
}

function asNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function migrationOrThrow(error: { code?: string; message?: string } | null): void {
  if (!error) return;
  if (error.code === "42P01" || error.code === "PGRST205" || /zoho_books_/i.test(error.message ?? "")) {
    const missing = new Error("Apply the Zoho Books draft migration before creating drafts.");
    missing.name = "ZohoMigrationRequired";
    throw missing;
  }
}

function numericId(value: string | null | undefined): string | null {
  const id = value?.trim() ?? "";
  return /^[0-9]+$/.test(id) ? id : null;
}

async function loadConnection(clientId: string): Promise<ConnectionRow | DraftActionResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zoho_books_connections")
    .select("id, status, zoho_organization_id, zoho_organization_name, location, scopes")
    .eq("client_id", clientId)
    .maybeSingle();
  migrationOrThrow(error);
  if (error) return json(502, { error: "Zoho Books could not be read." });
  const row = data as ConnectionRow | null;
  if (!row || row.status !== "connected" || !numericId(row.zoho_organization_id)) {
    return json(409, { error: "Connect Zoho Books and choose an organisation before creating a draft." });
  }
  if (!draftWritesGranted(row.scopes)) {
    return json(409, {
      error: "Reconnect Zoho Books and approve the draft permissions. Customer import and invoice status keep working until you do.",
      reconnect: true,
    });
  }
  return row;
}

function isConnection(value: ConnectionRow | DraftActionResult): value is ConnectionRow {
  return "zoho_organization_id" in value;
}

async function readSafe(clientId: string, path: string, query: Record<string, string>): Promise<unknown | null> {
  try {
    return await zohoBooksRead(clientId, path, query);
  } catch (error) {
    if (error instanceof ZohoBooksRequestError && error.status === 404) return null;
    throw error;
  }
}

async function loadQuote(clientId: string, quotationId: string): Promise<
  | {
      quote: QuoteRow;
      lines: LineRow[];
      contact: ContactRow | null;
      customerLink: LinkRow | null;
      itemLinks: LinkRow[];
    }
  | DraftActionResult
> {
  const supabase = createAdminClient();
  const { data: quote, error: quoteError } = await supabase
    .from("quotations")
    .select("id, lead_id, currency, total, discount_percent")
    .eq("id", quotationId)
    .eq("client_id", clientId)
    .maybeSingle();
  migrationOrThrow(quoteError);
  if (quoteError) return json(502, { error: "The quotation could not be read." });
  if (!quote) return json(404, { error: "Quotation not found." });
  const quoteRow = quote as QuoteRow;
  const [{ data: lines, error: lineError }, { data: lead, error: leadError }] = await Promise.all([
    supabase
      .from("quotation_line_items")
      .select("item_name, quantity, unit_price, discount_percent, discount_amount, tax_rate, tax_inclusive, is_optional, product_id, sort_order")
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true }),
    supabase.from("leads").select("id, contact_id").eq("id", quoteRow.lead_id).eq("client_id", clientId).maybeSingle(),
  ]);
  migrationOrThrow(lineError);
  migrationOrThrow(leadError);
  if (lineError || leadError) return json(502, { error: "The quotation could not be read." });
  const contactId = (lead as { contact_id?: string | null } | null)?.contact_id ?? null;
  const productIds = ((lines ?? []) as LineRow[]).map((line) => line.product_id).filter((id): id is string => Boolean(id));
  const [{ data: contact }, { data: customerLinks }, { data: itemLinks }] = await Promise.all([
    contactId
      ? supabase
          .from("contacts")
          .select("id, name, email, phone, customer_type")
          .eq("id", contactId)
          .eq("client_id", clientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    contactId
      ? supabase
          .from("zoho_books_record_links")
          .select("external_id, zoho_organization_id, segmiq_id")
          .eq("client_id", clientId)
          .eq("resource_type", "customer")
          .eq("segmiq_id", contactId)
      : Promise.resolve({ data: [] }),
    productIds.length
      ? supabase
          .from("zoho_books_record_links")
          .select("external_id, zoho_organization_id, segmiq_id")
          .eq("client_id", clientId)
          .eq("resource_type", "item")
          .in("segmiq_id", productIds)
      : Promise.resolve({ data: [] }),
  ]);
  return {
    quote: quoteRow,
    lines: (lines ?? []) as LineRow[],
    contact: (contact as ContactRow | null) ?? null,
    customerLink: ((customerLinks ?? []) as LinkRow[])[0] ?? null,
    itemLinks: (itemLinks ?? []) as LinkRow[],
  };
}

async function buildSource(
  clientId: string,
  connection: ConnectionRow,
  loaded: Exclude<Awaited<ReturnType<typeof loadQuote>>, DraftActionResult>,
  kind: DraftKind,
  stockAcknowledged: boolean
): Promise<{ review: DraftReview; extra: string[]; customer: ContactRow | null; organisationId: string }> {
  const organisationId = connection.zoho_organization_id as string;
  const extra: string[] = [];
  let customerId: string | null = null;
  let customerCurrency: string | null = null;
  let customerVerified = false;
  if (!loaded.contact) {
    extra.push("This quotation's lead has no SegmiQ contact. Link a contact before creating a Books customer.");
  } else if (!loaded.customerLink) {
    customerId = null;
  } else if (loaded.customerLink.zoho_organization_id !== organisationId) {
    extra.push("This contact is linked to a different Books organisation. Select that organisation before creating a draft.");
  } else {
    const id = numericId(loaded.customerLink.external_id);
    if (!id) extra.push("The stored Books customer id is not valid.");
    else {
      const body = await readSafe(clientId, `/books/v3/contacts/${id}`, { organization_id: organisationId });
      const verified = body ? parseVerifiedContact(body, id) : null;
      if (!verified) extra.push("The linked Books customer could not be confirmed in the selected organisation.");
      else {
        customerId = verified.id;
        customerCurrency = verified.currency;
        customerVerified = true;
      }
    }
  }

  const linksByProduct = new Map(loaded.itemLinks.map((link) => [link.segmiq_id, link]));
  const lines: DraftSourceLine[] = [];
  for (const line of loaded.lines) {
    const optional = line.is_optional === true;
    let itemId: string | null = null;
    if (!optional && line.product_id) {
      const link = linksByProduct.get(line.product_id);
      if (!link) itemId = null;
      else if (link.zoho_organization_id !== organisationId) {
        extra.push(`${line.item_name} is linked to a different Books organisation.`);
      } else {
        const id = numericId(link.external_id);
        if (!id) extra.push(`${line.item_name} has a Books item id that is not valid.`);
        else {
          const body = await readSafe(clientId, `/books/v3/items/${id}`, { organization_id: organisationId });
          itemId = body && parseVerifiedItem(body, id) ? id : null;
          if (!itemId) extra.push(`${line.item_name} is not in the selected Books organisation.`);
        }
      }
    }
    lines.push({
      name: line.item_name,
      quantity: asNumber(line.quantity),
      rate: asNumber(line.unit_price),
      discountPercent: asNumber(line.discount_percent),
      discountAmount: asNumber(line.discount_amount),
      taxRate: line.tax_rate == null ? null : asNumber(line.tax_rate),
      taxInclusive: line.tax_inclusive === true,
      itemId,
      optional,
    });
  }

  const review = buildDraftReview({
    quotationId: loaded.quote.id,
    kind,
    currency: loaded.quote.currency || "",
    headerDiscountPercent: asNumber(loaded.quote.discount_percent),
    proposedTotal: asNumber(loaded.quote.total),
    customerId,
    customerCurrency,
    customerVerified,
    lines,
    stockAcknowledged,
  });
  if (extra.length) {
    review.blockers = [...extra, ...review.blockers];
    review.ready = false;
    review.payload = null;
  }
  return { review, extra, customer: loaded.contact, organisationId };
}

async function planName(clientId: string, organisationId: string): Promise<string | null> {
  try {
    const body = await zohoBooksRead(clientId, "/books/v3/organizations", {});
    return parseOrganisationPlan(body, organisationId);
  } catch {
    return null;
  }
}

async function loadDocument(clientId: string, organisationId: string, kind: DraftKind, quotationId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zoho_books_documents")
    .select("external_id, external_number, status, currency_code, books_total, segmiq_total, total_difference, reference_number, unexpected_status, external_customer_id")
    .eq("client_id", clientId)
    .eq("zoho_organization_id", organisationId)
    .eq("kind", kind)
    .eq("quotation_id", quotationId)
    .maybeSingle();
  migrationOrThrow(error);
  return data as {
    external_id: string | null;
    external_number: string | null;
    status: string | null;
    currency_code: string | null;
    books_total: number | null;
    segmiq_total: number | null;
    total_difference: number | null;
    reference_number: string;
    unexpected_status: boolean;
    external_customer_id: string | null;
  } | null;
}

async function loadOperation(clientId: string, operationKey: string): Promise<OpRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zoho_books_write_operations")
    .select("id, status, updated_at, external_id, reference_number, details")
    .eq("client_id", clientId)
    .eq("operation_key", operationKey)
    .maybeSingle();
  migrationOrThrow(error);
  return (data as OpRow | null) ?? null;
}

async function saveDocument(input: {
  clientId: string;
  connectionId: string;
  organisationId: string;
  quotationId: string;
  kind: DraftKind;
  userId: string;
  match: ReferenceMatch;
  proposedTotal: number;
  currencyCode?: string | null;
}): Promise<void> {
  const compared = totalDifference(input.proposedTotal, input.match.total);
  const state = confirmDraftState(input.match.status);
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("zoho_books_documents").upsert(
    {
      client_id: input.clientId,
      connection_id: input.connectionId,
      zoho_organization_id: input.organisationId,
      quotation_id: input.quotationId,
      kind: input.kind,
      external_id: input.match.id,
      external_number: input.match.number,
      status: input.match.status,
      currency_code: input.currencyCode ?? null,
      books_total: compared.booksTotal,
      segmiq_total: input.proposedTotal,
      total_difference: compared.difference,
      reference_number: input.match.reference,
      external_customer_id: input.match.customerId,
      unexpected_status: !state.draft,
      snapshot: {
        status: input.match.status,
        booksTotal: compared.booksTotal,
        segmiqTotal: input.proposedTotal,
        difference: compared.difference,
        reference: input.match.reference,
        customerId: input.match.customerId,
        number: input.match.number,
      },
      created_by: input.userId,
      updated_at: now,
    },
    { onConflict: "client_id,zoho_organization_id,kind,quotation_id" }
  );
  migrationOrThrow(error);
  if (error) throw new ZohoBooksRequestError("The Books draft was saved in Books but the SegmiQ link could not be stored.", 502, false, { uncertain: true });
}

async function setOperation(
  clientId: string,
  operationKey: string,
  patch: { status: WriteStatus; externalId?: string | null; safeError?: string | null }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("zoho_books_write_operations")
    .update({
      status: patch.status,
      external_id: patch.externalId ?? null,
      safe_error: patch.safeError ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("operation_key", operationKey);
  migrationOrThrow(error);
}

async function claimOperation(input: {
  clientId: string;
  connectionId: string;
  organisationId: string;
  operationKey: string;
  kind: DraftKind | "customer";
  quotationId: string | null;
  userId: string;
  reference: string | null;
  details: Record<string, unknown>;
  takeover?: boolean;
}): Promise<{ owned: boolean; row: OpRow } | DraftActionResult> {
  const existing = await loadOperation(input.clientId, input.operationKey);
  const decision = decideCreateAttempt(
    existing ? { status: existing.status, updatedAt: Date.parse(existing.updated_at), externalId: existing.external_id } : null,
    Date.now()
  );
  if (decision === "wait" && !input.takeover) {
    return json(409, { error: "This draft is already being created. Wait a moment and refresh.", operation: "reserved" });
  }
  if (decision === "wait" && input.takeover) {
    return json(409, { error: "This draft update is already in progress.", operation: "reserved" });
  }
  if (!input.takeover && (decision === "return_existing" || decision === "reconcile")) {
    return { owned: false, row: existing as OpRow };
  }
  if (input.takeover && existing) {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("zoho_books_write_operations")
      .update({
        status: "reserved",
        actor_user_id: input.userId,
        safe_error: null,
        reference_number: input.reference,
        details: input.details,
        updated_at: now,
      })
      .eq("client_id", input.clientId)
      .eq("operation_key", input.operationKey)
      .eq("status", existing.status)
      .select("id, status, updated_at, external_id, reference_number, details")
      .maybeSingle();
    migrationOrThrow(error);
    if (data) return { owned: true, row: data as OpRow };
    return json(409, { error: "This draft update is already in progress.", operation: "reserved" });
  }
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  if (existing?.status === "failed") {
    const { data, error } = await supabase
      .from("zoho_books_write_operations")
      .update({
        status: "reserved",
        actor_user_id: input.userId,
        safe_error: null,
        external_id: null,
        reference_number: input.reference,
        details: input.details,
        updated_at: now,
      })
      .eq("client_id", input.clientId)
      .eq("operation_key", input.operationKey)
      .eq("status", "failed")
      .select("id, status, updated_at, external_id, reference_number, details")
      .maybeSingle();
    migrationOrThrow(error);
    if (data) return { owned: true, row: data as OpRow };
    const again = await loadOperation(input.clientId, input.operationKey);
    if (!again) return json(409, { error: "This draft is already being created.", operation: "reserved" });
    return { owned: false, row: again };
  }
  const { data, error } = await supabase
    .from("zoho_books_write_operations")
    .insert({
      client_id: input.clientId,
      connection_id: input.connectionId,
      zoho_organization_id: input.organisationId,
      operation_key: input.operationKey,
      kind: input.kind,
      quotation_id: input.quotationId,
      status: "reserved",
      actor_user_id: input.userId,
      reference_number: input.reference,
      details: input.details,
    })
    .select("id, status, updated_at, external_id, reference_number, details")
    .maybeSingle();
  if (error?.code === "23505") {
    const raced = await loadOperation(input.clientId, input.operationKey);
    if (!raced) return json(409, { error: "This draft is already being created.", operation: "reserved" });
    const racedDecision = decideCreateAttempt(
      { status: raced.status, updatedAt: Date.parse(raced.updated_at), externalId: raced.external_id },
      Date.now()
    );
    if (racedDecision === "wait" || racedDecision === "create") {
      return json(409, { error: "This draft is already being created.", operation: "reserved" });
    }
    return { owned: false, row: raced };
  }
  migrationOrThrow(error);
  if (error || !data) return json(502, { error: "The draft operation could not be reserved." });
  return { owned: true, row: data as OpRow };
}

function presentDocument(
  connection: ConnectionRow,
  document: NonNullable<Awaited<ReturnType<typeof loadDocument>>> | null,
  match: ReferenceMatch | null,
  proposedTotal: number
) {
  const compared = match ? totalDifference(proposedTotal, match.total) : null;
  const status = match?.status ?? document?.status ?? null;
  const state = confirmDraftState(status);
  return {
    id: match?.id ?? document?.external_id ?? null,
    number: match?.number ?? document?.external_number ?? null,
    status,
    draft: state.draft,
    message: state.message,
    booksTotal: compared?.booksTotal ?? (document?.books_total == null ? null : Number(document.books_total)),
    segmiqTotal: proposedTotal,
    difference: compared?.difference ?? (document?.total_difference == null ? null : Number(document.total_difference)),
    differs: compared?.differs ?? Math.abs(Number(document?.total_difference ?? 0)) >= 0.01,
    organisationUrl: booksOrganisationUrl(connection.location, connection.zoho_organization_id as string),
    referenceNumber: match?.reference ?? document?.reference_number ?? null,
  };
}

async function searchDocuments(clientId: string, organisationId: string, kind: DraftKind, reference: string) {
  const path = kind === "estimate" ? "/books/v3/estimates" : "/books/v3/invoices";
  const body = await zohoBooksRead(clientId, path, {
    organization_id: organisationId,
    reference_number: reference,
    per_page: "200",
  });
  const matches = parseReferenceMatches(kind, body, reference);
  return { matches, hasMore: parseHasMore(body) };
}

async function audit(
  clientId: string,
  userId: string,
  eventType: string,
  metadata: Record<string, string | boolean | null>
) {
  await recordZohoEvent(clientId, userId, eventType, metadata);
}

function customerView(contact: ContactRow | null, linked: boolean) {
  return {
    name: contact?.name ?? null,
    email: contact?.email ?? null,
    linked,
    createBlocker: contact
      ? customerCreateReady({ name: contact.name, email: contact.email, alreadyLinked: linked })
      : "This quotation's lead has no SegmiQ contact.",
  };
}

export async function reviewBooksDraft(input: {
  clientId: string;
  quotationId: string;
  kind: DraftKind;
  stockAcknowledged: boolean;
}): Promise<DraftActionResult> {
  const connection = await loadConnection(input.clientId);
  if (!isConnection(connection)) return connection;
  const loaded = await loadQuote(input.clientId, input.quotationId);
  if ("status" in loaded) return loaded;
  const built = await buildSource(input.clientId, connection, loaded, input.kind, input.stockAcknowledged);
  const customerKey = built.customer ? `customer:${built.organisationId}:${built.customer.id}` : null;
  const [plan, document, operation, customerOperation] = await Promise.all([
    planName(input.clientId, built.organisationId),
    loadDocument(input.clientId, built.organisationId, input.kind, input.quotationId),
    loadOperation(input.clientId, `draft:${built.organisationId}:${input.kind}:${input.quotationId}`),
    customerKey ? loadOperation(input.clientId, customerKey) : Promise.resolve(null),
  ]);
  const needsReconciliation = operation?.status === "uncertain" || operation?.status === "needs_reconciliation";
  return json(200, {
    review: built.review,
    customer: customerView(built.customer, Boolean(built.review.customerId)),
    planName: plan,
    planNote: plan
      ? `Books reports the plan ${plan}. A draft can still be rejected if this plan does not include this document.`
      : "Books did not return a plan name. Creating a draft can still fail if this organisation's plan does not include that document.",
    document: document ? presentDocument(connection, document, null, built.review.proposedTotal) : null,
    operation: operation ? { status: operation.status, needsReconciliation } : null,
    customerOperation: customerOperation
      ? { status: customerOperation.status, needsReconciliation: customerOperation.status === "uncertain" || customerOperation.status === "needs_reconciliation" }
      : null,
    organisationName: connection.zoho_organization_name,
  });
}

async function finishFromMatch(input: {
  clientId: string;
  userId: string;
  connection: ConnectionRow;
  quotationId: string;
  kind: DraftKind;
  operationKey: string;
  match: ReferenceMatch;
  proposedTotal: number;
  currencyCode?: string | null;
  eventType: string;
}): Promise<DraftActionResult> {
  await saveDocument({
    clientId: input.clientId,
    connectionId: input.connection.id,
    organisationId: input.connection.zoho_organization_id as string,
    quotationId: input.quotationId,
    kind: input.kind,
    userId: input.userId,
    match: input.match,
    proposedTotal: input.proposedTotal,
    currencyCode: input.currencyCode,
  });
  await setOperation(input.clientId, input.operationKey, { status: "succeeded", externalId: input.match.id });
  const presented = presentDocument(input.connection, null, input.match, input.proposedTotal);
  await audit(input.clientId, input.userId, input.eventType, {
    quotationId: input.quotationId,
    kind: input.kind,
    organizationId: input.connection.zoho_organization_id,
    result: input.match.status,
    externalId: input.match.id,
  });
  return json(200, { created: true, document: presented, booksAuthoritative: true });
}

export async function createBooksDraft(input: {
  clientId: string;
  userId: string;
  quotationId: string;
  kind: DraftKind;
  confirm: boolean;
  stockAcknowledged: boolean;
}): Promise<DraftActionResult> {
  const reviewed = await reviewBooksDraft(input);
  if (reviewed.status !== 200) return reviewed;
  if (!input.confirm) return json(200, { ...reviewed.body, created: false });
  const review = reviewed.body.review as DraftReview;
  if (!review.ready || !review.payload) return json(422, { error: review.blockers[0] ?? "This draft is not ready.", review });
  const connection = await loadConnection(input.clientId);
  if (!isConnection(connection)) return connection;
  const organisationId = connection.zoho_organization_id as string;
  const existingDocument = await loadDocument(input.clientId, organisationId, input.kind, input.quotationId);
  if (existingDocument?.external_id) {
    return json(200, {
      created: false,
      alreadyExists: true,
      document: presentDocument(connection, existingDocument, null, review.proposedTotal),
    });
  }
  const operationKey = `draft:${organisationId}:${input.kind}:${input.quotationId}`;
  const claim = await claimOperation({
    clientId: input.clientId,
    connectionId: connection.id,
    organisationId,
    operationKey,
    kind: input.kind,
    quotationId: input.quotationId,
    userId: input.userId,
    reference: review.referenceNumber,
    details: {},
  });
  if ("status" in claim) return claim;
  if (!claim.owned) {
    if (claim.row.external_id && claim.row.status === "succeeded") {
      const saved = await loadDocument(input.clientId, organisationId, input.kind, input.quotationId);
      return json(200, { created: false, alreadyExists: true, document: presentDocument(connection, saved, null, review.proposedTotal) });
    }
    return reconcileBooksDraft({ ...input, confirmNotCreated: false });
  }

  let searched: { matches: ReferenceMatch[]; hasMore: boolean };
  try {
    searched = await searchDocuments(input.clientId, organisationId, input.kind, review.referenceNumber);
  } catch (error) {
    await setOperation(input.clientId, operationKey, {
      status: "failed",
      safeError: "Books could not be searched. Nothing new was created.",
    });
    if (error instanceof ZohoBooksRequestError) throw error;
    return json(502, { error: "Books could not be searched. Nothing new was created." });
  }
  const pre = preCreateSearchDecision({ exactCount: searched.matches.length, hasMore: searched.hasMore });
  if (pre === "adopt") {
    return finishFromMatch({
      clientId: input.clientId,
      userId: input.userId,
      connection,
      quotationId: input.quotationId,
      kind: input.kind,
      operationKey,
      match: searched.matches[0],
      proposedTotal: review.proposedTotal,
      currencyCode: review.currency,
      eventType: "draft_reconciled",
    });
  }
  if (pre !== "post") {
    await setOperation(input.clientId, operationKey, {
      status: "needs_reconciliation",
      safeError: pre === "ambiguous" ? "More than one Books document uses this reference." : "The Books search did not prove this reference is absent.",
    });
    await audit(input.clientId, input.userId, "draft_needs_reconciliation", {
      quotationId: input.quotationId,
      kind: input.kind,
      organizationId: organisationId,
      result: pre,
    });
    return json(409, {
      error: "Needs reconciliation. SegmiQ did not create another draft.",
      needsReconciliation: true,
      canRetry: false,
    });
  }

  try {
    const body = await zohoBooksMutate(
      input.clientId,
      "POST",
      input.kind === "estimate" ? "/books/v3/estimates" : "/books/v3/invoices",
      { organization_id: organisationId },
      review.payload
    );
    const match = parseCreatedDocument(input.kind, body, review.referenceNumber);
    if (!match) {
      await setOperation(input.clientId, operationKey, {
        status: "uncertain",
        safeError: "Books answered, but the document reference could not be confirmed.",
      });
      return json(409, { error: "Needs reconciliation. Books answered without a matching reference.", needsReconciliation: true, canRetry: false });
    }
    return finishFromMatch({
      clientId: input.clientId,
      userId: input.userId,
      connection,
      quotationId: input.quotationId,
      kind: input.kind,
      operationKey,
      match,
      proposedTotal: review.proposedTotal,
      currencyCode: review.currency,
      eventType: "draft_created",
    });
  } catch (error) {
    if (error instanceof ZohoBooksRequestError && error.uncertain) {
      await setOperation(input.clientId, operationKey, { status: "uncertain", safeError: error.message });
      await audit(input.clientId, input.userId, "draft_uncertain", {
        quotationId: input.quotationId,
        kind: input.kind,
        organizationId: organisationId,
        result: "uncertain",
      });
      return json(409, { error: error.message, needsReconciliation: true, canRetry: false });
    }
    const message = error instanceof ZohoBooksRequestError ? error.message : "Zoho Books rejected the draft.";
    await setOperation(input.clientId, operationKey, { status: "failed", safeError: message });
    await audit(input.clientId, input.userId, "draft_rejected", {
      quotationId: input.quotationId,
      kind: input.kind,
      organizationId: organisationId,
      result: "failed",
    });
    if (error instanceof ZohoBooksRequestError) throw error;
    return json(502, { error: message });
  }
}

export async function reconcileBooksDraft(input: {
  clientId: string;
  userId: string;
  quotationId: string;
  kind: DraftKind;
  confirmNotCreated: boolean;
}): Promise<DraftActionResult> {
  const connection = await loadConnection(input.clientId);
  if (!isConnection(connection)) return connection;
  const organisationId = connection.zoho_organization_id as string;
  const operationKey = `draft:${organisationId}:${input.kind}:${input.quotationId}`;
  const operation = await loadOperation(input.clientId, operationKey);
  if (!operation) return json(404, { error: "There is no draft operation to reconcile." });
  const reference = operation.reference_number || referenceNumber(input.kind, input.quotationId);
  let searched: { matches: ReferenceMatch[]; hasMore: boolean };
  try {
    searched = await searchDocuments(input.clientId, organisationId, input.kind, reference);
  } catch (error) {
    if (error instanceof ZohoBooksRequestError && !error.uncertain) throw error;
    return json(409, { error: "Books could not be searched. The draft was not sent again.", needsReconciliation: true, canRetry: false });
  }
  const outcome = decideReconcile({
    search: interpretReferenceSearch(searched.matches),
    searchIncomplete: searched.hasMore && searched.matches.length === 0,
    confirmNotCreated: input.confirmNotCreated,
  });
  const loaded = await loadQuote(input.clientId, input.quotationId);
  const proposed = "status" in loaded ? 0 : asNumber(loaded.quote.total);
  if (outcome === "adopt") {
    return finishFromMatch({
      clientId: input.clientId,
      userId: input.userId,
      connection,
      quotationId: input.quotationId,
      kind: input.kind,
      operationKey,
      match: searched.matches[0],
      proposedTotal: proposed,
      eventType: "draft_reconciled",
    });
  }
  if (outcome === "clear_for_retry") {
    await setOperation(input.clientId, operationKey, { status: "failed", safeError: "A Books search found no document with this reference." });
    await audit(input.clientId, input.userId, "draft_retry_cleared", {
      quotationId: input.quotationId,
      kind: input.kind,
      organizationId: organisationId,
      result: "not_found",
    });
    return json(200, { needsReconciliation: false, canRetry: true, found: 0 });
  }
  await setOperation(input.clientId, operationKey, {
    status: "needs_reconciliation",
    safeError: searched.matches.length > 1 ? "More than one Books document uses this reference." : "No single Books document matched this reference.",
  });
  return json(409, {
    error: "Needs reconciliation. SegmiQ did not create another draft.",
    needsReconciliation: true,
    canRetry: searched.matches.length === 0 && !searched.hasMore,
    found: searched.matches.length,
  });
}

export async function updateBooksDraft(input: {
  clientId: string;
  userId: string;
  quotationId: string;
  kind: DraftKind;
  confirmReplace: boolean;
  acknowledgeBooksChanges: boolean;
  stockAcknowledged: boolean;
}): Promise<DraftActionResult> {
  const connection = await loadConnection(input.clientId);
  if (!isConnection(connection)) return connection;
  const organisationId = connection.zoho_organization_id as string;
  const document = await loadDocument(input.clientId, organisationId, input.kind, input.quotationId);
  const externalId = numericId(document?.external_id);
  if (!document || !externalId) return json(409, { error: "This quotation is not linked to a Books document." });
  const path = input.kind === "estimate" ? `/books/v3/estimates/${externalId}` : `/books/v3/invoices/${externalId}`;
  const currentBody = await readSafe(input.clientId, path, { organization_id: organisationId });
  const current = currentBody ? parseCreatedDocument(input.kind, wrapDocument(input.kind, currentBody), document.reference_number) : null;
  if (currentBody && !current) {
    return json(409, { error: "The Books document reference does not match the one SegmiQ stored. It was not changed." });
  }
  const booksStatus = current?.status ?? null;
  const booksTotal = current?.total ?? null;
  const decision = documentUpdateAllowed({
    linked: true,
    booksStatus,
    booksTotal,
    snapshotTotal: document.books_total == null ? null : Number(document.books_total),
    acknowledgeBooksChanges: input.acknowledgeBooksChanges,
  });
  if (!decision.allowed) {
    return json(409, {
      error: decision.message,
      document: presentDocument(connection, document, current, Number(document.segmiq_total ?? 0)),
    });
  }
  if (!input.confirmReplace) {
    return json(200, {
      replaced: false,
      message: "Books still has this document as a draft. Confirm replace to send this review.",
      document: presentDocument(connection, document, current, Number(document.segmiq_total ?? 0)),
    });
  }
  const reviewed = await reviewBooksDraft({ ...input, stockAcknowledged: input.kind === "invoice" ? input.stockAcknowledged : true });
  if (reviewed.status !== 200) return reviewed;
  const review = reviewed.body.review as DraftReview;
  if (!review.ready || !review.payload) return json(422, { error: review.blockers[0] ?? "This draft is not ready.", review });
  const operationKey = `update:${organisationId}:${input.kind}:${input.quotationId}`;
  const existing = await loadOperation(input.clientId, operationKey);
  if (existing && (existing.status === "uncertain" || existing.status === "needs_reconciliation" || existing.status === "reserved")) {
    const age = Date.now() - Date.parse(existing.updated_at);
    if (existing.status === "reserved" && age < WRITE_LOCK_MS) {
      return json(409, { error: "This draft update is already in progress.", needsReconciliation: false });
    }
    if (!input.acknowledgeBooksChanges) {
      return json(409, {
        error: "A previous update did not finish. Review the Books draft before replacing it.",
        needsReconciliation: true,
        document: presentDocument(connection, document, current, review.proposedTotal),
      });
    }
  }
  const claim = await claimOperation({
    clientId: input.clientId,
    connectionId: connection.id,
    organisationId,
    operationKey,
    kind: input.kind,
    quotationId: input.quotationId,
    userId: input.userId,
    reference: document.reference_number,
    details: {},
    takeover: true,
  });
  if ("status" in claim) return claim;
  if (!claim.owned) return json(409, { error: "This draft update is already in progress." });
  try {
    const body = await zohoBooksMutate(input.clientId, "PUT", path, { organization_id: organisationId }, review.payload);
    const echoed = parseCreatedDocument(input.kind, body, document.reference_number);
    const match = echoed ?? updatedMatch(input.kind, body, externalId, current);
    if (!match) {
      await setOperation(input.clientId, operationKey, { status: "uncertain", safeError: "Books answered without the linked document." });
      return json(409, { error: "Needs reconciliation. The update response could not be confirmed.", needsReconciliation: true });
    }
    return finishFromMatch({
      clientId: input.clientId,
      userId: input.userId,
      connection,
      quotationId: input.quotationId,
      kind: input.kind,
      operationKey,
      match,
      proposedTotal: review.proposedTotal,
      currencyCode: review.currency,
      eventType: "draft_updated",
    });
  } catch (error) {
    if (error instanceof ZohoBooksRequestError && error.uncertain) {
      await setOperation(input.clientId, operationKey, { status: "uncertain", safeError: error.message });
      return json(409, { error: error.message, needsReconciliation: true });
    }
    const message = error instanceof ZohoBooksRequestError ? error.message : "Zoho Books rejected the update.";
    await setOperation(input.clientId, operationKey, { status: "failed", safeError: message });
    if (error instanceof ZohoBooksRequestError) throw error;
    return json(502, { error: message });
  }
}

function updatedMatch(kind: DraftKind, body: unknown, expectedId: string, current: ReferenceMatch | null): ReferenceMatch | null {
  if (!current || !sameDocument(kind, body, expectedId)) return null;
  return {
    ...current,
    status: textStatus(body, kind) ?? current.status,
    total: totalFrom(kind, body) ?? current.total,
  };
}

function sameDocument(kind: DraftKind, body: unknown, expectedId: string): boolean {
  const row = documentRow(kind, body);
  if (!row) return false;
  const id = row[kind === "estimate" ? "estimate_id" : "invoice_id"];
  const textId = typeof id === "number" ? String(id) : typeof id === "string" ? id.trim() : "";
  return textId === expectedId;
}

function totalFrom(kind: DraftKind, body: unknown): number | null {
  const row = documentRow(kind, body);
  const total = row?.total;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  if (typeof total === "string" && total.trim()) {
    const parsed = Number(total);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function documentRow(kind: DraftKind, body: unknown): Record<string, unknown> | null {
  const wrapped = wrapDocument(kind, body);
  if (!wrapped || typeof wrapped !== "object") return null;
  const key = kind === "estimate" ? "estimate" : "invoice";
  const row = (wrapped as Record<string, unknown>)[key];
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  return row as Record<string, unknown>;
}

function wrapDocument(kind: DraftKind, body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const key = kind === "estimate" ? "estimate" : "invoice";
  if (key in (body as Record<string, unknown>)) return body;
  return { [key]: body };
}

function textStatus(body: unknown, kind: DraftKind): string | null {
  const wrapped = wrapDocument(kind, body);
  if (!wrapped || typeof wrapped !== "object") return null;
  const key = kind === "estimate" ? "estimate" : "invoice";
  const row = (wrapped as Record<string, unknown>)[key];
  if (!row || typeof row !== "object") return null;
  const status = (row as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}

export async function createBooksCustomer(input: {
  clientId: string;
  userId: string;
  quotationId: string;
  confirm: boolean;
}): Promise<DraftActionResult> {
  const connection = await loadConnection(input.clientId);
  if (!isConnection(connection)) return connection;
  const loaded = await loadQuote(input.clientId, input.quotationId);
  if ("status" in loaded) return loaded;
  const organisationId = connection.zoho_organization_id as string;
  if (!loaded.contact) return json(422, { error: "This quotation's lead has no SegmiQ contact." });
  if (loaded.customerLink && loaded.customerLink.zoho_organization_id !== organisationId) {
    return json(409, { error: "This contact is linked to a different Books organisation." });
  }
  if (loaded.customerLink?.zoho_organization_id === organisationId) {
    return json(200, { created: false, alreadyLinked: true, customerId: loaded.customerLink.external_id });
  }
  const blocker = customerCreateReady({ name: loaded.contact.name, email: loaded.contact.email, alreadyLinked: false });
  if (blocker) return json(422, { error: blocker });
  if (!input.confirm) return json(200, { created: false, customer: customerView(loaded.contact, false) });
  const email = loaded.contact.email!.trim();
  const operationKey = `customer:${organisationId}:${loaded.contact.id}`;
  const claim = await claimOperation({
    clientId: input.clientId,
    connectionId: connection.id,
    organisationId,
    operationKey,
    kind: "customer",
    quotationId: input.quotationId,
    userId: input.userId,
    reference: null,
    details: { email },
  });
  if ("status" in claim) return claim;
  if (!claim.owned) return reconcileBooksCustomer({ ...input, confirmNotCreated: false });
  let matches: string[] = [];
  let hasMore = false;
  try {
    const body = await zohoBooksRead(input.clientId, "/books/v3/contacts", {
      organization_id: organisationId,
      contact_type: "customer",
      email,
      per_page: "200",
    });
    matches = parseContactEmailMatches(body, email);
    hasMore = parseHasMore(body);
  } catch (error) {
    await setOperation(input.clientId, operationKey, { status: "failed", safeError: "Books customers could not be searched." });
    if (error instanceof ZohoBooksRequestError) throw error;
    return json(502, { error: "Books customers could not be searched. Nothing new was created." });
  }
  const pre = preCreateSearchDecision({ exactCount: matches.length, hasMore });
  if (pre === "adopt") {
    await linkCustomer(input.clientId, connection.id, organisationId, loaded.contact.id, matches[0]);
    await setOperation(input.clientId, operationKey, { status: "succeeded", externalId: matches[0] });
    await audit(input.clientId, input.userId, "customer_reconciled", {
      quotationId: input.quotationId,
      organizationId: organisationId,
      result: "linked",
      externalId: matches[0],
    });
    return json(200, { created: false, alreadyLinked: true, customerId: matches[0] });
  }
  if (pre !== "post") {
    await setOperation(input.clientId, operationKey, { status: "needs_reconciliation", safeError: "The customer search was not unique." });
    return json(409, { error: "Needs reconciliation. SegmiQ did not create another customer.", needsReconciliation: true, canRetry: false });
  }
  const payload = buildCustomerPayload({
    name: loaded.contact.name!.trim(),
    email,
    phone: loaded.contact.phone,
    company: loaded.contact.customer_type === "company",
  });
  try {
    const body = await zohoBooksMutate(input.clientId, "POST", "/books/v3/contacts", { organization_id: organisationId }, payload);
    const createdId = createdIdFrom(body);
    if (!createdId) {
      await setOperation(input.clientId, operationKey, { status: "uncertain", safeError: "Books answered without a customer id." });
      return json(409, { error: "Needs reconciliation. The customer response had no id.", needsReconciliation: true, canRetry: false });
    }
    const verified = parseVerifiedContact(body, createdId);
    if (!verified) {
      await setOperation(input.clientId, operationKey, { status: "uncertain", externalId: createdId, safeError: "Books created a contact that was not confirmed as a customer." });
      return json(409, { error: "Needs reconciliation. The new contact was not confirmed as a customer.", needsReconciliation: true, canRetry: false });
    }
    await linkCustomer(input.clientId, connection.id, organisationId, loaded.contact.id, verified.id);
    await setOperation(input.clientId, operationKey, { status: "succeeded", externalId: verified.id });
    await audit(input.clientId, input.userId, "customer_created", {
      quotationId: input.quotationId,
      organizationId: organisationId,
      result: "created",
      externalId: verified.id,
    });
    return json(200, { created: true, customerId: verified.id, currency: verified.currency });
  } catch (error) {
    if (error instanceof ZohoBooksRequestError && error.uncertain) {
      await setOperation(input.clientId, operationKey, { status: "uncertain", safeError: error.message });
      await audit(input.clientId, input.userId, "customer_uncertain", {
        quotationId: input.quotationId,
        organizationId: organisationId,
        result: "uncertain",
      });
      return json(409, { error: error.message, needsReconciliation: true, canRetry: false });
    }
    const message = error instanceof ZohoBooksRequestError ? error.message : "Zoho Books rejected the customer.";
    await setOperation(input.clientId, operationKey, { status: "failed", safeError: message });
    if (error instanceof ZohoBooksRequestError) throw error;
    return json(502, { error: message });
  }
}

function createdIdFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const contact = (body as { contact?: { contact_id?: unknown } }).contact;
  const id = contact?.contact_id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

async function linkCustomer(clientId: string, connectionId: string, organisationId: string, contactId: string, externalId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("zoho_books_record_links").insert({
    client_id: clientId,
    connection_id: connectionId,
    zoho_organization_id: organisationId,
    resource_type: "customer",
    external_id: externalId,
    segmiq_id: contactId,
  });
  if (error?.code === "23505") {
    const { data } = await supabase
      .from("zoho_books_record_links")
      .select("segmiq_id, zoho_organization_id")
      .eq("client_id", clientId)
      .eq("resource_type", "customer")
      .eq("external_id", externalId)
      .maybeSingle();
    const row = data as { segmiq_id: string | null; zoho_organization_id: string } | null;
    if (row?.segmiq_id === contactId && row.zoho_organization_id === organisationId) return;
    throw new ZohoBooksRequestError("The Books customer was created but it is already linked to a different record.", 409, false, { uncertain: true });
  }
  migrationOrThrow(error);
  if (error) throw new ZohoBooksRequestError("The Books customer was created but the SegmiQ link could not be stored.", 502, false, { uncertain: true });
}

export async function reconcileBooksCustomer(input: {
  clientId: string;
  userId: string;
  quotationId: string;
  confirmNotCreated: boolean;
}): Promise<DraftActionResult> {
  const connection = await loadConnection(input.clientId);
  if (!isConnection(connection)) return connection;
  const loaded = await loadQuote(input.clientId, input.quotationId);
  if ("status" in loaded) return loaded;
  if (!loaded.contact?.email) return json(422, { error: "The SegmiQ contact has no email to search for." });
  const organisationId = connection.zoho_organization_id as string;
  const operationKey = `customer:${organisationId}:${loaded.contact.id}`;
  const operation = await loadOperation(input.clientId, operationKey);
  if (!operation) return json(404, { error: "There is no customer operation to reconcile." });
  const email = typeof operation.details?.email === "string" ? operation.details.email : loaded.contact.email;
  let matches: string[] = [];
  let hasMore = false;
  try {
    const body = await zohoBooksRead(input.clientId, "/books/v3/contacts", {
      organization_id: organisationId,
      contact_type: "customer",
      email,
      per_page: "200",
    });
    matches = parseContactEmailMatches(body, email);
    hasMore = parseHasMore(body);
  } catch (error) {
    if (error instanceof ZohoBooksRequestError && !error.uncertain) throw error;
    return json(409, { error: "Books could not be searched. No customer was created.", needsReconciliation: true, canRetry: false });
  }
  const outcome = decideReconcile({
    search: matches.length === 1 ? "adopt" : matches.length === 0 ? "not_found" : "ambiguous",
    searchIncomplete: hasMore && matches.length === 0,
    confirmNotCreated: input.confirmNotCreated,
  });
  if (outcome === "adopt") {
    await linkCustomer(input.clientId, connection.id, organisationId, loaded.contact.id, matches[0]);
    await setOperation(input.clientId, operationKey, { status: "succeeded", externalId: matches[0] });
    return json(200, { created: false, alreadyLinked: true, customerId: matches[0] });
  }
  if (outcome === "clear_for_retry") {
    await setOperation(input.clientId, operationKey, { status: "failed", safeError: "A Books search found no customer with this email." });
    return json(200, { needsReconciliation: false, canRetry: true, found: 0 });
  }
  await setOperation(input.clientId, operationKey, { status: "needs_reconciliation", safeError: "The customer search was not unique." });
  return json(409, { error: "Needs reconciliation. SegmiQ did not create another customer.", needsReconciliation: true, canRetry: matches.length === 0 && !hasMore });
}
