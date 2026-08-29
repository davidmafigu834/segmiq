import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { Globe } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { EmptyState } from "@/components/ui";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { getWebsiteLeadMetrics } from "@/lib/real-estate/marketing-service";
import { WebsiteIntegrationPanel } from "@/components/real-estate/WebsiteIntegrationPanel";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";

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
    <ClientManagerLayout
      breadcrumbPage="WEBSITE LEADS"
      pageTitle="Website Leads"
      workspaceShell
      workspaceTitle="Website leads"
      workspaceDescription="Inquiries received through the agency website integration, connected to qualification, viewings and offers."
    >
      <div className="min-w-0 w-full max-w-full space-y-3">
        <WebsiteIntegrationPanel clientId={session.clientId} />

        <div className="dashboard-group grid grid-cols-2 gap-3 lg:grid-cols-5">
          <CompanyKpiCard
            item={{
              id: "inquiries",
              label: "Website inquiries",
              value: String(month.inquiries),
              supporting: "This month",
              icon: "enquiries",
            }}
          />
          <CompanyKpiCard
            item={{
              id: "qualified",
              label: "Qualified",
              value: String(month.qualified),
              supporting: "This month",
              icon: "customers",
            }}
          />
          <CompanyKpiCard
            item={{
              id: "viewings",
              label: "Viewings",
              value: String(month.viewings),
              supporting: "This month",
              icon: "followups",
            }}
          />
          <CompanyKpiCard
            item={{
              id: "offers",
              label: "Offers",
              value: String(month.offers),
              supporting: "This month",
              icon: "deals",
            }}
          />
          <CompanyKpiCard
            item={{
              id: "accepted",
              label: "Accepted offers",
              value: String(month.accepted),
              supporting: "This month",
              icon: "won",
            }}
          />
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
