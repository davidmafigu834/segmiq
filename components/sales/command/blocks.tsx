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
    <div className="rounded-[10px] border border-sales-border-subtle bg-sales-surface-subtle px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          Commercial Check
        </p>
        <p className="text-[12px] font-medium text-sales-text-primary">{check.readyLabel}</p>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {check.items.map((item) => (
          <li key={item.id} className="inline-flex items-center gap-1.5 text-[12px] text-sales-text-secondary">
            <CheckIcon status={item.status} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
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
    <article className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface shadow-sales-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-sales-border-subtle px-4 py-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-sales-text-primary">
              {preview.quoteNumber}
            </h3>
            <span className="rounded-[6px] border border-sales-border bg-sales-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-sales-text-secondary">
              {preview.status || (preview.isRevision ? "Revision" : "Draft")}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-sales-text-secondary">{preview.customerName}</p>
          {preview.dealName ? (
            <p className="mt-0.5 text-[12px] text-sales-text-muted">Deal · {preview.dealName}</p>
          ) : null}
          {preview.validUntil ? (
            <p className="mt-0.5 text-[12px] text-sales-text-muted">Valid until {preview.validUntil}</p>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-sales-border-subtle text-[10px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
              <th className="px-4 py-2 font-semibold">Item</th>
              <th className="px-3 py-2 text-right font-semibold">Qty</th>
              <th className="px-3 py-2 text-right font-semibold">Unit price</th>
              <th className="px-4 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {preview.lines.map((line, i) => (
              <tr key={`${line.name}-${i}`} className="border-b border-sales-border-subtle/70">
                <td className="px-4 py-2.5 text-sales-text-primary">{line.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sales-text-secondary">{line.quantity}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sales-text-secondary">
                  {formatSalesMoney(line.unitPrice, cur)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-sales-text-primary">
                  {formatSalesMoney(line.amount, cur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 border-b border-sales-border-subtle px-4 py-3 text-[13px]">
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
      </div>

      <div className="space-y-3 px-4 py-3.5">
        <CommercialCheckSummary check={preview.commercialCheck} />
        {preview.inventoryNotes.length ? (
          <p className="text-[12px] text-sales-warning-fg">{preview.inventoryNotes[0]}</p>
        ) : null}
        {preview.sendRequested ? (
          <p className="text-[12px] text-sales-text-secondary">
            Draft prepared for review — send from the quotation workspace.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Link
            href={preview.href}
            className="inline-flex min-h-10 items-center justify-center rounded-sales-md bg-sales-brand px-4 text-[13px] font-semibold text-sales-brand-text shadow-sales-card"
          >
            View quotation
          </Link>
          <Link
            href={preview.href}
            className="inline-flex min-h-10 items-center justify-center rounded-sales-md border border-sales-border-strong bg-sales-surface px-4 text-[13px] font-semibold text-sales-text-primary"
          >
            Edit quotation
          </Link>
          {onDiscard ? (
            <Button type="button" variant="ghost" size="md" onClick={onDiscard}>
              Discard Draft
            </Button>
          ) : null}
        </div>
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
  const hasDraft = blocks.some((b) => b.type === "quotation_draft");
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
        if (block.type === "commercial_check") {
          if (hasDraft) return null;
          return <CommercialCheckSummary key={i} check={block.check} />;
        }
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
