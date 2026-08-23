import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canModifyLead } from "@/lib/auth/permissions";
import { sendWhatsAppMediaToLead } from "@/lib/whatsapp/send-media";
import { isWhatsAppOutboundKeyForLead, validateWhatsAppOutboundMedia } from "@/lib/whatsapp/outbound-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function statusForMediaError(code?: string | number): number {
  if (code === "SESSION_CLOSED") return 409;
  if (code === "INVALID_MEDIA" || code === "MISSING_FILE" || code === "INVALID_SOURCE" || code === "NO_PHONE") {
    return 400;
  }
  if (code === "NOT_FOUND") return 404;
  if (code === "STORAGE_UNAVAILABLE" || code === "CONNECTION_UNAVAILABLE") return 503;
  return 502;
}

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const check = await canModifyLead(params.leadId, req);
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  const supabase = createAdminClient();
  const { data: actor } = await supabase
    .from("users")
    .select("name")
    .eq("id", check.userId)
    .maybeSingle();
  const actorName = (actor?.name as string) ?? "Salesperson";

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    const file = form.get("file");
    const caption = String(form.get("caption") ?? "").trim();
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    const validated = validateWhatsAppOutboundMedia({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const result = await sendWhatsAppMediaToLead({
      leadId: params.leadId,
      actorId: check.userId,
      actorName,
      actorRole: check.role,
      filename: validated.filename,
      mimeType: validated.mimeType,
      size: file.size,
      caption,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Send failed", code: result.errorCode },
        { status: statusForMediaError(result.errorCode) }
      );
    }
    return NextResponse.json({ ok: true, providerId: result.providerId, messageType: result.messageType });
  }

  const body = (await req.json().catch(() => null)) as {
    storageKey?: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    caption?: string;
  } | null;
  if (!body?.storageKey || !body.filename) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (!isWhatsAppOutboundKeyForLead(body.storageKey, check.lead.client_id, params.leadId)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }
  const result = await sendWhatsAppMediaToLead({
    leadId: params.leadId,
    actorId: check.userId,
    actorName,
    actorRole: check.role,
    filename: body.filename,
    mimeType: body.mimeType,
    size: Number(body.size) || 1,
    caption: body.caption,
    storageKey: body.storageKey,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Send failed", code: result.errorCode },
      { status: statusForMediaError(result.errorCode) }
    );
  }
  return NextResponse.json({ ok: true, providerId: result.providerId, messageType: result.messageType });
}
