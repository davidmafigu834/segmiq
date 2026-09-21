"use client";

import { useState } from "react";
import { cn } from "@/lib/ui/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/sales/ui";

export function SegmiQMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-sales-brand text-[10px] font-bold leading-none text-[var(--sales-ink)]",
        className
      )}
      aria-hidden
    >
      Q
    </span>
  );
}

export function SegmiQAnalysis({
  children,
  evidence,
  how,
}: {
  children: string;
  evidence?: string;
  how?: string;
}) {
  return (
    <aside className="mt-4 max-w-[68ch]">
      <p className="flex items-center gap-2 text-[12px] font-medium text-sales-text-muted">
        <SegmiQMark />
        SegmiQ analysis
      </p>
      <p className="weekly-report-prose mt-2">{children}</p>
      {evidence ? <p className="mt-2 text-[12px] text-sales-text-muted">{evidence}</p> : null}
      {how ? <HowDetermined text={how} /> : null}
    </aside>
  );
}

export function FactObservation({ fact, observation }: { fact: string; observation: string }) {
  return (
    <div className="mt-4 max-w-[68ch] space-y-3">
      <p>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Fact</span>
        <span className="mt-1 block text-[14px] leading-relaxed text-sales-text-primary">{fact}</span>
      </p>
      <p>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">
          SegmiQ observation
        </span>
        <span className="mt-1 block text-[14px] leading-relaxed text-sales-text-secondary">{observation}</span>
      </p>
    </div>
  );
}

function HowDetermined({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="mt-2 text-[12px] font-medium text-sales-text-muted underline-offset-2 hover:text-sales-text-secondary hover:underline">
        How SegmiQ determined this
      </PopoverTrigger>
      <PopoverContent className="text-[12px] leading-relaxed text-sales-text-secondary">
        {text}
      </PopoverContent>
    </Popover>
  );
}
