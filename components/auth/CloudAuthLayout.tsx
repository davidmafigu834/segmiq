"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import CloudAuthMarketingPanel from "@/components/auth/CloudAuthMarketingPanel";
import AuthThemeToggle from "@/components/auth/AuthThemeToggle";

export default function CloudAuthLayout({
  children,
  formMaxWidthClass = "max-w-[400px]",
}: {
  children: ReactNode;
  formMaxWidthClass?: string;
}) {
  return (
    <div className="auth-shell grid h-[100dvh] max-h-[100dvh] overflow-hidden bg-[var(--marketing-bg)] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <CloudAuthMarketingPanel />

      <main className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--marketing-bg-subtle)] lg:bg-[var(--marketing-surface)]">
        <header className="flex h-14 shrink-0 items-center justify-between px-5 sm:px-8 lg:hidden">
          <Link href="/cloud" className="inline-flex items-center gap-2.5">
            <Image
              src="/brand/segmiq-q.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-[11px] object-cover"
              priority
            />
            <span className="text-[14px] font-semibold text-[var(--marketing-text)]">
              SegmiQ Cloud
            </span>
          </Link>
          <AuthThemeToggle />
        </header>

        <header className="auth-panel-header relative z-10 hidden h-14 shrink-0 items-center justify-end px-10 xl:px-14 lg:flex">
          <AuthThemeToggle />
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4 pt-1 sm:px-8 lg:px-10 lg:pb-4 lg:pt-2 xl:px-14">
          <div className={`w-full ${formMaxWidthClass}`}>{children}</div>
        </div>

        <footer className="shrink-0 px-5 pb-4 pt-1 text-[12px] text-[var(--marketing-text-muted)] sm:px-8 lg:px-10 xl:px-14">
          <div className={`flex flex-wrap gap-x-4 gap-y-2 ${formMaxWidthClass}`}>
            <Link href="/login" className="transition-colors hover:text-[var(--marketing-text)]">
              Agency login
            </Link>
            <Link href="/cloud" className="transition-colors hover:text-[var(--marketing-text)]">
              SegmiQ Cloud
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
