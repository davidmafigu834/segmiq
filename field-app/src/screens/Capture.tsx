import { Camera } from "lucide-react";
import { TabBar } from "../components/TabBar";
import type { TabId } from "../components/TabBar";
import { FWSectionLabel } from "../components/fw";

type Props = {
  onTabChange: (tab: TabId) => void;
};

export function Capture({ onTabChange }: Props) {
  return (
    <div className="flex min-h-full flex-col bg-page font-fw-body">
      <div className="border-b border-black/[0.06] bg-canvas px-5 py-5">
        <FWSectionLabel className="mb-1">Field capture</FWSectionLabel>
        <p className="font-fw-display text-[22px] leading-tight text-ink">Capture</p>
      </div>

      <main
        className="flex flex-1 flex-col items-center justify-center px-6 text-center"
        style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div
          className="mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-lime"
          style={{ boxShadow: "0 4px 16px rgba(212,255,79,0.28)" }}
        >
          <Camera className="h-[22px] w-[22px] text-[#111111]" strokeWidth={2} />
        </div>
        <h2 className="font-fw-display text-xl text-ink">Photo capture</h2>
        <p className="mt-2 max-w-xs font-fw-body text-sm text-warm">
          Select a project and capture site photos. Coming in Prompt 3.
        </p>
      </main>

      <TabBar active="capture" onChange={onTabChange} />
    </div>
  );
}
