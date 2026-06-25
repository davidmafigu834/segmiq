import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Optional content rendered full-width below the title (e.g. a stats strip). */
  children?: ReactNode;
};

export function ScreenHeader({ eyebrow, title, subtitle, right, children }: Props) {
  return (
    <header
      className="border-b border-border bg-bg-primary px-5 pb-4"
      // Combine the device safe-area inset with a guaranteed minimum so the
      // header never sits under the status / notification bar on Android
      // edge-to-edge (where the inset can report 0px).
      style={{ paddingTop: "calc(max(env(safe-area-inset-top, 0px), 1.5rem) + 0.5rem)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
          <h1 className="font-display text-[28px] leading-tight tracking-tight text-ink-primary">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[14px] text-ink-secondary">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0 pt-1">{right}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
