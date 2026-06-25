import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
};

export function ScreenHeader({ eyebrow, title, subtitle, right }: Props) {
  return (
    <header className="safe-top border-b border-border bg-bg-primary px-5 pb-4 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
          <h1 className="font-display text-[28px] leading-tight tracking-tight text-ink-primary">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-[14px] text-ink-secondary">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0 pt-1">{right}</div> : null}
      </div>
    </header>
  );
}
