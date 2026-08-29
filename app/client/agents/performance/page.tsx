import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getCompanyTeamPageData } from "@/lib/sales/get-company-team-page-data";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { EmptyState } from "@/components/ui";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientAgentPerformancePage() {
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

  const data = await getCompanyTeamPageData({
    clientId: session.clientId,
    actor: {
      userId: session.userId,
      role: session.role,
      clientId: session.clientId,
    },
    alsoSells: Boolean(session.alsoSells),
  });

  const agents = data.members.filter((m) => m.isActive && m.roleGroup === "salesperson");

  return (
    <ClientManagerLayout
      breadcrumbPage="AGENT PERFORMANCE"
      pageTitle="Agent Performance"
      workspaceShell
      workspaceTitle="Agent performance"
      workspaceDescription="Live activity for agents on this company — deals, pipeline and follow-ups."
    >
      <div className="min-w-0 w-full max-w-full">
        {agents.length === 0 ? (
          <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
            <EmptyState
              icon={Trophy}
              title="No agents to measure yet"
              description="Invite agents from the Agents page. Performance appears here from live pipeline activity."
            />
          </div>
        ) : (
          <div className="overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-sales-border-subtle text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
                  <th className="px-5 py-3">Agent</th>
                  <th className="px-3 py-3 text-right">Active deals</th>
                  <th className="px-3 py-3 text-right">Pipeline</th>
                  <th className="px-3 py-3 text-right">Won</th>
                  <th className="px-5 py-3 text-right">Follow-ups due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sales-border-subtle">
                {agents.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/client/team?member=${row.id}`}
                        className="text-[13px] font-semibold text-sales-text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{row.activeDeals}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{row.pipelineValueLabel}</td>
                    <td className="px-3 py-3 text-right text-[13px] tabular-nums">{row.dealsWon}</td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums">{row.followUpsDue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ClientManagerLayout>
  );
}
