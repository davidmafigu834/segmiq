import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { ScreenHeader } from "../components/ScreenHeader";
import { TabBar, type TabId } from "../components/TabBar";
import { CrmButton, CrmCard } from "../components/crm";
import {
  getQueueItems,
  removeItem,
  retryItem,
  subscribeCallLogQueue,
  syncQueue,
  type CallLogQueueItem,
} from "../lib/call-log-queue";
import { useOnline } from "../hooks/useOnline";

type Props = {
  onTabChange: (tab: TabId) => void;
  followUpBadge: number;
  syncBadge: number;
  onSyncComplete: () => void;
};

export function Sync({ onTabChange, followUpBadge, syncBadge, onSyncComplete }: Props) {
  const online = useOnline();
  const [items, setItems] = useState<CallLogQueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => subscribeCallLogQueue(setItems), []);

  const load = useCallback(async () => {
    setItems(await getQueueItems());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSyncAll() {
    if (!online) return;
    setSyncing(true);
    try {
      await syncQueue();
      onSyncComplete();
    } finally {
      setSyncing(false);
    }
  }

  const pending = items.filter((i) => i.status !== "done");

  return (
    <div className="flex min-h-full flex-col bg-bg-primary pb-28">
      <ScreenHeader
        eyebrow="Offline queue"
        title="Sync"
        badge={`${pending.length} pending`}
        right={
          <button
            type="button"
            disabled={!online || syncing || pending.length === 0}
            onClick={() => void handleSyncAll()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-tertiary text-accent disabled:opacity-40"
          >
            <RefreshCw size={18} className={syncing ? "animate-spin" : ""} />
          </button>
        }
      />

      <div className="flex-1 space-y-3 px-5 pt-4">
        {!online ? (
          <p className="rounded-lg bg-[var(--warning)]/10 px-4 py-3 text-[14px] text-[var(--warning)]">
            Connect to the internet to sync queued call logs.
          </p>
        ) : null}

        {pending.length === 0 ? (
          <CrmCard className="p-8 text-center">
            <p className="text-[16px] font-semibold text-ink-primary">All synced</p>
            <p className="mt-1 text-[14px] text-ink-tertiary">No pending call logs</p>
          </CrmCard>
        ) : (
          pending.map((item) => (
            <CrmCard key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink-primary">{item.leadName}</p>
                  <p className="mt-1 text-[13px] capitalize text-ink-tertiary">
                    {item.payload.reachOutcome.replace("_", " ")}
                    {item.status === "error" ? " · failed" : ""}
                  </p>
                  {item.error ? (
                    <p className="mt-1 text-[12px] text-[var(--error)]">{item.error}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {item.status === "error" ? (
                    <button
                      type="button"
                      onClick={() => void retryItem(item.id).then(() => void handleSyncAll())}
                      className="rounded-lg bg-bg-tertiary px-3 py-2 text-[13px] text-accent"
                    >
                      Retry
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void removeItem(item.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary text-ink-tertiary"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </CrmCard>
          ))
        )}

        {pending.length > 0 && online ? (
          <CrmButton className="w-full" disabled={syncing} onClick={() => void handleSyncAll()}>
            {syncing ? "Syncing…" : "Sync now"}
          </CrmButton>
        ) : null}
      </div>

      <TabBar
        active="more"
        onChange={onTabChange}
        followUpBadge={followUpBadge}
        syncBadge={syncBadge}
      />
    </div>
  );
}
