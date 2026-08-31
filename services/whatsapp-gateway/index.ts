import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
// `@next/env` is CommonJS and exposes no named ESM exports, so it is imported
// through the default interop rather than destructured.
import nextEnv from "@next/env";
import makeWASocket, {
  BufferJSON,
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  type AuthenticationState,
  type SignalDataTypeMap,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import {
  digitsFromJid,
  isLiveUpsertType,
  isSelfWhatsAppChat,
  messageTimestampMs,
  phoneFromWhatsAppKey,
  unwrapWhatsAppContent,
} from "../../lib/whatsapp/gateway-message";
import {
  pairingAfterLoggedOut,
  pairingForAdminConnect,
  pairingForAutoRetry,
  pairingForRestore,
  type WhatsAppPairingDecision,
} from "../../lib/whatsapp/pairing-policy";
// The shared signing module lives in the CommonJS half of the repository, so
// Node cannot statically see its named exports from this ES module. Requiring
// it keeps the gateway on exactly the implementation the web app verifies
// against, instead of duplicating the signing rules.
const requireCommonJs = createRequire(import.meta.url);
const { signGatewayRequest, verifyGatewayRequest } = requireCommonJs(
  "../../lib/whatsapp/security/gateway-auth"
) as typeof import("../../lib/whatsapp/security/gateway-auth");

// `next dev` loads .env.local automatically; this standalone long-running
// gateway needs to load the same local configuration when run via npm.
nextEnv.loadEnvConfig(process.cwd());

type StoredAuth = {
  creds: AuthenticationState["creds"];
  keys: Partial<Record<keyof SignalDataTypeMap, Record<string, unknown>>>;
};

const SESSION_PERSIST_DEBOUNCE_MS = 5_000;

type ManagedSession = {
  connectionId: string;
  clientId: string;
  socket: WASocket;
  auth: StoredAuth;
  acceptAfter: number;
  reconnectAttempts: number;
  closing: boolean;
  open: boolean;
  persistTimer: ReturnType<typeof setTimeout> | null;
  persistQueued: boolean;
  /**
   * Only an admin-initiated connect may surface a QR code. When a restore or
   * automatic reconnect is asked to re-pair, the stored session no longer
   * authorizes the device and the connection needs admin attention instead.
   */
  allowQr: boolean;
  freshPairing: boolean;
  sentByGateway: Set<string>;
  recentManualSendTimestamps: number[];
  recentMessages: Map<string, WAMessage["message"]>;
};

const sessions = new Map<string, ManagedSession>();
const replayNonces = new Map<string, number>();
const port = Number(process.env.PORT || process.env.WHATSAPP_GATEWAY_PORT || 8787);
const appBase = required("SEGMIQ_INTERNAL_BASE_URL").replace(/\/$/, "");
const maxManualSendsPerMinute = Math.max(
  1,
  Number.parseInt(process.env.WHATSAPP_GATEWAY_MAX_SENDS_PER_MINUTE || "30", 10) || 30
);
const heartbeatIntervalMs = Math.max(
  30_000,
  Number.parseInt(process.env.WHATSAPP_GATEWAY_HEARTBEAT_SECONDS || "60", 10) * 1_000 || 60_000
);
const logger = {
  level: "silent",
  child: () => logger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: (...args: unknown[]) => console.warn("[whatsapp-gateway]", ...args),
  error: (...args: unknown[]) => console.error("[whatsapp-gateway]", ...args),
} as never;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function json(response: ServerResponse, status: number, payload: Record<string, unknown>): void {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function readBody(request: IncomingMessage, maxBytes = 24 * 1024 * 1024): Promise<string> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part);
    size += buffer.length;
    if (size > maxBytes) throw new Error("Request body too large");
    parts.push(buffer);
  }
  return Buffer.concat(parts).toString("utf8");
}

async function authenticate(request: IncomingMessage, path: string, body: string): Promise<boolean> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(","));
  }
  let result: Awaited<ReturnType<typeof verifyGatewayRequest>>;
  try {
    result = await verifyGatewayRequest({ headers, method: request.method ?? "GET", path, body });
  } catch {
    return false;
  }
  if (!result.ok) return false;
  const now = Date.now();
  for (const [nonce, expires] of replayNonces) if (expires <= now) replayNonces.delete(nonce);
  if (replayNonces.has(result.nonce)) return false;
  replayNonces.set(result.nonce, new Date(result.expiresAt).getTime());
  return true;
}

