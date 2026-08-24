"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/ui/cn";
import { Card, CardHeader, CardTitle } from "@/components/sales/ui/Card";

export function PeriodChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-sales-surface-subtle px-2 py-0.5 text-[11px] font-medium text-sales-text-muted">
      {children}
    </span>
  );
}

export function DashLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[12px] font-medium text-sales-text-secondary transition-colors hover:text-sales-text-primary"
    >
      {children}
    </Link>
  );
}

export function CompanyDashCard({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("sd-card overflow-hidden border-0 shadow-none", className)}>
      <CardHeader action={action} className="border-sales-border-subtle px-5 py-3.5">
        <CardTitle className="tracking-[-0.02em]">{title}</CardTitle>
      </CardHeader>
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
}

export function CompanyDashEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[140px] flex-col items-center justify-center px-5 py-8 text-center">
      <p className="text-[13px] font-semibold text-sales-text-primary">{title}</p>
      {description ? (
        <p className="mt-1 max-w-[280px] text-[12px] leading-relaxed text-sales-text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
