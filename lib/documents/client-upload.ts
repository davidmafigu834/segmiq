export type UploadFileState = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "ready" | "failed" | "duplicate";
  error?: string;
  documentId?: string;
  duplicateOf?: { title: string; documentId: string };
};

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const DIRECT_MAX = 4 * 1024 * 1024;

export async function uploadCompanyDocument(
  clientId: string,
  file: File,
  opts?: { forceUpload?: boolean }
): Promise<{
  ok: true;
  documentId: string;
  duplicate?: { title: string; documentId: string };
} | { ok: false; error: string; code?: string; duplicate?: { title: string; documentId: string } }> {
  if (file.size <= DIRECT_MAX) {
    const form = new FormData();
    form.append("file", file);
    if (opts?.forceUpload) form.append("forceUpload", "true");

    const res = await fetch(`/api/clients/${clientId}/company-documents/upload`, {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 409 && data.code === "DUPLICATE_FILE") {
      return {
        ok: false,
        error: data.error,
        code: "DUPLICATE_FILE",
        duplicate: data.duplicate,
      };
    }
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Upload failed." };
    }
    return { ok: true, documentId: data.document.id as string };
  }

  const presignRes = await fetch(`/api/clients/${clientId}/company-documents/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    }),
  });
  const presignData = await presignRes.json().catch(() => ({}));
  if (!presignRes.ok) {
    return { ok: false, error: presignData.error ?? "Could not prepare upload." };
  }

  const putRes = await fetch(presignData.uploadUrl as string, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) {
    return { ok: false, error: "Upload to storage failed." };
  }

  const checksum = await sha256Hex(file);
  const completeRes = await fetch(`/api/clients/${clientId}/company-documents/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: presignData.documentId,
      versionId: presignData.versionId,
      checksum,
      forceUpload: opts?.forceUpload ?? false,
    }),
  });
  const completeData = await completeRes.json().catch(() => ({}));

  if (completeRes.status === 409 && completeData.code === "DUPLICATE_FILE") {
    return {
      ok: false,
      error: completeData.error,
      code: "DUPLICATE_FILE",
      duplicate: completeData.duplicate,
    };
  }
  if (!completeRes.ok) {
    return { ok: false, error: completeData.error ?? "Could not finalize upload." };
  }

  return { ok: true, documentId: completeData.document.id as string };
}