async function appRequest<T>(path: string, method: "GET" | "POST" | "PUT" | "DELETE", payload?: unknown): Promise<T> {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const headers = await signGatewayRequest({ method, path, body });
  const response = await fetch(`${appBase}${path}`, {
    method,
    headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) },
    body: body || undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `SegmiQ returned HTTP ${response.status}`);
  return data;
}

async function emit(connectionId: string, event: Record<string, unknown>): Promise<void> {
  await appRequest("/api/internal/whatsapp/gateway-events", "POST", { connectionId, ...event });
}

function serializeAuth(auth: StoredAuth): string {
  return JSON.stringify(auth, BufferJSON.replacer);
}

function parseAuth(raw: string | null): StoredAuth {
  if (!raw) return { creds: initAuthCreds(), keys: {} };
  const parsed = JSON.parse(raw, BufferJSON.reviver) as StoredAuth;
  return { creds: parsed.creds ?? initAuthCreds(), keys: parsed.keys ?? {} };
}

async function persistAuth(session: ManagedSession, opts?: { force?: boolean }): Promise<void> {
  if (session.closing && !opts?.force) return;
  session.persistQueued = false;
  await appRequest(
    `/api/internal/whatsapp/connections/${encodeURIComponent(session.connectionId)}/session`,
    "PUT",
    { serializedSession: serializeAuth(session.auth) }
  );
}

function schedulePersistAuth(session: ManagedSession): void {
  if (session.closing) return;
  session.persistQueued = true;
  if (session.persistTimer) return;
  session.persistTimer = setTimeout(() => {
    session.persistTimer = null;
    void persistAuth(session).catch((error) =>
      console.error("[whatsapp-gateway] auth persist failed", error)
    );
  }, SESSION_PERSIST_DEBOUNCE_MS);
}

async function flushPersistAuth(session: ManagedSession): Promise<void> {
  if (session.persistTimer) {
    clearTimeout(session.persistTimer);
    session.persistTimer = null;
  }
  if (!session.persistQueued) return;
  await persistAuth(session, { force: true }).catch((error) =>
    console.error("[whatsapp-gateway] auth persist flush failed", error)
  );
}

function authenticationState(auth: StoredAuth, persist: () => Promise<void>): AuthenticationState {
  const keyStore: AuthenticationState["keys"] = {
    get: async (type, ids) => {
      const result: Record<string, SignalDataTypeMap[typeof type]> = {};
      const bucket: Record<string, unknown> = auth.keys[type] ?? {};
      for (const id of ids) {
        const value = bucket[id] as SignalDataTypeMap[typeof type] | undefined;
        if (value !== undefined) result[id] = value;
      }
      return result;
    },
    set: async (data) => {
      for (const category of Object.keys(data) as Array<keyof SignalDataTypeMap>) {
        const bucket: Record<string, unknown> = { ...(auth.keys[category] ?? {}) };
        for (const [id, value] of Object.entries(data[category] ?? {})) {
          if (value == null) delete bucket[id];
          else bucket[id] = value;
        }
        auth.keys[category] = bucket;
      }
      void persist();
    },
    clear: async () => {
      auth.keys = {};
      void persist();
    },
  } as AuthenticationState["keys"];
  return { creds: auth.creds, keys: keyStore };
}

function rememberMessage(session: ManagedSession, id: string | null | undefined, content: WAMessage["message"]): void {
  if (!id || !content) return;
  session.recentMessages.set(id, content);
  if (session.recentMessages.size <= 300) return;
  const oldest = session.recentMessages.keys().next().value;
  if (oldest) session.recentMessages.delete(oldest);
}

