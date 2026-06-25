import { Preferences } from "@capacitor/preferences";
import { apiPost } from "./api";
import type { LeadRow, LogCallPayload } from "./types";

const QUEUE_KEY = "segmiq_sales_call_log_queue";

export type QueueItemStatus = "pending" | "syncing" | "done" | "error";

export type CallLogQueueItem = {
  id: string;
  leadId: string;
  leadName: string;
  payload: LogCallPayload;
  status: QueueItemStatus;
  error?: string;
  createdAt: string;
};

type QueueListener = (items: CallLogQueueItem[]) => void;
const listeners = new Set<QueueListener>();

function notify(items: CallLogQueueItem[]) {
  for (const fn of listeners) fn(items);
}

async function loadQueue(): Promise<CallLogQueueItem[]> {
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as CallLogQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(items: CallLogQueueItem[]): Promise<void> {
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(items) });
  notify(items);
}

export function subscribeCallLogQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  void loadQueue().then(listener);
  return () => listeners.delete(listener);
}

export async function getPendingCount(): Promise<number> {
  const items = await loadQueue();
  return items.filter((i) => i.status === "pending" || i.status === "error").length;
}

export async function getQueueItems(): Promise<CallLogQueueItem[]> {
  return loadQueue();
}

export async function enqueueCallLog(params: {
  leadId: string;
  leadName: string;
  payload: LogCallPayload;
}): Promise<CallLogQueueItem> {
  const item: CallLogQueueItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    leadId: params.leadId,
    leadName: params.leadName,
    payload: params.payload,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const items = await loadQueue();
  items.push(item);
  await saveQueue(items);
  return item;
}

export async function submitCallLog(
  leadId: string,
  payload: LogCallPayload,
  online: boolean
): Promise<{ queued: boolean; lead?: LeadRow; error?: string }> {
  if (!online) {
    return { queued: true };
  }

  const res = await apiPost<{ lead?: LeadRow; error?: string }>(
    `/api/leads/${leadId}/log-call`,
    payload
  );

  if (res.ok && res.data.lead) {
    return { queued: false, lead: res.data.lead };
  }

  return { queued: true, error: res.data.error ?? "Failed to sync" };
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const items = await loadQueue();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.status === "done") continue;
    item.status = "syncing";
    await saveQueue(items);

    const res = await apiPost<{ lead?: LeadRow; error?: string }>(
      `/api/leads/${item.leadId}/log-call`,
      item.payload
    );

    if (res.ok) {
      item.status = "done";
      synced += 1;
    } else {
      item.status = "error";
      item.error = res.data.error ?? "Sync failed";
      failed += 1;
    }
    await saveQueue(items);
  }

  const remaining = items.filter((i) => i.status !== "done");
  await saveQueue(remaining);
  return { synced, failed };
}

export async function clearDoneItems(): Promise<void> {
  const items = await loadQueue();
  await saveQueue(items.filter((i) => i.status !== "done"));
}

export async function retryItem(id: string): Promise<void> {
  const items = await loadQueue();
  const item = items.find((i) => i.id === id);
  if (item) {
    item.status = "pending";
    item.error = undefined;
    await saveQueue(items);
  }
}

export async function removeItem(id: string): Promise<void> {
  const items = await loadQueue();
  await saveQueue(items.filter((i) => i.id !== id));
}
