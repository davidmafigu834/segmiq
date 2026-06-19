import { Settings2 } from "lucide-react";
import { FWSectionLabel } from "./fw";

type Props = {
  eyebrow: string;
  title: string;
  onOpenAccount?: () => void;
};

/** Shared top bar for main field-app screens. */
export function ScreenHeader({ eyebrow, title, onOpenAccount }: Props) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] bg-canvas px-5 py-5">
      <div>
        <FWSectionLabel className="mb-1">{eyebrow}</FWSectionLabel>
        <p className="font-fw-display text-[22px] leading-tight text-ink">{title}</p>
      </div>
      {onOpenAccount && (
        <button
          type="button"
          onClick={onOpenAccount}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-black/[0.08] bg-card"
          aria-label="Account and settings"
        >
          <Settings2 className="h-[18px] w-[18px] text-soil-3" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