function messageText(message: WAMessage): { body: string; type: string; media: WAMessage["message"] } {
  const content = unwrapWhatsAppContent(message.message as Record<string, unknown> | null) as WAMessage["message"];
  if (!content) return { body: "", type: "text", media: content };
  if (content.conversation) return { body: content.conversation, type: "text", media: content };
  if (content.extendedTextMessage?.text) return { body: content.extendedTextMessage.text, type: "text", media: content };
  if (content.imageMessage) return { body: content.imageMessage.caption ?? "Photo", type: "image", media: content };
  if (content.audioMessage) return { body: "Voice message", type: "audio", media: content };
  if (content.videoMessage) return { body: content.videoMessage.caption ?? "Video", type: "video", media: content };
  if (content.documentMessage) return { body: content.documentMessage.caption ?? content.documentMessage.fileName ?? "", type: "document", media: content };
  if (content.stickerMessage) return { body: "", type: "sticker", media: content };
  if (content.locationMessage) return { body: "Location", type: "location", media: content };
  return { body: "", type: "text", media: content };
}

function isAllowedChat(jid: string): boolean {
  const lower = jid.toLowerCase();
  return Boolean(jid) && !(
    lower.endsWith("@g.us") || lower.endsWith("@broadcast") ||
    lower.endsWith("@newsletter") || lower === "status@broadcast" || lower.includes("system")
  );
}

function phoneFromJid(jid: string): string {
  return digitsFromJid(jid);
}

function ownJids(session: ManagedSession): Array<string | null | undefined> {
  const user = session.socket.user as { id?: string; lid?: string } | undefined;
  return [user?.id, user?.lid];
}

function maySendManualMessage(session: ManagedSession): boolean {
  const now = Date.now();
  session.recentManualSendTimestamps = session.recentManualSendTimestamps.filter(
    (timestamp) => timestamp > now - 60_000
  );
  if (session.recentManualSendTimestamps.length >= maxManualSendsPerMinute) return false;
  session.recentManualSendTimestamps.push(now);
  return true;
}

async function normalizedMessage(session: ManagedSession, message: WAMessage, opts?: { allowMissingTimestamp?: boolean }): Promise<void> {
  const remoteChatId = message.key.remoteJid ?? "";
  const providerMessageId = message.key.id ?? "";
  if (!providerMessageId || !isAllowedChat(remoteChatId)) return;
  if (isSelfWhatsAppChat(remoteChatId, ownJids(session))) return;
  if (session.sentByGateway.delete(providerMessageId)) return;
  rememberMessage(session, providerMessageId, message.message);
  const timestamp = messageTimestampMs(message.messageTimestamp) || (opts?.allowMissingTimestamp ? Date.now() : 0);
  if (!timestamp || timestamp < session.acceptAfter) return;
  const extracted = messageText(message);
  const from = phoneFromWhatsAppKey(message.key);
  if (!from) {
    console.warn("[whatsapp-gateway] skipped message with no phone JID", providerMessageId);
    return;
  }
  if (extracted.type === "text" && !extracted.body.trim()) return;
  const direction = message.key.fromMe ? "outbound" : "inbound";
  let media: Record<string, unknown> | null = null;
  if (["image", "audio", "video", "document", "sticker"].includes(extracted.type)) {
    try {
      const buffer = await downloadMediaMessage(message, "buffer", {}, {
        logger,
        reuploadRequest: session.socket.updateMediaMessage,
      });
      const content = extracted.media;
      const node = content?.imageMessage ?? content?.audioMessage ?? content?.videoMessage ?? content?.documentMessage ?? content?.stickerMessage;
      media = {
        mimeType: node?.mimetype ?? "application/octet-stream",
        caption: "caption" in (node ?? {}) ? (node as { caption?: string }).caption ?? null : null,
        filename: content?.documentMessage?.fileName ?? null,
        base64: Buffer.from(buffer).toString("base64"),
      };
    } catch (error) {
      console.warn("[whatsapp-gateway] media download skipped", error instanceof Error ? error.message : "unknown");
    }
  }
  await emit(session.connectionId, {
    type: "MESSAGE",
    message: {
      providerMessageId,
      remoteChatId,
      from,
      timestamp: new Date(timestamp).toISOString(),
      messageType: extracted.type,
      body: extracted.body,
      profileName: message.pushName ?? null,
      direction,
      senderSource: direction === "inbound" ? "CUSTOMER" : "EXTERNAL_BUSINESS_DEVICE",
      media,
    },
  });
}

function disconnectCode(error: unknown): number | undefined {
  return (error as { output?: { statusCode?: number }; data?: { statusCode?: number } })?.output?.statusCode
    ?? (error as { data?: { statusCode?: number } })?.data?.statusCode;
}

