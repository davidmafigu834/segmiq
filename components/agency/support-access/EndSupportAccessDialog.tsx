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
      className="fixed inset-0 z-[140] grid place-items-center bg-black/45 px-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-support-access-title"
        className="w-full max-w-[420px] rounded-[6px] border border-[var(--border)] bg-[var(--bg-primary)] p-5"
      >
        <h2
          id="end-support-access-title"
          className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]"
        >
          End support access
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">
          You will immediately lose access to {organisationName}&rsquo;s customer data.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>End access</Button>
        </div>
      </div>
    </div>
  );
}
