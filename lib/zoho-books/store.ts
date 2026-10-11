import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { zohoBooksGet, zohoBooksGetWithBackoff, zohoBooksWrite, ZohoBooksRequestError } from "./http";
import {
  accessTokenNeedsRefresh,
  buildRevokeRequest,
  buildTokenRequest,
  evaluateOAuthState,
  isRevokedZohoTokenError,
  OAUTH_STATE_TTL_MS,
  draftWritesGranted,
  invoiceReadsGranted,
  parseCustomerPreview,
  parseHasMore,
  parseItemPreview,
  parseOrganisations,
  parseTokenResponse,
  ZOHO_BOOKS_SCOPES,
  type OAuthStateDecision,
  type ZohoCustomerPreview,
  type ZohoItemPreview,
  type ZohoOrganisation,
} from "./protocol";
import { regionByLocation, type ZohoRegion } from "./regions";
import { revealZohoToken, sealZohoToken } from "./secrets";
import { decideOrganisationSelection } from "./selection";
import { customerListQuery, itemListQuery } from "./import-plan";
import { readZohoBooksConfig } from "./config";

type ConnectionRow = {
  id: string;
  client_id: string;
  status: "pending_organisation" | "connected" | "reconnect_required" | "disconnected";
  zoho_organization_id: string | null;
  zoho_organization_name: string | null;
  accounts_server: string | null;
  api_domain: string | null;
  location: string | null;
  access_token_sealed: string | null;
  refresh_token_sealed: string | null;
  scopes: string[] | null;
  access_token_expires_at: string | null;
  refresh_lock_until: string | null;
  connected_at: string | null;
  last_tested_at: string | null;
  last_error: string | null;
  sync_enabled: boolean;
};

export type PublicZohoConnection = {
  status: ConnectionRow["status"];
  organizationId: string | null;
  organizationName: string | null;
  regionLabel: string | null;
  location: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
  syncEnabled: boolean;
  invoiceReadsGranted: boolean;
  draftWritesGranted: boolean;
};

function toPublic(row: ConnectionRow): PublicZohoConnection {
  const region = regionByLocation(row.location);
  return {
    status: row.status,
    organizationId: row.zoho_organization_id,
    organizationName: row.zoho_organization_name,
    regionLabel: region?.label ?? null,
    location: row.location,
    lastTestedAt: row.last_tested_at,
    lastError: row.last_error,
    connectedAt: row.connected_at,
    syncEnabled: row.sync_enabled === true,
    invoiceReadsGranted: invoiceReadsGranted(row.scopes),
    draftWritesGranted: draftWritesGranted(row.scopes),
  };
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || /zoho_books_/i.test(error.message ?? "");
}

async function loadConnection(clientId: string): Promise<ConnectionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zoho_books_connections")
    .select(
      "id, client_id, status, zoho_organization_id, zoho_organization_name, accounts_server, api_domain, location, scopes, access_token_sealed, refresh_token_sealed, access_token_expires_at, refresh_lock_until, connected_at, last_tested_at, last_error, sync_enabled"
    )
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      const missing = new Error("migration_required");
      missing.name = "ZohoMigrationRequired";
      throw missing;
    }
    throw new Error("Could not load the Zoho Books connection.");
  }
  return (data as ConnectionRow | null) ?? null;
}

export async function readPublicConnection(clientId: string): Promise<PublicZohoConnection | null> {
  const row = await loadConnection(clientId);
  return row ? toPublic(row) : null;
}

export async function recordZohoEvent(
  clientId: string,
  actorUserId: string | null,
  eventType: string,
  metadata: Record<string, string | boolean | null>
) {
  await logEvent(clientId, actorUserId, eventType, metadata);
}

async function logEvent(clientId: string, actorUserId: string | null, eventType: string, metadata: Record<string, string | boolean | null>) {
  const supabase = createAdminClient();
  await supabase.from("zoho_books_events").insert({
    client_id: clientId,
    actor_user_id: actorUserId,
    event_type: eventType,
    metadata,
  });
}

