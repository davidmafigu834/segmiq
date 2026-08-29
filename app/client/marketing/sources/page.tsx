import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Radio } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { EmptyState } from "@/components/ui";
import { redirectIfNotRealEstate } from "@/lib/real-estate/gating";
import { getMarketingDashboard } from "@/lib/real-estate/marketing-service";
import { formatConversionPct } from "@/lib/real-estate/marketing";

export const dynamic = "force-dynamic";

export default async function ClientLeadSourcesPage() {
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

  const dash = await getMarketingDashboard({
    clientId: session.clientId,
    filters: { preset: "this_month" },
  });

  return (
    <ClientManagerLayout
      breadcrumbPage="LEAD SOURCES"
      pageTitle="Lead Sources"
      workspaceShell
      workspaceTitle="Lead sources"
      workspaceDescription="Where this month’s inquiries came from, and whether they progressed to qualification, viewing and offer."
    >
      <div className="min-w-0 w-full max-w-full space-y-3">
        <div className="flex justify-end">
          <Link href="/client/marketing" className="text-[13px] font-medium text-sales-text-secondary underline">
            Open marketing
          </Link>
        </div>
        {dash.sources.length === 0 ? (
          <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
            <EmptyState
              icon={Radio}
              title="No source data yet"
              description="Source attribution will appear as new inquiries are captured through connected channels."
            />
          </div>
        ) : (
          <div className="overflow-x-auto workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-sales-border-subtle text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3 text-right">Inquiries</th>
                  <th className="px-5 py-3 text-right">Qualified</th>
                  <th className="px-5 py-3 text-right">Viewings</th>
                  <th className="px-5 py-3 text-right">Offers</th>
                  <th className="px-5 py-3 text-right">Accepted</th>
                  <th className="px-5 py-3 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sales-border-subtle">
                {dash.sources.map((row) => (
                  <tr key={row.sourceType}>
                    <td className="px-5 py-3 text-[13px] font-medium text-sales-text-primary">{row.label}</td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums">{row.inquiries}</td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums">{row.qualified}</td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums">{row.viewings}</td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums">{row.offers}</td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums">{row.accepted}</td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums">
                      {formatConversionPct(row.conversion)}
                    </td>
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
