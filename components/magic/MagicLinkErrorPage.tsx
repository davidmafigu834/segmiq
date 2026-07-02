import Link from "next/link";
import { AlertCircle } from "lucide-react";

export function MagicLinkErrorPage({ reason }: { reason: "invalid" | "expired" }) {
  const expired = reason === "expired";
  return (
    <div className="flex min-h-[100dvh] w-full min-w-0 max-w-[100vw] items-center justify-center overflow-x-hidden bg-surface-canvas px-4 py-12 sm:px-6 sm:py-16">
      <div className="w-full max-w-[400px] text-center">
        <p className="mb-8 text-[15px] font-semibold tracking-tight text-accent">Segmiq</p>
        <div className="rounded-2xl border border-border bg-bg-secondary px-8 py-10">
          <div className="mx-auto mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[var(--error-border)] bg-[var(--error-muted)]">
            <AlertCircle className="h-6 w-6 text-[var(--error)]" strokeWidth={1.5} aria-hidden />
          </div>
          <h1 className="mb-3 font-display text-[20px] text-ink-primary">
            {expired ? "This link has expired" : "This link is invalid"}
          </h1>
          <p className="text-[14px] leading-relaxed text-ink-secondary">
            {expired
              ? "Magic links work for 30 days after a lead arrives. Log in to Segmiq to see the latest leads."
              : "The link you followed doesn't match any lead. It may have been mistyped."}
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex h-[42px] w-full items-center justify-center rounded-[10px] bg-accent text-[14px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            Log in to Segmiq
          </Link>
        </div>
      </div>
    </div>
  );
}
