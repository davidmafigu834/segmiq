"use client";

import Link from "next/link";
import { Check, CircleAlert, Loader2, Minus } from "lucide-react";
import { Button } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import { formatSalesMoney, type SalesBlock, type SalesChoice, type ProgressStep, type QuotationDraftPreview, type CommercialCheckPreview } from "@/lib/agent/sales/types";

function CheckIcon({ status }: { status: "pass" | "warn" | "block" }) {
  if (status === "pass") {
    return <span className="font-semibold text-sales-success-fg" aria-hidden>✓</span>;
  }
  if (status === "warn") {
    return <span className="font-semibold text-sales-warning-fg" aria-hidden>⚠</span>;
  }
  return <span className="font-semibold text-sales-danger-fg" aria-hidden>●</span>;
}

export function CommandProgress({ steps }: { steps: ProgressStep[] }) {
  return (
    <ol className="space-y-1.5" aria-live="polite" aria-label="Command progress">
      {steps.map((s) => (
        <li key={s.id} className="flex items-center gap-2 text-[13px]">
          {s.status === "done" ? (
            <Check size={14} strokeWidth={2.2} className="shrink-0 text-sales-success-fg" aria-hidden />
          ) : s.status === "failed" ? (
            <CircleAlert size={14} strokeWidth={2} className="shrink-0 text-sales-danger-fg" aria-hidden />
          ) : s.status === "running" ? (
            <Loader2 size={14} className="shrink-0 animate-spin text-sales-text-muted" aria-hidden />
          ) : (
            <Minus size={14} className="shrink-0 text-sales-text-muted/50" aria-hidden />
          )}
          <span className={s.status === "failed" ? "text-sales-danger-fg" : "text-sales-text-primary"}>
            {s.label}
          </span>
          {s.detail ? <span className="truncate text-sales-text-muted">· {s.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function EntitySelector({
  prompt,
  options,
  onSelect,
  disabled,
}: {
  prompt: string;
  options: SalesChoice[];
  onSelect: (option: SalesChoice) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-sales-text-primary">{prompt}</p>
      <ul className="mt-2 space-y-1.5">
        {options.map((opt) => (
          <li key={opt.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(opt)}
              className="flex w-full min-h-11 flex-col items-start rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2.5 text-left hover:border-sales-border-strong hover:bg-sales-surface-hover disabled:opacity-60"
            >
              <span className="text-[13px] font-semibold text-sales-text-primary">{opt.title}</span>
              <span className="text-[12px] text-sales-text-secondary">
                {[opt.subtitle, opt.status, opt.availableLabel].filter(Boolean).join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommercialCheckSummary({ check }: { check: CommercialCheckPreview }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
        Commercial Check
      </p>
      <ul className="mt-2 space-y-1">
        {check.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-[13px]">
            <CheckIcon status={item.status} />
            <span className="text-sales-text-primary">{item.label}</span>
            {item.action && item.status !== "pass" ? (
              <span className="text-sales-text-muted">· {item.action}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] font-semibold text-sales-text-primary">{check.readyLabel}</p>
    </div>
  );
}

export function QuotationDraftCard({
  preview,
  onDiscard,
}: {
  preview: QuotationDraftPreview;
  onDiscard?: () => void;
}) {
  const cur = preview.currency;
  return (
    <article className="rounded-[12px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
        Quotation {preview.isRevision ? "revision" : "draft"}
      </p>
      <h3 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-sales-text-primary">
        {preview.quoteNumber}
      </h3>
      <p className="mt-0.5 text-[13px] text-sales-text-secondary">
        {preview.customerName}
        {preview.dealName ? ` · ${preview.dealName}` : ""}
      </p>
      <div className="mt-3 space-y-1.5 border-t border-sales-border-subtle pt-3">
        {preview.lines.map((line, i) => (
          <div key={`${line.name}-${i}`} className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 text-sales-text-primary">
              {line.name}
              <span className="text-sales-text-muted"> · {line.quantity} × {formatSalesMoney(line.unitPrice, cur)}</span>
            </span>
            <span className="shrink-0 tabular-nums font-medium text-sales-text-primary">
              {formatSalesMoney(line.amount, cur)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1 border-t border-sales-border-subtle pt-3 text-[13px]">
        <div className="flex justify-between text-sales-text-secondary">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatSalesMoney(preview.subtotal, cur)}</span>
        </div>
        {preview.taxAmount > 0 ? (
          <div className="flex justify-between text-sales-text-secondary">
            <span>Tax</span>
            <span className="tabular-nums">{formatSalesMoney(preview.taxAmount, cur)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-[15px] font-semibold text-sales-text-primary">
          <span>Total</span>
          <span className="tabular-nums">{formatSalesMoney(preview.total, cur)}</span>
        </div>
        {preview.validUntil ? (
          <p className="text-[12px] text-sales-text-muted">Valid until {preview.validUntil}</p>
        ) : null}
      </div>
      {preview.inventoryNotes.length ? (
        <p className="mt-2 text-[12px] text-sales-warning-fg">{preview.inventoryNotes[0]}</p>
      ) : null}
      {preview.sendRequested ? (
        <p className="mt-2 text-[12px] text-sales-text-secondary">
          I&apos;ve prepared the quotation. Please review it before sending.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={preview.href}
          className="inline-flex min-h-11 items-center justify-center rounded-sales-md bg-sales-brand px-4 text-[13px] font-semibold text-sales-brand-text shadow-sales-card"
        >
          View quotation
        </Link>
        {onDiscard ? (
          <Button type="button" variant="ghost" size="md" onClick={onDiscard}>
            Discard Draft
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function SalesCommandBlocks({
  blocks,
  onSelect,
  onAction,
  disabled,
}: {
  blocks: SalesBlock[];
  onSelect: (option: SalesChoice) => void;
  onAction: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.type === "text") {
          return (
            <p key={i} className="whitespace-pre-wrap text-[14px] leading-relaxed text-sales-text-primary">
              {block.text}
            </p>
          );
        }
        if (block.type === "progress") return <CommandProgress key={i} steps={block.steps} />;
        if (block.type === "quotation_draft") {
          return (
            <QuotationDraftCard
              key={i}
              preview={block.preview}
              onDiscard={() => onAction(`Discard draft ${block.preview.quoteNumber}`)}
            />
          );
        }
        if (block.type === "commercial_check") return <CommercialCheckSummary key={i} check={block.check} />;
        if (block.type === "choice") {
          return (
            <EntitySelector
              key={i}
              prompt={block.prompt}
              options={block.options}
              onSelect={onSelect}
              disabled={disabled}
            />
          );
        }
        if (block.type === "requirements") {
          return (
            <div key={i}>
              <p className="text-[13px] font-medium text-sales-text-primary">{block.prompt}</p>
              <ul className="mt-2 space-y-1 text-[13px] text-sales-text-secondary">
                {block.items.map((it, idx) => (
                  <li key={idx}>
                    {it.quantity != null ? `${it.quantity} × ` : ""}
                    {it.label}
                    {it.status !== "CONFIRMED" ? ` · ${it.status.toLowerCase()}` : ""}
                  </li>
                ))}
              </ul>
              {block.location ? (
                <p className="mt-1 text-[12px] text-sales-text-muted">Delivery location: {block.location}</p>
              ) : null}
            </div>
          );
        }
        if (block.type === "variant_allocator") {
          return (
            <div key={i}>
              <p className="text-[13px] font-medium text-sales-text-primary">{block.prompt}</p>
              <p className="mt-1 text-[12px] text-sales-text-muted">
                Requested {block.requestedTotal}. Allocated {block.allocatedTotal}.
              </p>
              <ul className="mt-2 space-y-1 text-[13px]">
                {block.variants.map((v) => (
                  <li key={v.id} className="text-sales-text-secondary">
                    {v.name}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (block.type === "status") {
          return (
            <p
              key={i}
              className={cn(
                "text-[14px] leading-relaxed",
                block.kind === "error" || block.kind === "denied" || block.kind === "blocked"
                  ? "text-sales-danger-fg"
                  : "text-sales-text-primary"
              )}
            >
              {block.message}
            </p>
          );
        }
        if (block.type === "actions") {
          return (
            <div key={i} className="flex flex-wrap gap-2">
              {block.actions.map((a) =>
                a.href ? (
                  <Link
                    key={a.label}
                    href={a.href}
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center rounded-sales-md px-4 text-[13px] font-semibold",
                      a.style === "primary"
                        ? "bg-sales-brand text-sales-brand-text shadow-sales-card"
                        : "border border-sales-border-strong bg-sales-surface text-sales-text-primary"
                    )}
                  >
                    {a.label}
                  </Link>
                ) : (
                  <Button
                    key={a.label}
                    type="button"
                    variant={a.style === "danger" ? "ghost" : a.style === "primary" ? "primary" : "secondary"}
                    size="md"
                    disabled={disabled}
                    onClick={() => a.prompt && onAction(a.prompt)}
                  >
                    {a.label}
                  </Button>
                )
              )}
            </div>
          );
        }
        if (block.type === "learning") {
          return (
            <p key={i} className="text-[12px] text-sales-text-secondary">
              <span className="font-medium text-sales-text-primary">{block.title}.</span> {block.body}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
