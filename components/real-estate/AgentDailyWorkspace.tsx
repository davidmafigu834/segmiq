"use client";

import { useState } from "react";
import Link from "next/link";
import { DealSideBadge } from "@/components/real-estate/DealSideBadge";
import { RealEstateInquiryWorkspace } from "@/components/real-estate/RealEstateInquiryWorkspace";
import { Button } from "@/components/sales/ui";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import type { AgentReDashboard } from "@/lib/sales/get-agent-real-estate-dashboard";
import { OfferDetailPanel } from "@/components/real-estate/offers/OfferDetailPanel";
import { ComplianceCasePanel } from "@/components/real-estate/compliance/ComplianceCasePanel";

export function AgentDailyWorkspace({
  clientId,
  firstName,
  data,
}: {
  clientId: string;
  firstName: string;
  data: AgentReDashboard;
}) {
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <header>
        <h1 className="dashboard-greeting text-[22px] leading-tight text-sales-text-primary sm:text-[24px] layout:text-[26px]">
          Good morning, {firstName}
        </h1>
        <p className="mt-1 text-[13px] leading-snug text-sales-text-secondary">
          Here’s what needs your attention today.
        </p>
      </header>

      <div className="dashboard-group grid grid-cols-2 gap-3 md:grid-cols-4">
        <CompanyKpiCard
          item={{
            id: "new",
            label: "New inquiries",
            value: String(data.summary.newInquiries),
            supporting: "Today",
            icon: "enquiries",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "followups",
            label: "Follow-ups due",
            value: String(data.summary.followUpsDue),
            supporting: "Today",
            icon: "followups",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "viewings",
            label: "Viewings today",
            value: String(data.summary.viewingsToday),
            supporting: "Scheduled",
            icon: "customers",
          }}
        />
        <CompanyKpiCard
          item={{
            id: "attention",
            label: "Needs attention",
            value: String(data.summary.needingAttention),
            supporting: "Priority work",
            icon: "deals",
          }}
        />
      </div>

      <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
        <h2 className="text-[13px] font-semibold text-sales-text-primary">Priority customers</h2>
        {data.priorities.length === 0 ? (
          <p className="mt-3 text-[13px] text-sales-text-secondary">
            Nothing queued right now. New inquiries, due follow-ups and today’s viewings will appear here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.priorities.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-[12px] border border-sales-border-subtle px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[13px] font-semibold">{item.name}</p>
                    <DealSideBadge dealSide={item.dealSide} />
                  </div>
                  <p className="mt-0.5 text-[12px] text-sales-text-secondary">{item.why}</p>
                  <p className="text-[11px] text-sales-text-muted">NEXT: {item.nextLabel}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {item.actionId === "find_matches" ? (
                    <Button variant="primary" size="sm" onClick={() => setOpenLeadId(item.id)}>
                      Find matches
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setOpenLeadId(item.id)}>
                      Open inquiry
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
        <h2 className="text-[13px] font-semibold text-sales-text-primary">Offers needing attention</h2>
        {data.offersNeedingAttention.length === 0 ? (
          <p className="mt-3 text-[13px] text-sales-text-secondary">
            Counters, awaiting seller responses and drafts will appear here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.offersNeedingAttention.map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-2 rounded-[12px] border border-sales-border-subtle px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{o.buyerName ?? "Buyer"}</p>
                  <p className="truncate text-[12px] text-sales-text-secondary">{o.propertyLabel}</p>
                  <p className="mt-0.5 text-[12px] text-sales-text-secondary">
                    {o.why}
                    {o.amountLabel ? ` · ${o.amountLabel}` : ""}
                    {` · ${o.updatedLabel}`}
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setOpenOfferId(o.id)}>
                  {o.reason === "counter_received" ? "Review" : "Open"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.complianceActions.length > 0 ? (
        <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
          <h2 className="text-[13px] font-semibold text-sales-text-primary">Compliance action required</h2>
          <ul className="mt-3 space-y-2">
            {data.complianceActions.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-[12px] border border-sales-border-subtle px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{c.contactName}</p>
                  <p className="mt-0.5 text-[12px] text-sales-text-secondary">{c.why}</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setOpenCaseId(c.id)}>
                  {c.nextLabel.includes("Upload") ? "Upload" : "Open case"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
          <h2 className="text-[13px] font-semibold text-sales-text-primary">Today’s viewings</h2>
          {data.viewingsToday.length === 0 ? (
            <p className="mt-3 text-[13px] text-sales-text-secondary">No viewings scheduled today.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.viewingsToday.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-sales-border-subtle px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-sales-text-muted">
                      {new Date(v.scheduledAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="truncate text-[13px] font-semibold">{v.contactName ?? "Client"}</p>
                    <p className="truncate text-[12px] text-sales-text-secondary">{v.listingLabel}</p>
                  </div>
                  {v.leadId ? (
                    <Button variant="secondary" size="sm" onClick={() => setOpenLeadId(v.leadId)}>
                      Open
                    </Button>
                  ) : (
                    <Link
                      href={`/client/listings/${v.listingId}`}
                      className="rounded-[8px] border border-sales-border px-2.5 py-1 text-[11px]"
                    >
                      Open
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-card">
          <h2 className="text-[13px] font-semibold text-sales-text-primary">Follow-ups due</h2>
          {data.followUps.length === 0 ? (
            <p className="mt-3 text-[13px] text-sales-text-secondary">No follow-ups due today.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.followUps.map((f) => (
                <li
                  key={f.leadId}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-sales-border-subtle px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{f.name}</p>
                    <p className="text-[12px] text-sales-text-secondary">
                      {f.overdue ? "Overdue" : "Due today"}
                      {f.note ? ` · ${f.note}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        await fetch(`/api/clients/${clientId}/leads/${f.leadId}/real-estate`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ follow_up_date: null }),
                        });
                        window.location.reload();
                      }}
                    >
                      Complete
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setOpenLeadId(f.leadId)}>
                      Open inquiry
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {openLeadId ? (
        <RealEstateInquiryWorkspace
          clientId={clientId}
          leadId={openLeadId}
          onClose={() => setOpenLeadId(null)}
          onCall={() => undefined}
          onWhatsApp={() => undefined}
          overlay
          stacked
        />
      ) : null}

      {openOfferId ? (
        <OfferDetailPanel
          clientId={clientId}
          offerId={openOfferId}
          complianceHref={null}
          onClose={() => setOpenOfferId(null)}
          onChanged={() => window.location.reload()}
        />
      ) : null}

      {openCaseId ? (
        <ComplianceCasePanel
          clientId={clientId}
          caseId={openCaseId}
          onClose={() => setOpenCaseId(null)}
          onChanged={() => window.location.reload()}
        />
      ) : null}
    </div>
  );
}

