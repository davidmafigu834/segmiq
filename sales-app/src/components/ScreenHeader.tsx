import type { ReactNode } from "react";
import { HeaderActions } from "./HeaderActions";

type Props = {
  /** Hero = greeting-style (Today). Compact = single-row list headers. */
  variant?: "hero" | "compact";
  eyebrow?: string;
  title: string;
  /** Shown as a right-aligned pill in compact mode. Falls back from `badge`. */
  subtitle?: string;
  /** Right-aligned stat pill (compact) — overrides subtitle when set. */
  badge?: string;
  right?: ReactNode;
  children?: ReactNode;
};

export function ScreenHeader({
  variant = "compact",
  eyebrow,
  title,
  subtitle,
  badge,
  right,
  children,
}: Props) {
  const statLabel = badge ?? subtitle;

  if (variant === "hero") {
    return (
      <header
        className="border-b border-border bg-bg-primary px-5 pb-4"
        style={{ paddingTop: "calc(max(env(safe-area-inset-top, 0px), 1.5rem) + 0.5rem)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
            <h1 className="font-display text-[26px] leading-tight tracking-tight text-ink-primary">
              {title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {right ? <div className="pt-1">{right}</div> : null}
            <HeaderActions />
          </div>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
      </header>
    );
  }

  return (
    <header
      className="border-b border-border bg-bg-primary px-5 pb-3"
      style={{ paddingTop: "calc(max(env(safe-area-inset-top, 0px), 1.25rem) + 0.25rem)" }}
    >
      <div className="flex min-h-[44px] items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            {eyebrow ? (
              <>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
                  {eyebrow}
                </span>
                <span className="shrink-0 text-[12px] text-ink-tertiary" aria-hidden>
                  ·
                </span>
              </>
            ) : null}
            <h1 className="truncate font-display text-[22px] leading-none tracking-tight text-ink-primary">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {statLabel ? (
            <span className="rounded-full border border-border bg-bg-tertiary px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-secondary">
              {statLabel}
            </span>
          ) : null}
          {right ? <div>{right}</div> : null}
          <HeaderActions />
        </div>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}
