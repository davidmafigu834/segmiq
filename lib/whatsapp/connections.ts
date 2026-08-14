import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWhatsAppSendConfig } from "./credentials";
import { isTemporaryWhatsAppFeatureEnabled } from "./feature-flags";
import { getWhatsAppCapabilities } from "./providers/capabilities";
import { assertWhatsAppConnectionTransition } from "./providers/state-machine";
import type {
  SafeWhatsAppConnection,
  WhatsAppConnectionRecord,
  WhatsAppConnectionState,
  WhatsAppProviderType,
} from "./providers/types";
import { decryptWhatsAppSecret, encryptWhatsAppSecret, type EncryptedEnvelope } from "./security/secret-envelope";

type ConnectionRow = {
  id: string;
  client_id: string;
  provider_type: WhatsAppProviderType;
  status: WhatsAppConnectionState;
  is_primary: boolean;
  display_name: string | null;
  phone_number: string | null;
  provider_account_id: string | null;
  connected_at: string | null;
  last_seen_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
};

function mapConnection(row: ConnectionRow): WhatsAppConnectionRecord {
  return {
    id: row.id,
    clientId: row.client_id,
    providerType: row.provider_type,
    status: row.status,
    isPrimary: row.is_primary,
    displayName: row.display_name,
    phoneNumber: row.phone_number,
    providerAccountId: row.provider_account_id,
    connectedAt: row.connected_at,
    lastSeenAt: row.last_seen_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
  };
}

function safeErrorMessage(message: string | null): string | null {
  if (!message) return null;
  return message.replace(/(?:token|secret|credential|session)\s*[:=]\s*\S+/gi, "$1 [redacted]").slice(0, 240);
}

export async function getPrimaryWhatsAppConnection(clientId: string): Promise<WhatsAppConnectionRecord | null> {
  const { data, error } = await createAdminClient()
    .from("whatsapp_connections")
    .select("id, client_id, provider_type, status, is_primary, display_name, phone_number, provider_account_id, connected_at, last_seen_at, last_error_code, last_error_message")
    .eq("client_id", clientId)
    .eq("is_primary", true)
    .maybeSingle();
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return data ? mapConnection(data as ConnectionRow) : null;
}

export async function getWhatsAppConnectionById(connectionId: string): Promise<WhatsAppConnectionRecord | null> {
  const { data, error } = await createAdminClient()
    .from("whatsapp_connections")
    .select("id, client_id, provider_type, status, is_primary, display_name, phone_number, provider_account_id, connected_at, last_seen_at, last_error_code, last_error_message")
    .eq("id", connectionId)
    .maybeSingle();
  if (error || !data) return null;
  return mapConnection(data as ConnectionRow);
}

export async function getSafeWhatsAppConnection(clientId: string): Promise<SafeWhatsAppConnection> {
  const supabase = createAdminClient();
  const [{ data: client }, connection, metaConfig] = await Promise.all([
    supabase
      .from("clients")
      .select("whatsapp_temporary_web_enabled")
      .eq("id", clientId)
      .maybeSingle(),
    getPrimaryWhatsAppConnection(clientId),
    resolveWhatsAppSendConfig(clientId),
  ]);
  const temporaryBetaEligible = Boolean(client?.whatsapp_temporary_web_enabled);
  const temporaryFeatureEnabled = isTemporaryWhatsAppFeatureEnabled();

  if (!connection) {
    const configured = Boolean(metaConfig);
    return {
      configured,
      connectionId: null,
      providerType: configured ? "META_CLOUD" : null,
      providerLabel: configured ? "Meta Cloud API" : "Not connected",
      status: configured ? "CONNECTED" : "DISCONNECTED",
      connected: configured,
      displayName: null,
      phoneNumber: metaConfig?.displayNumber ?? null,
      connectedAt: null,
      lastSeenAt: null,
      error: null,
      capabilities: getWhatsAppCapabilities(configured ? "META_CLOUD" : null),
      temporaryBetaEligible,
      temporaryFeatureEnabled,
    };
  }

  const errorMessage = safeErrorMessage(connection.lastErrorMessage);
  return {
    configured: true,
    connectionId: connection.id,
    providerType: connection.providerType,
    providerLabel:
      connection.providerType === "TEMPORARY_WEB"
        ? "Quick connection"
        : connection.providerType === "META_COEXISTENCE"
          ? "Meta Coexistence"
          : "Meta Cloud API",
    status: connection.status,
    connected: connection.status === "CONNECTED" || connection.status === "DEGRADED",
    displayName: connection.displayName,
    phoneNumber: connection.phoneNumber,
    connectedAt: connection.connectedAt,
    lastSeenAt: connection.lastSeenAt,
    error: errorMessage
      ? { code: connection.lastErrorCode, message: errorMessage }
      : null,
    capabilities: getWhatsAppCapabilities(connection.providerType),
    temporaryBetaEligible,
    temporaryFeatureEnabled,
  };
}

