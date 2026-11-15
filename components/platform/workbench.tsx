import type { ReactNode } from "react";
import Link from "next/link";

export type WorkMark = "overdue" | "today" | "waiting";

const ink =
  "inline-flex h-9 shrink-0 items-center rounded-[8px] bg-[var(--text-primary)] px-3 text-[13px] font-semibold text-[var(--bg-primary)]";
const line =
  "inline-flex h-9 shrink-0 items-center rounded-[8px] border border-[var(--border)] bg-transparent px-3 text-[13px] font-semibold text-[var(--text-primary)]";

export function Fact({
  name,
  detail,
  action,
  href,
}: {
  name: string;
  detail: string;
  action: string;
  href: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-4">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-[var(--text-tertiary)]">Needs a decision</p>
        <p className="mt-1 text-[16px] font-semibold leading-6 text-[var(--text-primary)]">{name}</p>
        <p className="mt-1 max-w-[62ch] text-[14px] text-[var(--text-secondary)]">{detail}</p>
      </div>
      <Link href={href} className={`${ink} h-11 px-4 text-[14px]`}>
        {action}
      </Link>
    </div>
  );
}

export function Panel({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 flex items-center gap-2 text-[18px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
        <span className="truncate">{title}</span>
        {count != null ? (
          <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] px-1.5 text-[12px] font-semibold leading-none tabular-nums">
            {count}
          </span>
        ) : null}
      </h2>
      <div className="overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] [&>ul>li:first-child]:border-t-0">
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
  href,
  extra,
}: {
  name: string;
  meta: string;
  detail: string;
  mark?: WorkMark;
  action: string;
  href: string;
  extra?: ReactNode;
}) {
  const rule = mark === "overdue" ? "bg-[var(--error)]" : mark === "today" ? "bg-[var(--accent)]" : "bg-[var(--border)]";
  return (
    <li className="flex items-center gap-3 border-t border-[var(--border)] px-4 py-3">
      <span className={`h-8 w-[3px] shrink-0 rounded-full ${rule}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="truncate text-[12px] text-[var(--text-tertiary)]">{meta}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-[var(--text-secondary)]">{detail}</p>
      </div>
      {extra}
      <Link href={href} className={ink}>
        {action}
      </Link>
    </li>
  );
}

export function QuietRow({
  name,
  detail,
  action,
  href,
}: {
  name: string;
  detail: string;
  action?: string;
  href?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{name}</p>
        <p className="truncate text-[13px] text-[var(--text-secondary)]">{detail}</p>
      </div>
      {action && href ? (
        <Link href={href} className={line}>
          {action}
        </Link>
      ) : null}
    </li>
  );
}

export function EmptyNote({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-4 py-8">
      <p className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 max-w-[52ch] text-[14px] text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}
