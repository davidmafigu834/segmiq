import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { TabBar } from "../components/TabBar";
import type { TabId } from "../components/TabBar";
import { ScreenHeader } from "../components/ScreenHeader";
import { OfflineBanner } from "../components/OfflineBanner";
import { FWButton, FWSectionLabel } from "../components/fw";
import {
  clearCompleted,
  getQueuePreviewUrl,
  removeFromQueue,
  subscribeQueue,
  type QueueItem,
} from "../lib/upload-queue";
import { processQueue, uploadQueueItem } from "../lib/upload";
import { useOnline } from "../hooks/useOnline";

type Props = {
  onTabChange: (tab: TabId) => void;
  onOpenAccount: () => void;
};

type PreviewMap = Record<string, string>;

export function Sync({ onTabChange, onOpenAccount }: Props) {
  const online = useOnline();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [previews, setPreviews] = useState<PreviewMap>({});
  const [syncing, setSyncing] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => subscribeQueue(setItems), []);

  useEffect(() => {
    const active = items.filter((i) => i.status !== "done");
    void (async () => {
      const next: PreviewMap = {};
      for (const item of active.slice(0, 12)) {
        try {
          next[item.id] = await getQueuePreviewUrl(item);
        } catch {
          /* skip broken preview */
        }
      }
      setPreviews(next);
    })();
  }, [items]);

  const pending = items.filter((i) => i.status === "pending" || i.status === "error");
  const uploading = items.filter((i) => i.status === "uploading");

  const syncAll = useCallback(async () => {
    if (!online || syncing) return;
    setSyncing(true);
    await processQueue();
    setSyncing(false);
  }, [online, syncing]);

  async function retryOne(item: QueueItem) {
    if (!online) return;
    setRetryingId(item.id);
    try {
      await uploadQueueItem(item);
    } catch {
      /* status updated in queue */
    }
    setRetryingId(null);
  }

  async function removeItem(id: string) {
    await removeFromQueue(id);
  }

  return (
    <div className="flex min-h-full flex-col bg-page font-fw-body">
      <OfflineBanner />
      <ScreenHeader eyebrow="Upload queue" title="Sync" onOpenAccount={onOpenAccount} />

      <main
        className="flex flex-1 flex-col px-5 py-4"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-fw-body text-[13px] text-warm">
              {pending.length} pending · {uploading.length} uploading
            </p>
          </div>
          <FWButton
            variant="primary"
            disabled={!online || syncing || pending.length === 0}
            style={{ height: 40, borderRadius: 12, padding: "0 14px", fontSize: 12 }}
            onClick={() => void syncAll()}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload size={14} strokeWidth={2.5} />
            )}
            Sync all
          </FWButton>
        </div>

        {!online && pending.length > 0 && (
          <div className="mb-4 rounded-xl border border-black/[0.08] bg-sunken px-4 py-3 font-fw-body text-xs text-warm">
            Connect to the internet to upload queued photos.
          </div>
        )}

        {pending.length === 0 && uploading.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ink">
              <CheckCircle2 className="h-6 w-6 text-lime" strokeWidth={2} />
            </div>
            <h2 className="font-fw-display text-xl text-ink">All caught up</h2>
            <p className="mt-2 max-w-xs font-fw-body text-sm text-warm">
              No pending uploads. Capture photos on site and they&apos;ll appear here if offline.
            </p>
            <FWButton
              variant="secondary"
              style={{ marginTop: 24, height: 44, borderRadius: 12, padding: "0 20px" }}
              onClick={() => onTabChange("capture")}
            >
              Go to Capture
            </FWButton>
          </div>
        )}

        {pending.length > 0 && (
          <>
            <FWSectionLabel className="mb-2">Pending uploads</FWSectionLabel>
            <div className="space-y-3">
              {pending.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-[16px] border border-black/[0.08] bg-card p-3"
                >
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-sunken">
                    {previews[item.id] ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <img src={previews[item.id]} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <RefreshCw className="h-4 w-4 text-warm-muted" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-fw-display text-[13px] text-ink">{item.projectTitle}</p>
                    <p className="font-fw-body text-[10px] text-warm">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                    {item.status === "error" && (
                      <p className="mt-1 flex items-center gap-1 font-fw-body text-[10px] text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {item.error ?? "Upload failed"}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      {(item.status === "error" || item.status === "pending") && (
                        <button
                          type="button"
                          disabled={!online || retryingId === item.id}
                          onClick={() => void retryOne(item)}
                          className="font-fw-body text-[10px] font-bold text-soil-3 underline disabled:opacity-40"
                        >
                          {retryingId === item.id ? "Retrying…" : "Retry"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeItem(item.id)}
                        className="flex items-center gap-0.5 font-fw-body text-[10px] font-bold text-warm"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {items.some((i) => i.status === "done") && (
          <button
            type="button"
            onClick={() => void clearCompleted()}
            className="mt-6 font-fw-body text-xs font-semibold text-soil-3 underline"
          >
            Clear completed
          </button>
        )}
      </main>

      <TabBar active="sync" onChange={onTabChange} />
    </div>
  );
}
