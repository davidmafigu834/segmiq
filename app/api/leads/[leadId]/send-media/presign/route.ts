import { NextResponse } from "next/server";
import { canModifyLead } from "@/lib/auth/permissions";
import { generatePresignedUploadUrl, generateWhatsAppOutboundKey, getPublicUrl } from "@/lib/storage/r2";
import { validateWhatsAppOutboundMedia } from "@/lib/whatsapp/outbound-media";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const check = await canModifyLead(params.leadId, req);
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as {
    filename?: string;
    contentType?: string;
    fileSize?: number;
  } | null;
  if (!body?.filename) {
    return NextResponse.json({ error: "Filename is required" }, { status: 400 });
  }

  const validated = validateWhatsAppOutboundMedia({
    filename: body.filename,
    mimeType: body.contentType,
    size: Number(body.fileSize) || 0,
  });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const key = generateWhatsAppOutboundKey(check.lead.client_id, params.leadId, validated.filename);
    const uploadUrl = await generatePresignedUploadUrl(key, validated.mimeType);
    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl: getPublicUrl(key),
      contentType: validated.mimeType,
      messageType: validated.messageType,
      filename: validated.filename,
    });
  } catch (err) {
    console.error("[send-media/presign]", err);
    return NextResponse.json({ error: "Could not prepare file upload." }, { status: 500 });
  }
}
