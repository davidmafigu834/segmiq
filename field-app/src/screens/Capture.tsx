import { TabBar } from "../components/TabBar";
import type { TabId } from "../components/TabBar";

type Props = {
  onTabChange: (tab: TabId) => void;
};

export function Capture({ onTabChange }: Props) {
  return (
    <div className="flex min-h-full flex-col bg-cream">
      <header className="border-b border-black/[0.06] px-5 py-4">
        <p className="font-display text-[22px] text-ink">Capture</p>
      </header>
      <main
        className="flex flex-1 flex-col items-center justify-center px-6 text-center"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-lime shadow-md">
          <span className="text-3xl">📷</span>
        </div>
        <h2 className="font-display text-xl text-ink">Photo capture</h2>
        <p className="mt-2 max-w-xs text-sm text-warm">
          Select a project and capture site photos. Coming in Prompt 3.
        </p>
      </main>
      <TabBar active="capture" onChange={onTabChange} />
    </div>
  );
}
