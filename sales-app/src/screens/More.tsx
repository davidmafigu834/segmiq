import { ExternalLink, LogOut, RefreshCw, User } from "lucide-react";
import { ScreenHeader } from "../components/ScreenHeader";
import { TabBar, type TabId } from "../components/TabBar";
import { CrmButton, CrmCard } from "../components/crm";
import { API_BASE } from "../lib/api";
import { getClientMode, getUserName } from "../lib/auth";
import { useEffect, useState } from "react";
import type { ClientMode } from "../lib/session";

type Props = {
  onTabChange: (tab: TabId) => void;
  onLogout: () => void;
  onOpenSync: () => void;
  followUpBadge: number;
  syncBadge: number;
};

export function More({ onTabChange, onLogout, onOpenSync, followUpBadge, syncBadge }: Props) {
  const [name, setName] = useState("");
  const [clientMode, setClientMode] = useState<ClientMode>("team");

  useEffect(() => {
    void getUserName().then((n) => setName(n ?? ""));
    void getClientMode().then(setClientMode);
  }, []);

  const webUrl = clientMode === "solo" ? `${API_BASE}/solo/dashboard` : `${API_BASE}/sales/dashboard`;

  return (
    <div className="flex min-h-full flex-col bg-bg-primary pb-28">
      <ScreenHeader eyebrow="Account" title="More" />

      <div className="space-y-4 px-5 pt-4">
        <CrmCard className="flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-quaternary text-accent">
            <User size={22} />
          </div>
          <div>
            <p className="font-semibold text-ink-primary">{name || "Salesperson"}</p>
            <p className="text-[13px] capitalize text-ink-tertiary">
              {clientMode === "solo" ? "Solo owner" : "Sales team"}
            </p>
          </div>
        </CrmCard>

        <button type="button" onClick={onOpenSync} className="w-full text-left">
          <CrmCard className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold text-ink-primary">Sync queue</p>
              <p className="text-[13px] text-ink-tertiary">Offline call logs</p>
            </div>
            {syncBadge > 0 ? (
              <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[11px] font-bold text-accent-ink">
                {syncBadge}
              </span>
            ) : (
              <RefreshCw size={18} className="text-ink-tertiary" />
            )}
          </CrmCard>
        </button>

        <a href={webUrl} target="_blank" rel="noopener noreferrer" className="block">
          <CrmCard className="flex items-center justify-between p-4">
            <div>
              <p className="font-semibold text-ink-primary">Open full Segmiq</p>
              <p className="text-[13px] text-ink-tertiary">Quotes, reports & settings</p>
            </div>
            <ExternalLink size={18} className="text-ink-tertiary" />
          </CrmCard>
        </a>

        <CrmButton variant="secondary" className="w-full" onClick={onLogout}>
          <LogOut size={18} /> Sign out
        </CrmButton>
      </div>

      <p className="mt-auto px-5 py-6 text-center text-[11px] text-ink-tertiary">Segmiq Sales v0.1</p>

      <TabBar
        active="more"
        onChange={onTabChange}
        followUpBadge={followUpBadge}
        syncBadge={syncBadge}
      />
    </div>
  );
}
