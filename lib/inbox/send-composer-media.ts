import {
  WHATSAPP_DIRECT_UPLOAD_MAX_BYTES,
  validateWhatsAppOutboundMedia,
  type WhatsAppOutboundMediaType,
} from "@/lib/whatsapp/outbound-media";

export async function sendComposerMedia(opts: {
  leadId: string;
  file: File;
  caption?: string;
}): Promise<{ ok: true; messageType: WhatsAppOutboundMediaType } | { ok: false; error: string }> {
  const validated = validateWhatsAppOutboundMedia({
    filename: opts.file.name,
    mimeType: opts.file.type,
    size: opts.file.size,
  });
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  if (opts.file.size <= WHATSAPP_DIRECT_UPLOAD_MAX_BYTES) {
    const form = new FormData();
    form.append("file", opts.file, validated.filename);
    if (opts.caption?.trim()) form.append("caption", opts.caption.trim());
    const res = await fetch(`/api/leads/${opts.leadId}/send-media`, {
      method: "POST",
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; messageType?: WhatsAppOutboundMediaType };
    if (!res.ok) return { ok: false, error: data.error ?? "Could not send file" };
    return { ok: true, messageType: data.messageType ?? validated.messageType };
  }

  const presignRes = await fetch(`/api/leads/${opts.leadId}/send-media/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: validated.filename,
      contentType: validated.mimeType,
      fileSize: opts.file.size,
    }),
  });
  const presign = (await presignRes.json().catch(() => ({}))) as {
    error?: string;
    uploadUrl?: string;
    key?: string;
  };
  if (!presignRes.ok || !presign.uploadUrl || !presign.key) {
    return { ok: false, error: presign.error ?? "Could not prepare file upload" };
  }

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": validated.mimeType },
    body: opts.file,
  });
  if (!put.ok) {
    return { ok: false, error: "Could not upload the file. Try a smaller file or check your connection." };
  }

  const sendRes = await fetch(`/api/leads/${opts.leadId}/send-media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storageKey: presign.key,
      filename: validated.filename,
      mimeType: validated.mimeType,
      size: opts.file.size,
      caption: opts.caption?.trim() || undefined,
    }),
  });
  const sendData = (await sendRes.json().catch(() => ({}))) as {
    error?: string;
    messageType?: WhatsAppOutboundMediaType;
  };
  if (!sendRes.ok) return { ok: false, error: sendData.error ?? "Could not send file" };
  return { ok: true, messageType: sendData.messageType ?? validated.messageType };
}