export async function createOrResetTemporaryConnection(input: {
  clientId: string;
  actorId: string;
}): Promise<WhatsAppConnectionRecord> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("whatsapp_connections")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("provider_type", "TEMPORARY_WEB")
    .maybeSingle();

  await supabase.from("whatsapp_connections").update({ is_primary: false }).eq("client_id", input.clientId);
  const now = new Date().toISOString();
  const payload = {
    client_id: input.clientId,
    provider_type: "TEMPORARY_WEB",
    status: "INITIALIZING",
    is_primary: true,
    created_by: input.actorId,
    last_requested_at: now,
    last_error_code: null,
    last_error_message: null,
    reconnect_attempts: 0,
    updated_at: now,
  };
  const query = existing
    ? supabase.from("whatsapp_connections").update(payload).eq("id", existing.id)
    : supabase.from("whatsapp_connections").insert(payload);
  const { data, error } = await query
    .select("id, client_id, provider_type, status, is_primary, display_name, phone_number, provider_account_id, connected_at, last_seen_at, last_error_code, last_error_message")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create WhatsApp connection");
  await recordWhatsAppConnectionEvent({
    connectionId: data.id as string,
    clientId: input.clientId,
    actorId: input.actorId,
    eventType: existing ? "CONNECTION_RESET_REQUESTED" : "CONNECTION_CREATED",
  });
  return mapConnection(data as ConnectionRow);
}

