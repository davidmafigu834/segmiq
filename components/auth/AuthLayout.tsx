"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";
import AuthMarketingPanel, {
  type AuthMarketingVariant,
} from "@/components/auth/AuthMarketingPanel";
import AuthThemeToggle from "@/components/auth/AuthThemeToggle";

export default function AuthLayout({
  variant,
  children,
  formMaxWidthClass = "max-w-[400px]",
}: {
  variant: AuthMarketingVariant;
  children: ReactNode;
  formMaxWidthClass?: string;
}) {
  return (
    <div className="auth-shell grid h-[100dvh] max-h-[100dvh] overflow-hidden bg-[var(--marketing-bg)] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <AuthMarketingPanel variant={variant} />

      <main className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--marketing-bg-subtle)] lg:bg-[var(--marketing-surface)]">
        {/* Mobile header */}
        <header className="flex h-14 shrink-0 items-center justify-between px-5 sm:px-8 lg:hidden">
          <SegmiqWordmark href="/" theme="auto" size="sm" priority />
          <AuthThemeToggle />
        </header>

        {/* Desktop header — same height as left logo row */}
        <header className="auth-panel-header relative z-10 hidden h-14 shrink-0 items-center justify-end px-10 xl:px-14 lg:flex">
          <AuthThemeToggle />
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4 pt-1 sm:px-8 lg:overflow-hidden lg:px-10 lg:pb-4 lg:pt-2 xl:px-14">
          <div className={`w-full ${formMaxWidthClass}`}>{children}</div>
        </div>

        <footer className="shrink-0 px-5 pb-4 pt-1 text-[12px] text-[var(--marketing-text-muted)] sm:px-8 lg:px-10 xl:px-14">
          <div className={`flex flex-wrap gap-x-4 gap-y-2 ${formMaxWidthClass}`}>
            <Link
              href="/legal/privacy"
              className="transition-colors hover:text-[var(--marketing-text)]"
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="transition-colors hover:text-[var(--marketing-text)]"
            >
              Terms
            </Link>
            <Link href="/" className="transition-colors hover:text-[var(--marketing-text)]">
              Back to segmiq.com
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
