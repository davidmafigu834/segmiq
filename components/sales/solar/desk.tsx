"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import "./solar-desk.css";

export const inkBtn =
  "so-btn h-9 shrink-0 bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface";
export const lineBtn =
  "so-btn h-9 shrink-0 border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover";
export const limeBtn =
  "so-btn inline-flex h-11 items-center justify-center gap-2 bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text";

export function Head({
  kicker,
  title,
  detail,
  action,
  onAction,
}: {
  kicker: string;
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-sales-text-muted">{kicker}</p>
        <h1 className="mt-1 break-words font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">{title}</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] text-sales-text-secondary">{detail}</p>
      </div>
      {action ? (
        <button type="button" onClick={onAction} className={limeBtn}>
          <Plus size={16} strokeWidth={1.75} aria-hidden />
          {action}
        </button>
      ) : null}
    </div>
  );
}

export function Panel({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 flex items-center gap-2 font-display text-[18px] font-semibold leading-tight tracking-[-0.02em] text-sales-text-primary">
        <span className="truncate">{title}</span>
        {count != null ? (
          <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-sales-border bg-sales-surface px-1.5 font-sans text-[12px] font-semibold leading-none tabular-nums tracking-normal">
            {count}
          </span>
        ) : null}
      </h2>
      <div className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface [&>ul>li:first-child]:border-t-0">
        {children}
      </div>
    </section>
  );
}

export function WorkRow({
  name,
  meta,
  detail,
  mark = "waiting",
  action,
  onAction,
}: {
  name: string;
  meta: string;
  detail: string;
  mark?: "overdue" | "today" | "waiting";
  action: string;
  onAction?: () => void;
}) {
  const rule = mark === "overdue" ? "bg-sales-danger" : mark === "today" ? "bg-sales-brand" : "bg-sales-border";
  return (
    <li className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
      <span className={`h-8 w-[3px] shrink-0 rounded-full ${rule}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-sales-text-primary">{name}</p>
        <p className="truncate text-[12px] text-sales-text-muted">{meta}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-sales-text-secondary">{detail}</p>
      </div>
      <button type="button" onClick={onAction} className={inkBtn}>
        {action}
      </button>
    </li>
  );
}

export function EmptyNote({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-4 py-8">
      <p className="text-[15px] font-semibold text-sales-text-primary">{title}</p>
      <p className="mt-1 max-w-[52ch] text-[14px] text-sales-text-secondary">{detail}</p>
    </div>
  );
}

export function Bones() {
  return (
    <ul aria-hidden>
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3 first:border-t-0">
          <span className="so-bone h-8 w-[3px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <span className="so-bone block h-3.5 w-36 max-w-[46%]" />
            <span className="so-bone block h-3 w-52 max-w-[62%]" />
          </div>
          <span className="so-bone h-9 w-16 shrink-0" />
        </li>
      ))}
    </ul>
  );
}

export function SolarPageBones({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-8" aria-busy="true" aria-label={label}>
      <div className="space-y-2">
        <span className="so-bone block h-3 w-16" />
        <span className="so-bone block h-8 w-48 max-w-[70%]" />
        <span className="so-bone block h-4 w-80 max-w-full" />
      </div>
      <section className="overflow-hidden rounded-[6px] border border-sales-border bg-sales-surface">
        <Bones />
      </section>
    </div>
  );
}