export async function createOAuthState(input: {
  rawState: string;
  clientId: string;
  userId: string;
  sessionId: string;
}): Promise<void> {
  const supabase = createAdminClient();
  const stateHash = createHash("sha256").update(input.rawState).digest("hex");
  const now = new Date().toISOString();
  await supabase
    .from("zoho_books_oauth_states")
    .delete()
    .eq("client_id", input.clientId)
    .eq("user_id", input.userId)
    .lt("expires_at", now);
  const { error } = await supabase.from("zoho_books_oauth_states").insert({
    state_hash: stateHash,
    client_id: input.clientId,
    user_id: input.userId,
    session_id: input.sessionId,
    expires_at: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
  });
  if (error) throw new Error("Could not start the Zoho Books connection.");
}

export async function consumeOAuthState(input: {
  rawState: string;
  session: { userId: string; clientId: string; sessionId: string };
}): Promise<OAuthStateDecision> {
  const supabase = createAdminClient();
  const stateHash = createHash("sha256").update(input.rawState).digest("hex");
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("zoho_books_oauth_states")
    .update({ consumed_at: nowIso })
    .eq("state_hash", stateHash)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("client_id, user_id, session_id, expires_at")
    .maybeSingle();
  if (data) {
    return evaluateOAuthState({
      record: {
        userId: String(data.user_id),
        clientId: String(data.client_id),
        sessionId: String(data.session_id),
        expiresAt: String(data.expires_at),
        consumedAt: null,
      },
      now: Date.now(),
      session: input.session,
    });
  }
  const { data: existing } = await supabase
    .from("zoho_books_oauth_states")
    .select("client_id, user_id, session_id, expires_at, consumed_at")
    .eq("state_hash", stateHash)
    .maybeSingle();
  return evaluateOAuthState({
    record: existing
      ? {
          userId: String(existing.user_id),
          clientId: String(existing.client_id),
          sessionId: String(existing.session_id),
          expiresAt: String(existing.expires_at),
          consumedAt: existing.consumed_at ? String(existing.consumed_at) : null,
        }
      : null,
    now: Date.now(),
    session: input.session,
  });
}

