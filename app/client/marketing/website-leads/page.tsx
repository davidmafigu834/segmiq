import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { Globe } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { EmptyState, PageHeader } from "@/components/ui";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { getWebsiteLeadMetrics } from "@/lib/real-estate/marketing-service";
import { WebsiteIntegrationPanel } from "@/components/real-estate/WebsiteIntegrationPanel";

export const dynamic = "force-dynamic";

export default async function ClientWebsiteLeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    redirect("/login");
  }
  const supabase = createAdminClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, business_type")
    .eq("id", session.clientId)
    .maybeSingle();
  if (!client) redirect("/login");
  redirectIfNotRealEstate(client.business_type);

  const metrics = await getWebsiteLeadMetrics(session.clientId);
  const month = metrics.month;
  const latest = metrics.latest;

  return (
    <ClientManagerLayout breadcrumbPage="WEBSITE LEADS" pageTitle="Website Leads" workspaceShell>
      <div className="min-w-0 w-full max-w-full space-y-6 pb-16">
        <PageHeader
          eyebrow={`${client.name as string} / Marketing`}
          title="Website Leads"
          description="Inquiries received through the agency website integration, connected to qualification, viewings and offers."
        />

        <WebsiteIntegrationPanel clientId={session.clientId} />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { label: "Website inquiries this month", value: month.inquiries },
            { label: "Qualified", value: month.qualified },
            { label: "Viewings", value: month.viewings },
            { label: "Offers", value: month.offers },
            { label: "Accepted offers", value: month.accepted },
          ].map((c) => (
            <div key={c.label} className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface px-4 py-3">
              <p className="text-[11px] font-medium text-sales-text-muted">{c.label}</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.03em]">{c.value}</p>
            </div>
          ))}
        </div>

        {latest.length === 0 ? (
          <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
            <EmptyState
              icon={Globe}
              title="No website inquiries received yet"
              description="When the estate website posts to SegmiQ, those inquiries will list here with source, property and agent."
            />
          </div>
        ) : (
          <div className="overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
            <ul className="divide-y divide-sales-border-subtle">
              {latest.map((row) => (
                <li key={row.leadId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-sales-text-primary">{row.name}</p>
                    <p className="mt-1 text-[12px] text-sales-text-secondary">
                      {[
                        row.propertyLabel ? `Property: ${row.propertyLabel}` : null,
                        `Source: ${row.sourceLabel}`,
                        row.agentName ? `Agent: ${row.agentName}` : "Unassigned",
                        `Stage: ${row.stageLabel ?? (row.qualified ? "Qualified" : "Open")}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-0.5 text-[12px] text-sales-text-muted">
                      Received{" "}
                      {formatDistanceToNowStrict(new Date(row.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Link
                    href={`/client/leads?lead=${row.leadId}`}
                    className="rounded-[10px] border border-sales-border px-3 py-1.5 text-[12px] font-medium"
                  >
                    Open inquiry
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ClientManagerLayout>
  );
}
