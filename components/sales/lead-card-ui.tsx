"use client";

import { useEffect, useState } from "react";
import type { FreshnessState } from "@/lib/sales-priority-lead";

const SLA_TARGET_MS = 5 * 60 * 1000;

export function LeadCardSlaCountdown({ createdAt }: { createdAt: string }) {
  const [remainingMs, setRemainingMs] = useState(
    () => SLA_TARGET_MS - (Date.now() - new Date(createdAt).getTime())
  );

  useEffect(() => {
    const tick = () =>
      setRemainingMs(SLA_TARGET_MS - (Date.now() - new Date(createdAt).getTime()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  if (remainingMs <= 0) {
    const lateMins = Math.max(1, Math.ceil(Math.abs(remainingMs) / 60_000));
    return <span className="font-semibold text-[var(--warning)]">SLA {lateMins}m late</span>;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return (
    <span className="font-semibold text-[var(--accent-fg)]">
      SLA {mins}:{secs.toString().padStart(2, "0")} left
    </span>
  );
}

export function LeadCardFreshnessPill({
  state,
  compact,
}: {
  state: FreshnessState;
  compact?: boolean;
}) {
  if (state === "fresh") return null;
  const copy = state === "slipping" ? "Needs attention" : "Overdue";
  const className =
    state === "slipping"
      ? "border-[var(--warning-border)] bg-[var(--warning-muted)] text-[var(--warning)]"
      : "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-fg)]";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border font-semibold leading-none ${className} ${
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      {copy}
    </span>
  );
}

export function LeadCardIconAction({
  children,
  onClick,
  href,
  disabled,
  label,
  compact,
  accentClass,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  label: string;
  compact?: boolean;
  accentClass?: string;
}) {
  const className = `inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-35 ${
    compact ? "h-8 w-8" : "h-9 w-9"
  } ${accentClass ?? ""}`;

  if (disabled) {
    return (
      <span className={className} aria-hidden>
        {children}
      </span>
    );
  }

  if (href) {
    return (
      <a href={href} className={className} aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}
