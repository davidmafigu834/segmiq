"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export function EndSupportAccessDialog({
  open,
  organisationName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  organisationName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] grid place-items-center bg-black/45 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-support-access-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-surface-card p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]">
        <h2
          id="end-support-access-title"
          className="font-display text-[18px] tracking-display text-ink-primary"
        >
          End Support Access?
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
          You will immediately lose access to {organisationName}&rsquo;s customer data.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>End Access</Button>
        </div>
      </div>
    </div>
  );
}