async function startConnection(
  connectionId: string,
  reconnectAttempts = 0,
  pairing: WhatsAppPairingDecision = pairingForAdminConnect()
): Promise<void> {
  const existing = sessions.get(connectionId);
  if (existing) {
    await flushPersistAuth(existing);
    existing.closing = true;
    existing.socket.end(undefined);
    sessions.delete(connectionId);
  }
  const stored = await appRequest<{ clientId: string; serializedSession: string | null }>(
    `/api/internal/whatsapp/connections/${encodeURIComponent(connectionId)}/session`,
    "GET"
  );
  if (pairing.freshPairing && stored.serializedSession) {
    await appRequest(
      `/api/internal/whatsapp/connections/${encodeURIComponent(connectionId)}/session`,
      "DELETE"
    ).catch(() => {});
  }
  const auth = parseAuth(pairing.freshPairing ? null : stored.serializedSession);
  const placeholder = {
    connectionId,
    clientId: stored.clientId,
    auth,
    closing: false,
    allowQr: pairing.allowQr,
    freshPairing: pairing.freshPairing,
    persistTimer: null,
    persistQueued: false,
  } as ManagedSession;
  const state = authenticationState(auth, async () => {
    schedulePersistAuth(placeholder);
  });
  const recentMessages = new Map<string, WAMessage["message"]>();
  const socket = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.ubuntu("SegmiQ Quick Connection"),
    logger,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    shouldSyncHistoryMessage: () => false,
    generateHighQualityLinkPreview: false,
    getMessage: async (key) => recentMessages.get(key.id ?? "") ?? undefined,
  });
  const session: ManagedSession = Object.assign(placeholder, {
    socket,
    // WhatsApp timestamps are second-granular. Round down so the first valid
    // message in the activation second is not mistaken for pre-connect sync.
    acceptAfter: Math.floor(Date.now() / 1_000) * 1_000,
    reconnectAttempts,
    closing: false,
    open: false,
    allowQr: pairing.allowQr,
    freshPairing: pairing.freshPairing,
    sentByGateway: new Set<string>(),
    recentManualSendTimestamps: [],
    recentMessages,
    persistTimer: placeholder.persistTimer,
    persistQueued: placeholder.persistQueued,
  });
  sessions.set(connectionId, session);

  socket.ev.on("creds.update", (updates) => {
    if (session.closing) return;
    Object.assign(auth.creds, updates);
    schedulePersistAuth(session);
  });
  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (!isLiveUpsertType(type)) return;
    for (const message of messages) {
      await normalizedMessage(session, message).catch((error) =>
        console.error("[whatsapp-gateway] message ingest failed", error instanceof Error ? error.message : "unknown")
      );
    }
  });
  socket.ev.on("messages.update", async (updates) => {
    for (const update of updates) {
      const id = update.key.id;
      if (update.update.message) {
        rememberMessage(session, id, update.update.message);
        await normalizedMessage(session, {
          key: update.key,
          message: update.update.message,
          messageTimestamp: Date.now() / 1000,
        } as WAMessage, { allowMissingTimestamp: true }).catch((error) =>
          console.error("[whatsapp-gateway] message update ingest failed", error instanceof Error ? error.message : "unknown")
        );
      }
      const raw = Number(update.update.status ?? 0);
      const status = raw >= 4 ? "read" : raw >= 3 ? "delivered" : raw >= 2 ? "sent" : null;
      if (id && status) await emit(connectionId, { type: "RECEIPT", providerMessageId: id, status }).catch(() => {});
    }
  });
  socket.ev.on("connection.update", async (update) => {
    if (update.qr) {
      if (!session.allowQr) {
        await flushPersistAuth(session);
        session.closing = true;
        sessions.delete(connectionId);
        socket.end(undefined);
        await emit(connectionId, {
          type: "STATUS",
          state: "RECONNECT_REQUIRED",
          errorCode: "SESSION_EXPIRED",
          errorMessage: "The saved WhatsApp session is no longer valid. Scan a new QR code to reconnect.",
        }).catch(() => {});
        return;
      }
      await emit(connectionId, {
        type: "QR",
        qr: update.qr,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }).catch((error) =>
        console.error("[whatsapp-gateway] qr publish failed", error instanceof Error ? error.message : "unknown")
      );
      // A QR-bearing Baileys update often also has `connecting`. The QR is
      // authoritative for UI state; reporting CONNECTING afterwards would
      // hide the freshly issued code before an admin can scan it.
      return;
    }
    if (update.connection === "connecting") {
      await emit(connectionId, { type: "STATUS", state: "CONNECTING" }).catch(() => {});
    }
    if (update.connection === "open") {
      session.reconnectAttempts = 0;
      session.open = true;
      const user = socket.user;
      await emit(connectionId, {
        type: "STATUS",
        state: "CONNECTED",
        displayName: user?.name ?? null,
        phoneNumber: user?.id ? `+${phoneFromJid(user.id)}` : null,
        providerAccountId: user?.id ?? null,
      });
    }
    if (update.connection === "close" && !session.closing) {
      const code = disconnectCode(update.lastDisconnect?.error);
      await flushPersistAuth(session);
      session.closing = true;
      session.open = false;
      sessions.delete(connectionId);
      if (code === DisconnectReason.loggedOut || code === DisconnectReason.badSession) {
        const retryPairing = pairingAfterLoggedOut({
          allowQr: session.allowQr,
          freshPairing: session.freshPairing,
        });
        if (retryPairing) {
          void startConnection(connectionId, 0, retryPairing).catch(async (error) => {
            await emit(connectionId, {
              type: "STATUS",
              state: "ERROR",
              errorCode: "INITIALIZE_FAILED",
              errorMessage: error instanceof Error ? error.message : "Initialization failed",
            }).catch(() => {});
          });
          return;
        }
        await emit(connectionId, {
          type: "STATUS",
          state: "RECONNECT_REQUIRED",
          errorCode: String(code ?? "LOGGED_OUT"),
          errorMessage: "The linked phone signed out. Scan a new QR code to reconnect.",
        });
        return;
      }
      session.reconnectAttempts += 1;
      if (session.reconnectAttempts > 6) {
        await emit(connectionId, {
          type: "STATUS",
          state: "RECONNECT_REQUIRED",
          errorCode: "RETRY_LIMIT",
          errorMessage: "Automatic reconnection stopped after repeated failures.",
        });
        return;
      }
      await emit(connectionId, { type: "STATUS", state: "RECONNECTING" }).catch(() => {});
      const delay = Math.min(30_000, 1_000 * 2 ** (session.reconnectAttempts - 1));
      setTimeout(() => void startConnection(
        connectionId,
        session.reconnectAttempts,
        pairingForAutoRetry({ allowQr: session.allowQr, freshPairing: session.freshPairing })
      ).catch(async (error) => {
        await emit(connectionId, {
          type: "STATUS", state: "ERROR", errorCode: "RECONNECT_FAILED",
          errorMessage: error instanceof Error ? error.message : "Reconnect failed",
        }).catch(() => {});
      }), delay);
    }
  });
}

