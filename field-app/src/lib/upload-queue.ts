import { Preferences } from "@capacitor/preferences";
import { Filesystem, Directory } from "@capacitor/filesystem";

const QUEUE_META_KEY = "segmiq_upload_queue";

export type QueueItemStatus = "pending" | "uploading" | "done" | "error";

export type QueueItem = {
  id: string;
  clientId: string;
  projectId: string;
  projectTitle: string;
  filename: string;
  contentType: string;
  fileSize: number;
  status: QueueItemStatus;
  error?: string;
  createdAt: string;
};

type QueueListener = (items: QueueItem[]) => void;
const listeners = new Set<QueueListener>();

function notify(items: QueueItem[]) {
  for (const fn of listeners) fn(items);
}

function filePath(id: string, contentType: string): string {
  const ext = contentType.includes("png") ? "png" : "jpg";
  return `upload-queue/${id}.${ext}`;
}

async function loadMeta(): Promise<QueueItem[]> {
  const { value } = await Preferences.get({ key: QUEUE_META_KEY });
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as QueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveMeta(items: QueueItem[]): Promise<void> {
  await Preferences.set({ key: QUEUE_META_KEY, value: JSON.stringify(items) });
  notify(items);
}

export function subscribeQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  void loadMeta().then(listener);
  return () => listeners.delete(listener);
}

export async function getQueue(): Promise<QueueItem[]> {
  const items = await loadMeta();
  return items.filter((i) => i.status !== "done");
}

export async function getAllQueueItems(): Promise<QueueItem[]> {
  return loadMeta();
}

export async function addToQueue(params: {
  clientId: string;
  projectId: string;
  projectTitle: string;
  base64: string;
  contentType: string;
  filename?: string;
}): Promise<QueueItem> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const contentType = params.contentType || "image/jpeg";
  const filename = params.filename ?? `photo_${id}.${contentType.includes("png") ? "png" : "jpg"}`;
  const path = filePath(id, contentType);

  await Filesystem.writeFile({
    path,
    data: params.base64,
    directory: Directory.Data,
  });

  const fileSize = Math.floor(params.base64.length * 0.75);
  const item: QueueItem = {
    id,
    clientId: params.clientId,
    projectId: params.projectId,
    projectTitle: params.projectTitle,
    filename,
    contentType,
    fileSize,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const items = await loadMeta();
  items.push(item);
  await saveMeta(items);
  return item;
}

export async function readQueueFile(item: QueueItem): Promise<string> {
  const path = filePath(item.id, item.contentType);
  const { data } = await Filesystem.readFile({ path, directory: Directory.Data });
  return data as string;
}

export async function getQueuePreviewUrl(item: QueueItem): Promise<string> {
  const base64 = await readQueueFile(item);
  return `data:${item.contentType};base64,${base64}`;
}

export async function updateQueueItem(id: string, patch: Partial<QueueItem>): Promise<void> {
  const items = await loadMeta();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx]!, ...patch };
  await saveMeta(items);
}

export async function removeFromQueue(id: string): Promise<void> {
  const items = await loadMeta();
  const item = items.find((i) => i.id === id);
  if (item) {
    try {
      await Filesystem.deleteFile({
        path: filePath(item.id, item.contentType),
        directory: Directory.Data,
      });
    } catch {
      /* file may already be gone */
    }
  }
  await saveMeta(items.filter((i) => i.id !== id));
}

export async function clearCompleted(): Promise<void> {
  const items = await loadMeta();
  const done = items.filter((i) => i.status === "done");
  for (const item of done) {
    try {
      await Filesystem.deleteFile({
        path: filePath(item.id, item.contentType),
        directory: Directory.Data,
      });
    } catch {
      /* ignore */
    }
  }
  await saveMeta(items.filter((i) => i.status !== "done"));
}
