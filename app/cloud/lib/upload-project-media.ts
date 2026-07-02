import { MEDIA_SERVER_UPLOAD_MAX_BYTES } from "@/lib/storage/media-content-type";

export type StorageUploadResult = {
  key: string;
  publicUrl: string;
};

export class ProjectMediaUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectMediaUploadError";
  }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function uploadViaServer(
  file: File,
  clientId: string,
  projectId: string
): Promise<StorageUploadResult | null> {
  const form = new FormData();
  form.append("file", file);
  form.append("clientId", clientId);
  form.append("projectId", projectId);

  const res = await fetch("/api/storage/upload", { method: "POST", body: form });
  if (res.status === 413) return null;

  if (!res.ok) {
    throw new ProjectMediaUploadError(await readApiError(res, "Upload failed"));
  }

  return (await res.json()) as StorageUploadResult;
}

async function uploadViaPresignedUrl(
  file: File,
  clientId: string,
  projectId: string
): Promise<StorageUploadResult> {
  const contentType = file.type || "image/jpeg";
  const presignRes = await fetch("/api/storage/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType,
      clientId,
      projectId,
      purpose: "media",
      fileSize: file.size,
    }),
  });

  if (!presignRes.ok) {
    throw new ProjectMediaUploadError(
      await readApiError(presignRes, "Could not prepare upload")
    );
  }

  const { uploadUrl, key, publicUrl } = (await presignRes.json()) as StorageUploadResult & {
    uploadUrl: string;
  };

  let putRes: Response;
  try {
    putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
  } catch {
    throw new ProjectMediaUploadError(
      "Could not reach storage (Failed to fetch). Large uploads need R2 CORS enabled for your Cloud domain, or try a smaller photo under 4MB."
    );
  }

  if (!putRes.ok) {
    throw new ProjectMediaUploadError(`Storage rejected upload (${putRes.status})`);
  }

  return { key, publicUrl };
}

/** Upload project media through our API when possible (avoids R2 CORS). */
export async function uploadProjectMediaFile(
  file: File,
  clientId: string,
  projectId: string
): Promise<StorageUploadResult> {
  if (file.size <= MEDIA_SERVER_UPLOAD_MAX_BYTES) {
    const serverResult = await uploadViaServer(file, clientId, projectId);
    if (serverResult) return serverResult;
  }

  return uploadViaPresignedUrl(file, clientId, projectId);
}

export function uploadErrorMessage(err: unknown): string {
  if (err instanceof ProjectMediaUploadError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Upload failed";
}
