import { RefreshCw } from "lucide-react";
import { TabBar } from "../components/TabBar";
import type { TabId } from "../components/TabBar";
import { FWSectionLabel } from "../components/fw";

type Props = {
  onTabChange: (tab: TabId) => void;
};

export function Sync({ onTabChange }: Props) {
  return (
    <div className="flex min-h-full flex-col bg-page font-fw-body">
      <div className="border-b border-black/[0.06] bg-canvas px-5 py-5">
        <FWSectionLabel className="mb-1">Upload queue</FWSectionLabel>
        <p className="font-fw-display text-[22px] leading-tight text-ink">Sync</p>
      </div>

      <main
        className="flex flex-1 flex-col items-center justify-center px-6 text-center"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-ink">
          <RefreshCw className="h-6 w-6 text-lime" strokeWidth={2} />
        </div>
        <h2 className="font-fw-display text-xl text-ink">Upload queue</h2>
        <p className="mt-2 max-w-xs font-fw-body text-sm text-warm">
          Pending uploads and sync status will appear here. Coming in Prompt 3.
        </p>
      </main>

      <TabBar active="sync" onChange={onTabChange} />
    </div>
  );
}
