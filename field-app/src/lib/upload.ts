import { apiPost } from "./api";
import {
  getQueue,
  readQueueFile,
  updateQueueItem,
  type QueueItem,
} from "./upload-queue";

type PresignResponse = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
};

type MediaResponse = {
  id: string;
  error?: string;
};

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

async function presign(params: {
  filename: string;
  contentType: string;
  clientId: string;
  projectId: string;
  fileSize: number;
}): Promise<PresignResponse> {
  const res = await apiPost<PresignResponse | { error?: string }>("/api/storage/presign", {
    filename: params.filename,
    contentType: params.contentType,
    clientId: params.clientId,
    projectId: params.projectId,
    purpose: "media",
    fileSize: params.fileSize,
  });
  if (!res.ok || !("uploadUrl" in res.data)) {
    throw new Error((res.data as { error?: string }).error ?? "Presign failed");
  }
  return res.data as PresignResponse;
}

async function putToR2(uploadUrl: string, blob: Blob, contentType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!response.ok) throw new Error("Upload to storage failed");
}

async function registerMedia(params: {
  clientId: string;
  projectId: string;
  storageKey: string;
  publicUrl: string;
  fileSize: number;
}): Promise<MediaResponse> {
  const res = await apiPost<MediaResponse>(
    `/api/clients/${params.clientId}/projects/${params.projectId}/media`,
    {
      type: "photo",
      storage_key: params.storageKey,
      public_url: params.publicUrl,
      file_size_bytes: params.fileSize,
    }
  );
  if (!res.ok || !("id" in res.data)) {
    throw new Error((res.data as { error?: string }).error ?? "Failed to register media");
  }
  return res.data as MediaResponse;
}

async function applyWatermark(params: {
  mediaId: string;
  originalKey: string;
  clientId: string;
}): Promise<void> {
  await apiPost("/api/cloud/watermark/apply", {
    mediaId: params.mediaId,
    originalKey: params.originalKey,
    clientId: params.clientId,
  });
}

export async function uploadQueueItem(item: QueueItem): Promise<void> {
  await updateQueueItem(item.id, { status: "uploading", error: undefined });

  try {
    const base64 = await readQueueFile(item);
    const blob = base64ToBlob(base64, item.contentType);

    const { uploadUrl, key, publicUrl } = await presign({
      filename: item.filename,
      contentType: item.contentType,
      clientId: item.clientId,
      projectId: item.projectId,
      fileSize: item.fileSize,
    });

    await putToR2(uploadUrl, blob, item.contentType);

    const saved = await registerMedia({
      clientId: item.clientId,
      projectId: item.projectId,
      storageKey: key,
      publicUrl,
      fileSize: item.fileSize,
    });

    await applyWatermark({
      mediaId: saved.id,
      originalKey: key,
      clientId: item.clientId,
    });

    await updateQueueItem(item.id, { status: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    await updateQueueItem(item.id, { status: "error", error: message });
    throw err;
  }
}

export async function processQueue(): Promise<{ uploaded: number; failed: number }> {
  const items = await getQueue();
  const pending = items.filter((i) => i.status === "pending" || i.status === "error");
  let uploaded = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await uploadQueueItem(item);
      uploaded++;
    } catch {
      failed++;
    }
  }

  return { uploaded, failed };
}
