import { TabBar } from "../components/TabBar";
import type { TabId } from "../components/TabBar";

type Props = {
  onTabChange: (tab: TabId) => void;
};

export function Sync({ onTabChange }: Props) {
  return (
    <div className="flex min-h-full flex-col bg-cream">
      <header className="border-b border-black/[0.06] px-5 py-4">
        <p className="font-display text-[22px] text-ink">Sync</p>
      </header>
      <main
        className="flex flex-1 flex-col items-center justify-center px-6 text-center"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ink">
          <span className="text-2xl text-lime">↻</span>
        </div>
        <h2 className="font-display text-xl text-ink">Upload queue</h2>
        <p className="mt-2 max-w-xs text-sm text-warm">
          Pending uploads and sync status will appear here. Coming in Prompt 3.
        </p>
      </main>
      <TabBar active="sync" onChange={onTabChange} />
    </div>
  );
}
