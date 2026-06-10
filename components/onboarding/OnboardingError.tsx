"use client";

import { AlertCircle } from "lucide-react";

export function OnboardingError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4 py-12">
      <div className="w-full max-w-[400px] text-center">
        <p className="mb-8 text-[15px] font-semibold tracking-tight text-[var(--accent)]">Segmiq</p>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] px-8 py-10">
          <div className="mx-auto mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[var(--error-border)] bg-[var(--error-muted)]">
            <AlertCircle className="h-6 w-6 text-[var(--error)]" strokeWidth={1.5} />
          </div>
          <h1
            className="mb-3 text-[20px] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-instrument-serif), 'Instrument Serif', serif" }}
          >
            Link not valid
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">{message}</p>
        </div>
      </div>
    </div>
  );
}
