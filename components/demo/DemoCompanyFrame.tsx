import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import type { ReactNode } from "react";

export type DemoRecord = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};

export function DemoCompanyFrame({
  userName,
  breadcrumbPage,
  pageTitle,
  title,
  description,
  children,
}: {
  userName: string;
  breadcrumbPage: string;
  pageTitle: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <ClientManagerLayout breadcrumbPage={breadcrumbPage} pageTitle={pageTitle} hideShellHeader hideShellSidebar>
      <CompanyWorkspaceShell
        userName={userName}
        unreadNotifications={0}
        notificationRole="CLIENT_MANAGER"
        companyName={undefined}
      >
        <div className="space-y-4 px-4 py-4 sm:px-6">
          <header>
            <h1 className="text-lg font-semibold text-sales-text">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-sales-text-secondary">{description}</p>
          </header>
          {children}
        </div>
      </CompanyWorkspaceShell>
    </ClientManagerLayout>
  );
}

export function DemoRecordList({ rows, empty }: { rows: DemoRecord[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="rounded-sales-md border border-sales-border bg-sales-surface p-4 text-sm text-sales-text-muted">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-sales-border overflow-hidden rounded-sales-md border border-sales-border bg-sales-surface">
      {rows.map((row) => (
        <li key={row.id} className="px-4 py-3">
          <p className="text-sm font-semibold text-sales-text">{row.title}</p>
          <p className="mt-1 text-[13px] leading-5 text-sales-text-secondary">{row.detail}</p>
          {row.href ? (
            <a className="mt-2 inline-block text-[13px] font-medium underline" href={row.href}>
              Open
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
