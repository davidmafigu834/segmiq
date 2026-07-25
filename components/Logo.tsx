import { APP_NAME } from "@/lib/constants";
import SegmiqMark from "@/components/brand/SegmiqMark";

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <SegmiqMark size={28} />
      <div>
        <div className="font-display text-xl tracking-display text-[var(--text-on-dark)]">{APP_NAME}</div>
        {subtitle ? <div className="text-xs text-[var(--text-on-dark-dim)]">{subtitle}</div> : null}
      </div>
    </div>
  );
}

export function LogoMark({ className = "" }: { className?: string }) {
  return <SegmiqMark size={28} className={className} />;
}