function normalizeMediaHostname(hostname: string): string {
  const lower = hostname.trim().toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

function mediaHostAllowed(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const hostname = normalizeMediaHostname(url.hostname);
  const allowed = new Set<string>();
  try {
    allowed.add(normalizeMediaHostname(new URL(appBase).hostname));
  } catch {
    // ignore malformed app base
  }
  for (const value of (process.env.WHATSAPP_GATEWAY_MEDIA_HOSTS ?? "").split(",")) {
    const host = value.trim();
    if (host) allowed.add(normalizeMediaHostname(host));
  }
  return allowed.has(hostname);
}

function decodeOutboundMediaBytes(mediaBytesBase64: string | undefined): Buffer | null {
  if (!mediaBytesBase64?.trim()) return null;
  try {
    const bytes = Buffer.from(mediaBytesBase64, "base64");
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}

async function resolveOutboundMediaBytes(input: {
  url?: string;
  mediaBytesBase64?: string;
}): Promise<{ ok: true; bytes: Buffer } | { ok: false; status: number; error: string; errorCode?: string }> {
  const inline = decodeOutboundMediaBytes(input.mediaBytesBase64);
  if (inline) {
    if (inline.length > 20 * 1024 * 1024) {
      return { ok: false, status: 413, error: "File exceeds 20 MB" };
    }
    return { ok: true, bytes: inline };
  }
  let mediaUrl: URL;
  try {
    mediaUrl = new URL(input.url ?? "");
  } catch {
    return { ok: false, status: 400, error: "Media URL is required", errorCode: "INVALID_MEDIA_HOST" };
  }
  if (!mediaHostAllowed(mediaUrl)) {
    return {
      ok: false,
      status: 400,
      error: "Media host is not allowed for quick connection sends",
      errorCode: "INVALID_MEDIA_HOST",
    };
  }
  const mediaResponse = await fetch(mediaUrl, { signal: AbortSignal.timeout(20_000), redirect: "error" });
  if (!mediaResponse.ok) return { ok: false, status: 502, error: "Media download failed" };
  const bytes = Buffer.from(await mediaResponse.arrayBuffer());
  if (bytes.length > 20 * 1024 * 1024) return { ok: false, status: 413, error: "File exceeds 20 MB" };
  return { ok: true, bytes };
}

function outboundMediaKind(input: {
  messageType?: string;
  mimeType?: string;
}): "image" | "video" | "document" {
  if (input.messageType === "image" || input.messageType === "video" || input.messageType === "document") {
    return input.messageType;
  }
  const mime = (input.mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", "http://gateway.local");
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    });
    response.end(JSON.stringify({ ok: true, activeConnections: sessions.size }));
    return;
  }
  if (request.method === "OPTIONS" && url.pathname === "/health") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET",
      "access-control-max-age": "600",
    });
    response.end();
    return;
  }
  const body = await readBody(request);
  if (!await authenticate(request, url.pathname, body)) {
    json(response, 401, { error: "Unauthorized" });
    return;
  }
  const connectMatch = url.pathname.match(/^\/v1\/connections\/([0-9a-f-]+)\/connect$/i);
  const textMatch = url.pathname.match(/^\/v1\/connections\/([0-9a-f-]+)\/messages\/text$/i);
  const documentMatch = url.pathname.match(/^\/v1\/connections\/([0-9a-f-]+)\/messages\/document$/i);
  const mediaMatch = url.pathname.match(/^\/v1\/connections\/([0-9a-f-]+)\/messages\/media$/i);
  const deleteMatch = url.pathname.match(/^\/v1\/connections\/([0-9a-f-]+)$/i);

  if (request.method === "POST" && connectMatch) {
    void startConnection(connectMatch[1], 0, pairingForAdminConnect()).catch(async (error) => {
      await emit(connectMatch[1], {
        type: "STATUS", state: "ERROR", errorCode: "INITIALIZE_FAILED",
        errorMessage: error instanceof Error ? error.message : "Initialization failed",
      }).catch(() => {});
    });
    json(response, 202, { ok: true });
    return;
  }
  if (request.method === "POST" && textMatch) {
    const session = sessions.get(textMatch[1]);
    if (!session) return json(response, 409, { ok: false, error: "Connection is offline", errorCode: "NOT_CONNECTED" });
    const input = JSON.parse(body) as { to?: string; body?: string };
    const digits = input.to?.replace(/\D/g, "") ?? "";
    if (!digits || !input.body?.trim()) return json(response, 400, { ok: false, error: "Recipient and body are required" });
    if (!maySendManualMessage(session)) {
      return json(response, 429, { ok: false, error: "Too many messages sent. Please wait a moment and try again.", errorCode: "RATE_LIMITED" });
    }
    const sent = await session.socket.sendMessage(`${digits}@s.whatsapp.net`, { text: input.body.trim() });
    const id = sent?.key.id ?? randomUUID();
    session.sentByGateway.add(id);
    json(response, 200, { ok: true, providerId: id });
    return;
  }
  if (request.method === "POST" && (documentMatch || mediaMatch)) {
    const connectionId = (documentMatch ?? mediaMatch)?.[1] ?? "";
    const session = sessions.get(connectionId);
    if (!session) return json(response, 409, { ok: false, error: "Connection is offline", errorCode: "NOT_CONNECTED" });
    const input = JSON.parse(body) as {
      to?: string;
      body?: string;
      url?: string;
      mediaBytesBase64?: string;
      filename?: string;
      mimeType?: string;
      messageType?: "image" | "video" | "document";
    };
    const digits = input.to?.replace(/\D/g, "") ?? "";
    if (!digits) return json(response, 400, { ok: false, error: "Recipient is required" });
    if (!maySendManualMessage(session)) {
      return json(response, 429, { ok: false, error: "Too many messages sent. Please wait a moment and try again.", errorCode: "RATE_LIMITED" });
    }
    const resolved = await resolveOutboundMediaBytes(input);
    if (!resolved.ok) {
      return json(response, resolved.status, {
        ok: false,
        error: resolved.error,
        errorCode: resolved.errorCode,
      });
    }
    const bytes = resolved.bytes;
    const kind = outboundMediaKind(input);
    const caption = input.body?.trim() || undefined;
    const mimeType = input.mimeType ?? "application/octet-stream";
    const payload =
      kind === "image"
        ? { image: bytes, caption, mimetype: mimeType }
        : kind === "video"
          ? { video: bytes, caption, mimetype: mimeType }
          : {
              document: bytes,
              mimetype: mimeType,
              fileName: input.filename ?? "document",
              caption,
            };
    const sent = await session.socket.sendMessage(`${digits}@s.whatsapp.net`, payload);
    const id = sent?.key.id ?? randomUUID();
    session.sentByGateway.add(id);
    json(response, 200, { ok: true, providerId: id });
    return;
  }
  if (request.method === "DELETE" && deleteMatch) {
    const session = sessions.get(deleteMatch[1]);
    if (session) {
      await flushPersistAuth(session);
      session.closing = true;
      await session.socket.logout().catch(() => session.socket.end(undefined));
      sessions.delete(deleteMatch[1]);
    }
    json(response, 200, { ok: true });
    return;
  }
  json(response, 404, { error: "Not found" });
}