export async function transitionWhatsAppConnection(input: {
  connectionId: string;
  to: WhatsAppConnectionState;
  displayName?: string | null;
  phoneNumber?: string | null;
  providerAccountId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<WhatsAppConnectionRecord> {
  const current = await getWhatsAppConnectionById(input.connectionId);
  if (!current) throw new Error("WhatsApp connection not found");
  assertWhatsAppConnectionTransition(current.status, input.to);
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: input.to,
    updated_at: now,
    last_seen_at: now,
    last_error_code: input.errorCode ?? null,
    last_error_message: safeErrorMessage(input.errorMessage ?? null),
  };
  if (input.displayName !== undefined) update.display_name = input.displayName;
  if (input.phoneNumber !== undefined) update.phone_number = input.phoneNumber;
  if (input.providerAccountId !== undefined) update.provider_account_id = input.providerAccountId;
  if (input.to === "CONNECTED") {
    update.connected_at = current.connectedAt ?? now;
    update.disconnected_at = null;
    update.reconnect_attempts = 0;
  }
  if (input.to === "DISCONNECTED") update.disconnected_at = now;

  const { data, error } = await createAdminClient()
    .from("whatsapp_connections")
    .update(update)
    .eq("id", input.connectionId)
    .select("id, client_id, provider_type, status, is_primary, display_name, phone_number, provider_account_id, connected_at, last_seen_at, last_error_code, last_error_message")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not update WhatsApp connection");
  return mapConnection(data as ConnectionRow);
}

export async function storeWhatsAppQr(input: {
  connectionId: string;
  clientId: string;
  qr: string;
  expiresAt: string;
}): Promise<void> {
  const envelope = await encryptWhatsAppSecret(input.qr, `qr:${input.connectionId}:${input.clientId}`);
  const { error } = await createAdminClient().from("whatsapp_connection_qr_challenges").upsert({
    connection_id: input.connectionId,
    qr_ciphertext: envelope.ciphertext,
    qr_iv: envelope.iv,
    qr_auth_tag: envelope.authTag,
    key_version: envelope.keyVersion,
    expires_at: input.expiresAt,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function readWhatsAppQrChallenge(connectionId: string, clientId: string): Promise<{
  qr: string | null;
  expiresAt: string | null;
}> {
  const { data } = await createAdminClient()
    .from("whatsapp_connection_qr_challenges")
    .select("qr_ciphertext, qr_iv, qr_auth_tag, key_version, expires_at")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (!data) return { qr: null, expiresAt: null };
  const expiresAt = data.expires_at as string;
  if (new Date(expiresAt).getTime() <= Date.now()) return { qr: null, expiresAt };
  return {
    qr: await decryptWhatsAppSecret(
      {
        ciphertext: data.qr_ciphertext as string,
        iv: data.qr_iv as string,
        authTag: data.qr_auth_tag as string,
        keyVersion: data.key_version as number,
      },
      `qr:${connectionId}:${clientId}`
    ),
    expiresAt,
  };
}

export async function readWhatsAppQr(connectionId: string, clientId: string): Promise<string | null> {
  return (await readWhatsAppQrChallenge(connectionId, clientId)).qr;
}

export async function deleteWhatsAppQr(connectionId: string): Promise<void> {
  await createAdminClient().from("whatsapp_connection_qr_challenges").delete().eq("connection_id", connectionId);
}

export async function storeWhatsAppSession(input: {
  connectionId: string;
  clientId: string;
  serializedSession: string;
}): Promise<void> {
  const envelope = await encryptWhatsAppSecret(input.serializedSession, `session:${input.connectionId}:${input.clientId}`);
  const { error } = await createAdminClient()
    .from("whatsapp_connections")
    .update({
      session_ciphertext: envelope.ciphertext,
      session_iv: envelope.iv,
      session_auth_tag: envelope.authTag,
      session_key_version: envelope.keyVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.connectionId)
    .eq("client_id", input.clientId);
  if (error) throw new Error(error.message);
}

export async function readWhatsAppSession(connectionId: string): Promise<{
  clientId: string;
  serializedSession: string | null;
} | null> {
  const { data } = await createAdminClient()
    .from("whatsapp_connections")
    .select("client_id, session_ciphertext, session_iv, session_auth_tag, session_key_version")
    .eq("id", connectionId)
    .maybeSingle();
  if (!data) return null;
  const clientId = data.client_id as string;
  if (!data.session_ciphertext || !data.session_iv || !data.session_auth_tag) {
    return { clientId, serializedSession: null };
  }
  const envelope: EncryptedEnvelope = {
    ciphertext: data.session_ciphertext as string,
    iv: data.session_iv as string,
    authTag: data.session_auth_tag as string,
    keyVersion: data.session_key_version as number,
  };
  return {
    clientId,
    serializedSession: await decryptWhatsAppSecret(envelope, `session:${connectionId}:${clientId}`),
  };
}

export async function clearWhatsAppSession(connectionId: string): Promise<void> {
  await Promise.all([
    createAdminClient().from("whatsapp_connections").update({
      session_ciphertext: null,
      session_iv: null,
      session_auth_tag: null,
      provider_account_id: null,
      updated_at: new Date().toISOString(),
    }).eq("id", connectionId),
    deleteWhatsAppQr(connectionId),
  ]);
}

export async function recordWhatsAppConnectionEvent(input: {
  connectionId: string;
  clientId: string;
  eventType: string;
  actorId?: string | null;
  safeDetails?: Record<string, unknown>;
}): Promise<void> {
  await createAdminClient().from("whatsapp_connection_events").insert({
    connection_id: input.connectionId,
    client_id: input.clientId,
    event_type: input.eventType,
    actor_id: input.actorId ?? null,
    safe_details: input.safeDetails ?? {},
  });
}

export async function consumeGatewayNonce(nonce: string, expiresAt: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("whatsapp_gateway_nonces").insert({ nonce, expires_at: expiresAt });
  void supabase.from("whatsapp_gateway_nonces").delete().lt("expires_at", new Date().toISOString());
  return !error;
}
