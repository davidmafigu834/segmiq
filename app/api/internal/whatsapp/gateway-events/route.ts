import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { putObject, getPublicUrl } from "@/lib/storage/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWhatsAppReconnectRequired } from "@/lib/whatsapp/connection-alerts";
import {
  deleteWhatsAppQr,
  getWhatsAppConnectionById,
  recordWhatsAppConnectionEvent,
  storeWhatsAppQr,
  transitionWhatsAppConnection,
} from "@/lib/whatsapp/connections";
import { ingestNormalizedWhatsAppMessage } from "@/lib/whatsapp/normalized-inbound";
import { WHATSAPP_CONNECTION_STATES } from "@/lib/whatsapp/providers/types";
import type { NormalizedWhatsAppInbound, WhatsAppConnectionState } from "@/lib/whatsapp/providers/types";
import { verifyInternalWhatsAppRequest } from "@/lib/whatsapp/security/verify-internal-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const base = z.object({ connectionId: z.string().uuid() });
const eventSchema = z.discriminatedUnion("type", [
  base.extend({
    type: z.literal("QR"),
    qr: z.string().min(20).max(16_000),
    expiresAt: z.string().datetime(),
  }),
  base.extend({
    type: z.literal("STATUS"),
    state: z.enum(WHATSAPP_CONNECTION_STATES),
    displayName: z.string().max(160).nullable().optional(),
    phoneNumber: z.string().max(40).nullable().optional(),
    providerAccountId: z.string().max(200).nullable().optional(),
    errorCode: z.string().max(80).nullable().optional(),
    errorMessage: z.string().max(500).nullable().optional(),
  }),
  base.extend({
    type: z.literal("MESSAGE"),
    message: z.object({
      providerMessageId: z.string().min(1).max(300),
      remoteChatId: z.string().min(1).max(300),
      from: z.string().min(3).max(80),
      timestamp: z.string().datetime(),
      messageType: z.enum(["text", "image", "audio", "video", "document", "sticker", "location"]),
      body: z.string().max(65_536).default(""),
      profileName: z.string().max(160).nullable().optional(),
      direction: z.enum(["inbound", "outbound"]),
      senderSource: z.enum(["CUSTOMER", "EXTERNAL_BUSINESS_DEVICE"]),
      media: z.object({
        mimeType: z.string().max(160),
        caption: z.string().max(4096).nullable().optional(),
        filename: z.string().max(240).nullable().optional(),
        base64: z.string().max(28_000_000),
      }).nullable().optional(),
    }),
  }),
  base.extend({
    type: z.literal("RECEIPT"),
    providerMessageId: z.string().min(1).max(300),
    status: z.enum(["sent", "delivered", "read", "failed"]),
  }),
  base.extend({ type: z.literal("HEARTBEAT") }),
]);

const ALLOWED_MEDIA = new Set([
  "image/jpeg", "image/png", "image/webp", "audio/ogg", "audio/mpeg", "audio/mp4",
  "video/mp4", "application/pdf", "text/plain",
]);

async function persistInboundMedia(input: {
  clientId: string;
  connectionId: string;
  providerMessageId: string;
  mimeType: string;
  base64: string;
}): Promise<{ url: string | null; storageKey: string }> {
  const mimeType = input.mimeType.split(";")[0]?.toLowerCase() ?? "";
  if (!ALLOWED_MEDIA.has(mimeType)) throw new Error("Unsupported WhatsApp media type");
  const bytes = Buffer.from(input.base64, "base64");
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("WhatsApp media exceeds the 20 MB limit");
  const ext = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  const key = `whatsapp/${input.clientId}/temporary/${input.connectionId}/${randomUUID()}-${input.providerMessageId.replace(/[^a-zA-Z0-9_-]/g, "").slice(-40)}.${ext}`;
  await putObject(key, bytes, mimeType, { cacheControl: "private, max-age=0" });
  let url: string | null = null;
  try { url = getPublicUrl(key); } catch { url = null; }
  return { url, storageKey: key };
}

export async function POST(request: Request) {
  const raw = await request.text();
  const auth = await verifyInternalWhatsAppRequest(request, raw);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
  let parsed: z.infer<typeof eventSchema>;
  try {
    parsed = eventSchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Invalid gateway event" }, { status: 400 });
  }
  const connection = await getWhatsAppConnectionById(parsed.connectionId);
  if (!connection || connection.providerType !== "TEMPORARY_WEB") {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    if (parsed.type === "QR") {
      await storeWhatsAppQr({
        connectionId: connection.id,
        clientId: connection.clientId,
        qr: parsed.qr,
        expiresAt: parsed.expiresAt,
      });
      await transitionWhatsAppConnection({ connectionId: connection.id, to: "AWAITING_QR" });
    } else if (parsed.type === "STATUS") {
      await transitionWhatsAppConnection({
        connectionId: connection.id,
        to: parsed.state as WhatsAppConnectionState,
        displayName: parsed.displayName,
        phoneNumber: parsed.phoneNumber,
        providerAccountId: parsed.providerAccountId,
        errorCode: parsed.errorCode,
        errorMessage: parsed.errorMessage,
      });
      if (["CONNECTED", "DISCONNECTED", "RECONNECT_REQUIRED", "ERROR"].includes(parsed.state)) {
        await deleteWhatsAppQr(connection.id);
      }
      await recordWhatsAppConnectionEvent({
        connectionId: connection.id,
        clientId: connection.clientId,
        eventType: `STATUS_${parsed.state}`,
        safeDetails: parsed.errorCode ? { errorCode: parsed.errorCode } : {},
      });
      if (parsed.state === "RECONNECT_REQUIRED") {
        // Alerting must not fail the gateway event: the connection state is
        // already persisted and the gateway would otherwise retry the event.
        await notifyWhatsAppReconnectRequired({
          connectionId: connection.id,
          clientId: connection.clientId,
        }).catch((error) =>
          console.error("[whatsapp] reconnect alert failed", error instanceof Error ? error.message : "unknown")
        );
      }
    } else if (parsed.type === "MESSAGE") {
      let media: NormalizedWhatsAppInbound["media"] = null;
      if (parsed.message.media?.base64) {
        const stored = await persistInboundMedia({
          clientId: connection.clientId,
          connectionId: connection.id,
          providerMessageId: parsed.message.providerMessageId,
          mimeType: parsed.message.media.mimeType,
          base64: parsed.message.media.base64,
        });
        media = {
          url: stored.url,
          storageKey: stored.storageKey,
          mimeType: parsed.message.media.mimeType,
          caption: parsed.message.media.caption ?? null,
          filename: parsed.message.media.filename ?? null,
        };
      }
      await ingestNormalizedWhatsAppMessage({
        connectionId: connection.id,
        clientId: connection.clientId,
        providerType: "TEMPORARY_WEB",
        ...parsed.message,
        media,
      });
    } else if (parsed.type === "RECEIPT") {
      await createAdminClient().from("whatsapp_messages").update({
        status: parsed.status,
        updated_at: new Date().toISOString(),
      })
        .eq("client_id", connection.clientId)
        .eq("provider_type", "TEMPORARY_WEB")
        .eq("provider_id", parsed.providerMessageId);
    } else {
      await createAdminClient().from("whatsapp_connections").update({
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", connection.id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gateway event failed" }, { status: 409 });
  }
}