/**
 * A restart must not force every beta company to scan a new QR code. SegmiQ
 * returns the connections that still hold a valid stored session; each one is
 * re-established from that session, staggered so a large beta cohort does not
 * open every socket in the same instant.
 */
async function restoreSessions(): Promise<void> {
  let restorable: Array<{ connectionId: string }>;
  try {
    const result = await appRequest<{ connections?: Array<{ connectionId: string }> }>(
      "/api/internal/whatsapp/connections/restorable",
      "GET"
    );
    restorable = result.connections ?? [];
  } catch (error) {
    console.error(
      "[whatsapp-gateway] session restore lookup failed",
      error instanceof Error ? error.message : "unknown"
    );
    return;
  }
  if (restorable.length === 0) return;
  console.info(`[whatsapp-gateway] restoring ${restorable.length} connection(s)`);
  for (const [index, entry] of restorable.entries()) {
    setTimeout(() => {
      void startConnection(entry.connectionId, 0, pairingForRestore()).catch(async (error) => {
        await emit(entry.connectionId, {
          type: "STATUS",
          state: "RECONNECT_REQUIRED",
          errorCode: "RESTORE_FAILED",
          errorMessage: "The stored WhatsApp session could not be restored. Scan a new QR code to reconnect.",
        }).catch(() => {});
        console.error(
          "[whatsapp-gateway] session restore failed",
          error instanceof Error ? error.message : "unknown"
        );
      });
    }, index * 1_500);
  }
}

/**
 * Keeps `last_seen_at` meaningful for healthy connections. Without it a quiet
 * business number is indistinguishable from a dead socket.
 */
function startHeartbeat(): NodeJS.Timeout {
  return setInterval(() => {
    for (const session of sessions.values()) {
      if (!session.open || session.closing) continue;
      void emit(session.connectionId, { type: "HEARTBEAT" }).catch(() => {});
    }
  }, heartbeatIntervalMs).unref();
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error) => {
    console.error("[whatsapp-gateway] request failed", error instanceof Error ? error.message : "unknown");
    if (!response.headersSent) json(response, 500, { error: "Gateway request failed" });
    else response.end();
  });
});

let heartbeat: NodeJS.Timeout | null = null;

server.listen(port, "0.0.0.0", () => {
  console.info(`[whatsapp-gateway] listening on port ${port}`);
  heartbeat = startHeartbeat();
  void restoreSessions();
});

async function shutdown(): Promise<void> {
  if (heartbeat) clearInterval(heartbeat);
  for (const session of sessions.values()) {
    await flushPersistAuth(session);
    session.closing = true;
    session.socket.end(undefined);
  }
  server.close();
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
