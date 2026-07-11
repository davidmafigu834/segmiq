/** Browser-side: upload via server route (avoids presigned PUT CORS issues). */
export async function uploadClientCapabilityFile(file: File): Promise<{ publicUrl: string; key: string }> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/cloud/settings/capability/upload", { method: "POST", body });
  const payload = (await res.json().catch(() => ({}))) as {
    publicUrl?: string;
    key?: string;
    error?: string;
  };
  if (!res.ok || !payload.publicUrl) {
    throw new Error(payload.error ?? "Upload failed");
  }
  return { publicUrl: payload.publicUrl, key: payload.key ?? "" };
}
