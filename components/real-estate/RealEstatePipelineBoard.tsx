"use client";

import { useState } from "react";
import Link from "next/link";
import { DealSideBadge } from "@/components/real-estate/DealSideBadge";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyDashboardHeader } from "@/components/dashboard/company/CompanyDashboardHeader";
import type { RealEstatePipelineData } from "@/lib/sales/get-real-estate-pipeline-data";
import type { UserRole } from "@/types";
import { cn } from "@/lib/ui/cn";

export function RealEstatePipelineBoard({
  data,
  clientName,
  companyLogoUrl,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  whatsappBadge = 0,
  inquiryBaseHref = "/client/leads",
  embedded = false,
}: {
  data: RealEstatePipelineData;
  clientName: string;
  companyLogoUrl?: string | null;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  whatsappBadge?: number;
  inquiryBaseHref?: string;
  embedded?: boolean;
}) {
  const inner = (
    <>
      <div className="layout:hidden">
        <MobileStageChips data={data} inquiryBaseHref={inquiryBaseHref} />
      </div>

      <div className="hidden gap-3 overflow-x-auto pb-2 layout:flex">
        {data.columns.map((col) => (
          <section
            key={col.id}
            className="w-[220px] shrink-0 workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-3 shadow-sales-card"
          >
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[12px] font-semibold text-sales-text-primary">{col.label}</h2>
              <span className="text-[11px] tabular-nums text-sales-text-muted">{col.count}</span>
            </div>
            {col.items.length === 0 ? (
              <p className="text-[12px] text-sales-text-muted">None</p>
            ) : (
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`${inquiryBaseHref}?lead=${encodeURIComponent(item.id)}`}
                      className="block rounded-[10px] border border-sales-border-subtle px-2.5 py-2 hover:bg-sales-surface-hover"
                    >
                      <p className="truncate text-[13px] font-medium">{item.name}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <DealSideBadge dealSide={item.dealSide} />
                        <span className="truncate text-[11px] text-sales-text-muted">
                          {item.ownerName ?? "Unassigned"}
                        </span>
                      </div>
                      {item.complianceLabel ? (
                        <p className="mt-1 truncate text-[11px] text-sales-text-muted">{item.complianceLabel}</p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
          <h2 className="text-[13px] font-semibold">Agent workload</h2>
          {data.workload.length === 0 ? (
            <p className="mt-3 text-[13px] text-sales-text-secondary">No active agent workload yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="text-sales-text-muted">
                  <tr>
                    <th className="py-1.5 font-medium">Agent</th>
                    <th className="py-1.5 font-medium">Active inquiries</th>
                    <th className="py-1.5 font-medium">Follow-ups due</th>
                    <th className="py-1.5 font-medium">Viewings this week</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workload.map((w) => (
                    <tr key={w.id} className="border-t border-sales-border-subtle">
                      <td className="py-2 font-medium text-sales-text-primary">{w.name}</td>
                      <td className="py-2 tabular-nums">{w.activeInquiries}</td>
                      <td className="py-2 tabular-nums">{w.followUpsDue}</td>
                      <td className="py-2 tabular-nums">{w.viewingsThisWeek}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
          <h2 className="text-[13px] font-semibold">Needs attention</h2>
          {data.attention.length === 0 ? (
            <p className="mt-3 text-[13px] text-sales-text-secondary">
              No inquiries currently need attention.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.attention.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`${inquiryBaseHref}?lead=${encodeURIComponent(item.id)}`}
                    className="block rounded-[10px] border border-sales-border-subtle px-3 py-2 hover:bg-sales-surface-hover"
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-medium">{item.name}</p>
                      <DealSideBadge dealSide={item.dealSide} />
                    </div>
                    <p className="mt-0.5 text-[12px] text-sales-text-secondary">{item.why}</p>
                    <p className="text-[11px] text-sales-text-muted">NEXT: {item.nextLabel}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );

  if (embedded) return <div className="space-y-4">{inner}</div>;

  return (
    <CompanyWorkspaceShell
      companyName={clientName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
      businessType="real_estate"
    >
      <CompanyDashboardHeader
        unreadNotifications={unreadNotifications}
        notificationRole={notificationRole}
        userName={userName}
        avatarUrl={avatarUrl}
        canAddLead={false}
        breadcrumb="Company / Pipeline"
        title="Pipeline"
        description="Inquiries by stage, agent workload, and work that needs attention."
      />
      {inner}
    </CompanyWorkspaceShell>
  );
}

function MobileStageChips({
  data,
  inquiryBaseHref,
}: {
  data: RealEstatePipelineData;
  inquiryBaseHref: string;
}) {
  const firstWithItems = data.columns.find((c) => c.count > 0)?.id ?? data.columns[0]?.id ?? null;
  const [active, setActive] = useState(firstWithItems);
  const col = data.columns.find((c) => c.id === active) ?? data.columns[0];
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {data.columns.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              c.id === col?.id
                ? "border-sales-brand bg-sales-brand/15 text-sales-text-primary"
                : "border-sales-border text-sales-text-secondary"
            )}
          >
            {c.label} {c.count}
          </button>
        ))}
      </div>
      {col ? (
        <ul className="space-y-2">
          {col.items.length === 0 ? (
            <li className="text-[13px] text-sales-text-secondary">No inquiries in this stage.</li>
          ) : (
            col.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${inquiryBaseHref}?lead=${encodeURIComponent(item.id)}`}
                  className="block rounded-[12px] border border-sales-border px-3 py-2.5"
                >
                  <p className="font-medium">{item.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <DealSideBadge dealSide={item.dealSide} />
                    <span className="text-[11px] text-sales-text-muted">
                      {item.ownerName ?? "Unassigned"}
                    </span>
                  </div>
                  {item.complianceLabel ? (
                    <p className="mt-1 text-[11px] text-sales-text-muted">{item.complianceLabel}</p>
                  ) : null}
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