export async function saveGrantedTokens(input: {
  clientId: string;
  userId: string;
  region: ZohoRegion;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<void> {
  const accessTokenSealed = await sealZohoToken(input.accessToken, "zoho_books_access", input.clientId);
  const refreshTokenSealed = await sealZohoToken(input.refreshToken, "zoho_books_refresh", input.clientId);
  const now = new Date().toISOString();
  const payload = {
    status: "pending_organisation",
    accounts_server: input.region.accounts,
    api_domain: input.region.api,
    location: input.region.location,
    scopes: [...ZOHO_BOOKS_SCOPES],
    refresh_token_sealed: refreshTokenSealed,
    access_token_sealed: accessTokenSealed,
    access_token_expires_at: new Date(Date.now() + input.expiresIn * 1000).toISOString(),
    refresh_lock_until: null,
    connected_by_user_id: input.userId,
    last_error: null,
    disconnected_at: null,
    sync_enabled: false,
    updated_at: now,
  };
  const supabase = createAdminClient();
  const existing = await loadConnection(input.clientId);
  if (existing) {
    const { error } = await supabase.from("zoho_books_connections").update(payload).eq("client_id", input.clientId);
    if (error) throw new Error("Could not store the Zoho Books connection.");
  } else {
    const { error } = await supabase.from("zoho_books_connections").insert({ ...payload, client_id: input.clientId });
    if (error) throw new Error("Could not store the Zoho Books connection.");
  }
  await logEvent(input.clientId, input.userId, "oauth_granted", { location: input.region.location });
}

async function markReconnect(clientId: string, message: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("zoho_books_connections")
    .update({
      status: "reconnect_required",
      access_token_sealed: null,
      access_token_expires_at: null,
      refresh_lock_until: null,
      last_error: message,
      sync_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId);
}

async function claimRefreshLock(clientId: string, previousLock: string | null): Promise<boolean> {
  const supabase = createAdminClient();
  const lockUntil = new Date(Date.now() + 30_000).toISOString();
  let query = supabase
    .from("zoho_books_connections")
    .update({ refresh_lock_until: lockUntil, updated_at: new Date().toISOString() })
    .eq("client_id", clientId);
  query = previousLock ? query.eq("refresh_lock_until", previousLock) : query.is("refresh_lock_until", null);
  const { data } = await query.select("id").maybeSingle();
  return Boolean(data);
}

async function refreshAccessToken(row: ConnectionRow): Promise<string> {
  const config = readZohoBooksConfig();
  if (!config || !row.accounts_server || !row.refresh_token_sealed) {
    await markReconnect(row.client_id, "Reconnect Zoho Books to continue.");
    throw new ZohoBooksRequestError("Reconnect Zoho Books to continue.", 401, true);
  }
  const refreshToken = await revealZohoToken(row.refresh_token_sealed, "zoho_books_refresh", row.client_id);
  if (!refreshToken) {
    await markReconnect(row.client_id, "Reconnect Zoho Books to continue.");
    throw new ZohoBooksRequestError("Reconnect Zoho Books to continue.", 401, true);
  }
  const request = buildTokenRequest(row.accounts_server, {
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });
  if (!request) {
    await markReconnect(row.client_id, "The Zoho Books region is not supported.");
    throw new ZohoBooksRequestError("The Zoho Books region is not supported.", 0, false);
  }
  const response = await fetch(request.url, { method: "POST", cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || isRevokedZohoTokenError(response.status, body)) {
    await markReconnect(row.client_id, "Zoho Books access was revoked. Reconnect is required.");
    throw new ZohoBooksRequestError("Zoho Books access was revoked. Reconnect is required.", response.status, true);
  }
  const parsed = parseTokenResponse(body);
  if (!parsed) {
    throw new ZohoBooksRequestError("Zoho Books could not be reached.", response.status, false);
  }
  const sealed = await sealZohoToken(parsed.accessToken, "zoho_books_access", row.client_id);
  const supabase = createAdminClient();
  await supabase
    .from("zoho_books_connections")
    .update({
      access_token_sealed: sealed,
      access_token_expires_at: new Date(Date.now() + parsed.expiresIn * 1000).toISOString(),
      api_domain: parsed.region.api,
      location: parsed.region.location,
      refresh_lock_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", row.client_id);
  return parsed.accessToken;
}

export async function getAccessToken(clientId: string): Promise<{ apiDomain: string; accessToken: string; row: ConnectionRow }> {
  let row = await loadConnection(clientId);
  if (!row || row.status === "disconnected" || !row.api_domain) {
    throw new ZohoBooksRequestError("Zoho Books is not connected.", 409, false);
  }
  if (row.status === "reconnect_required") {
    throw new ZohoBooksRequestError(row.last_error || "Reconnect Zoho Books to continue.", 401, true);
  }
  if (!accessTokenNeedsRefresh(row.access_token_expires_at, Date.now()) && row.access_token_sealed) {
    const accessToken = await revealZohoToken(row.access_token_sealed, "zoho_books_access", clientId);
    if (accessToken) return { apiDomain: row.api_domain, accessToken, row };
  }
  const lockStillHeld = row.refresh_lock_until && new Date(row.refresh_lock_until).getTime() > Date.now();
  if (!lockStillHeld) {
    const claimed = await claimRefreshLock(clientId, row.refresh_lock_until);
    if (claimed) {
      const latest = await loadConnection(clientId);
      if (!latest) throw new ZohoBooksRequestError("Zoho Books is not connected.", 409, false);
      const accessToken = await refreshAccessToken(latest);
      const refreshed = await loadConnection(clientId);
      if (!refreshed?.api_domain) throw new ZohoBooksRequestError("Zoho Books is not connected.", 409, false);
      return { apiDomain: refreshed.api_domain, accessToken, row: refreshed };
    }
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    row = await loadConnection(clientId);
    if (!row?.api_domain) throw new ZohoBooksRequestError("Zoho Books is not connected.", 409, false);
    if (row.status === "reconnect_required") {
      throw new ZohoBooksRequestError(row.last_error || "Reconnect Zoho Books to continue.", 401, true);
    }
    if (!accessTokenNeedsRefresh(row.access_token_expires_at, Date.now()) && row.access_token_sealed) {
      const accessToken = await revealZohoToken(row.access_token_sealed, "zoho_books_access", clientId);
      if (accessToken) return { apiDomain: row.api_domain, accessToken, row };
    }
  }
  throw new ZohoBooksRequestError("Zoho Books is refreshing the connection. Try again.", 429, false);
}

async function withToken<T>(clientId: string, run: (ctx: { apiDomain: string; accessToken: string; row: ConnectionRow }) => Promise<T>): Promise<T> {
  try {
    const ctx = await getAccessToken(clientId);
    return await run(ctx);
  } catch (error) {
    if (error instanceof ZohoBooksRequestError && error.revoked) {
      await markReconnect(clientId, error.message);
    }
    throw error;
  }
}

export async function listAuthorisedOrganisations(clientId: string): Promise<ZohoOrganisation[]> {
  return withToken(clientId, async ({ apiDomain, accessToken }) => {
    const body = await zohoBooksGet({ apiDomain, accessToken, path: "/books/v3/organizations" });
    return parseOrganisations(body);
  });
}

export async function selectOrganisation(input: {
  clientId: string;
  userId: string;
  organizationId: string;
  confirmChange: boolean;
}): Promise<PublicZohoConnection> {
  const current = await loadConnection(input.clientId);
  if (!current) throw new ZohoBooksRequestError("Zoho Books is not connected.", 409, false);
  const authorised = await listAuthorisedOrganisations(input.clientId);
  const supabase = createAdminClient();
  const [{ data: otherConnection }, { data: otherClaim }] = await Promise.all([
    supabase
      .from("zoho_books_connections")
      .select("client_id")
      .eq("zoho_organization_id", input.organizationId)
      .neq("client_id", input.clientId)
      .maybeSingle(),
    supabase
      .from("zoho_books_organization_claims")
      .select("client_id")
      .eq("zoho_organization_id", input.organizationId)
      .neq("client_id", input.clientId)
      .maybeSingle(),
  ]);
  const decision = decideOrganisationSelection({
    requestedId: input.organizationId,
    authorised,
    currentId: current.zoho_organization_id,
    confirmChange: input.confirmChange,
    claimedByOtherCompany: Boolean(otherConnection || otherClaim),
  });
  if (!decision.ok) {
    const message =
      decision.reason === "change_confirmation_required"
        ? "Confirm the change before switching Zoho Books organisation."
        : decision.reason === "claimed_by_other_company"
          ? "That Zoho Books organisation is already reserved for another company."
          : "Choose an organisation from the list Zoho returned.";
    throw new ZohoBooksRequestError(message, 409, false);
  }
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("zoho_books_connections")
    .update({
      zoho_organization_id: input.organizationId,
      zoho_organization_name: decision.name,
      status: "connected",
      connected_at: current.connected_at ?? now,
      connected_by_user_id: input.userId,
      last_error: null,
      disconnected_at: null,
      sync_enabled: false,
      updated_at: now,
    })
    .eq("client_id", input.clientId);
  if (error) throw new ZohoBooksRequestError("Could not save the Zoho Books organisation.", 409, false);
  await supabase.from("zoho_books_organization_claims").upsert(
    {
      zoho_organization_id: input.organizationId,
      client_id: input.clientId,
    },
    { onConflict: "zoho_organization_id" }
  );
  if (decision.changed && current.zoho_organization_id) {
    const { count } = await supabase
      .from("zoho_books_record_links")
      .select("id", { count: "exact", head: true })
      .eq("client_id", input.clientId)
      .eq("zoho_organization_id", current.zoho_organization_id);
    if (!count) {
      await supabase
        .from("zoho_books_organization_claims")
        .delete()
        .eq("client_id", input.clientId)
        .eq("zoho_organization_id", current.zoho_organization_id);
    }
  }
  await logEvent(input.clientId, input.userId, decision.changed ? "organisation_changed" : "organisation_selected", {
    organizationId: input.organizationId,
  });
  const saved = await loadConnection(input.clientId);
  if (!saved) throw new ZohoBooksRequestError("Zoho Books is not connected.", 409, false);
  return toPublic(saved);
}

export async function testConnection(clientId: string, userId: string): Promise<PublicZohoConnection> {
  const current = await loadConnection(clientId);
  if (!current?.zoho_organization_id || current.status !== "connected") {
    throw new ZohoBooksRequestError("Choose a Zoho Books organisation before testing the connection.", 409, false);
  }
  try {
    const orgs = await listAuthorisedOrganisations(clientId);
    const match = orgs.find((org) => org.id === current.zoho_organization_id);
    const supabase = createAdminClient();
    if (!match) {
      await supabase
        .from("zoho_books_connections")
        .update({
          last_error: "The selected Zoho Books organisation is no longer available on this login.",
          updated_at: new Date().toISOString(),
        })
        .eq("client_id", clientId);
      throw new ZohoBooksRequestError("The selected Zoho Books organisation is no longer available on this login.", 409, false);
    }
    const now = new Date().toISOString();
    await supabase
      .from("zoho_books_connections")
      .update({
        zoho_organization_name: match.name,
        last_tested_at: now,
        last_error: null,
        updated_at: now,
      })
      .eq("client_id", clientId);
    await logEvent(clientId, userId, "connection_tested", { organizationId: match.id });
  } catch (error) {
    if (error instanceof ZohoBooksRequestError && !error.revoked) {
      await logEvent(clientId, userId, "connection_test_failed", { message: error.message });
    }
    throw error;
  }
  const saved = await loadConnection(clientId);
  if (!saved) throw new ZohoBooksRequestError("Zoho Books is not connected.", 409, false);
  return toPublic(saved);
}

export async function zohoBooksRead(clientId: string, path: string, query: Record<string, string>): Promise<unknown> {
  return withToken(clientId, ({ apiDomain, accessToken }) =>
    zohoBooksGetWithBackoff({ apiDomain, accessToken, path, query })
  );
}

export async function zohoBooksMutate(
  clientId: string,
  method: "POST" | "PUT",
  path: string,
  query: Record<string, string>,
  body: Record<string, unknown>
): Promise<unknown> {
  return withToken(clientId, ({ apiDomain, accessToken }) =>
    zohoBooksWrite({ apiDomain, accessToken, method, path, query, body })
  );
}

export async function previewBooks(
  clientId: string,
  pages?: { customerPage?: number; itemPage?: number }
): Promise<{
  customers: ZohoCustomerPreview[];
  items: ZohoItemPreview[];
  customerPage: number;
  itemPage: number;
  customersHaveMore: boolean;
  itemsHaveMore: boolean;
}> {
  const current = await loadConnection(clientId);
  if (!current?.zoho_organization_id || current.status !== "connected") {
    throw new ZohoBooksRequestError("Choose a Zoho Books organisation before previewing records.", 409, false);
  }
  const organizationId = current.zoho_organization_id;
  const customerPage = pages?.customerPage ?? 1;
  const itemPage = pages?.itemPage ?? 1;
  return withToken(clientId, async ({ apiDomain, accessToken }) => {
    const [customersBody, itemsBody] = await Promise.all([
      zohoBooksGetWithBackoff({
        apiDomain,
        accessToken,
        path: "/books/v3/contacts",
        query: customerListQuery(organizationId, customerPage),
      }),
      zohoBooksGetWithBackoff({
        apiDomain,
        accessToken,
        path: "/books/v3/items",
        query: itemListQuery(organizationId, itemPage),
      }),
    ]);
    return {
      customers: parseCustomerPreview(customersBody, 5),
      items: parseItemPreview(itemsBody, 5),
      customerPage,
      itemPage,
      customersHaveMore: parseHasMore(customersBody),
      itemsHaveMore: parseHasMore(itemsBody),
    };
  });
}

export async function disconnectZohoBooks(clientId: string, userId: string): Promise<PublicZohoConnection | null> {
  const row = await loadConnection(clientId);
  if (!row) return null;
  const config = readZohoBooksConfig();
  if (config && row.accounts_server && row.refresh_token_sealed) {
    try {
      const refreshToken = await revealZohoToken(row.refresh_token_sealed, "zoho_books_refresh", clientId);
      const request = refreshToken ? buildRevokeRequest(row.accounts_server, refreshToken) : null;
      if (request) {
        await fetch(request.url, { method: "POST", cache: "no-store" });
      }
    } catch {
      // Local disconnect still proceeds when Zoho cannot be reached.
    }
  }
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  await supabase
    .from("zoho_books_connections")
    .update({
      status: "disconnected",
      access_token_sealed: null,
      refresh_token_sealed: null,
      access_token_expires_at: null,
      refresh_lock_until: null,
      disconnected_at: now,
      sync_enabled: false,
      last_error: null,
      updated_at: now,
    })
    .eq("client_id", clientId);
  await logEvent(clientId, userId, "disconnected", { organizationId: row.zoho_organization_id });
  const saved = await loadConnection(clientId);
  return saved ? toPublic(saved) : null;
}

export function migrationRequired(error: unknown): boolean {
  return error instanceof Error && error.name === "ZohoMigrationRequired";
}
