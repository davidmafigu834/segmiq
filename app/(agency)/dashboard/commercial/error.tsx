"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function CommercialError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--error)]/40 bg-[var(--bg-secondary)] p-5" role="alert">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--error)]" aria-hidden="true" />
        <div><h2 className="text-base font-semibold text-[var(--text-primary)]">Commercial overview could not be loaded</h2><p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">No launch, billing, or customer state was changed. Retry the read-only request, or use Commercial Health to inspect database availability.</p><Button className="mt-4 min-h-11" variant="secondary" onClick={reset}>Retry overview</Button></div>
      </div>
    </div>
  );
}
