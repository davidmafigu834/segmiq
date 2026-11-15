import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { CommercialUnavailable } from "@/components/commercial/CommercialPrimitives";
import { EmptyNote, Fact, Panel, WorkRow } from "@/components/platform/workbench";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type GraceRow = { id: string; client_id: string; starts_at: string; ends_at: string; reason: string; customer_notified: boolean; ended_at: string | null; created_at: string; clients?: { name?: string } | null };

export default async function GracePeriodsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN" || session.isImpersonating) redirect("/login");
  const { data, error } = await createAdminClient().from("platform_grace_periods").select("id,client_id,starts_at,ends_at,reason,customer_notified,ended_at,created_at,clients(name)").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as GraceRow[];
  const now = Date.now();
  const active = rows.filter((row) => !row.ended_at && new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() > now);

  const first = active[0];
  return (
    <AgencyLayout breadcrumb="PLATFORM / COMMERCIAL" pageTitle="Grace Periods">
      <div className="space-y-8">
        <p className="max-w-[62ch] text-[14px] text-[var(--text-secondary)]">A grace window is granted from the organisation. This register only shows it.</p>
        {error ? <CommercialUnavailable detail="The grace-period register is not available. This can mean the pending additive migration has not been applied; no active state has been inferred." /> : null}
        <Fact
          name={first ? `${first.clients?.name ?? "A customer"} is in grace.` : "No grace window is open."}
          detail={first ? `${first.reason} Ends ${formatDate(first.ends_at)}.` : "Grant one from the organisation when billing access should stay open."}
          action={first ? "Open organisation" : "Open organisations"}
          href={first ? `/dashboard/clients/${first.client_id}` : "/dashboard/clients"}
        />
        <Panel title="Active" count={active.length}>
          {active.length === 0 ? <EmptyNote title="No active grace" detail="No customer is inside an approved access window." /> : <GraceList rows={active} />}
        </Panel>
        <Panel title="History" count={rows.length}>
          {rows.length === 0 ? <EmptyNote title="No history" detail="Ended windows stay here as evidence." /> : <GraceList rows={rows} />}
        </Panel>
      </div>
    </AgencyLayout>
  );
}

function GraceList({ rows }: { rows: GraceRow[] }) {
  return (
    <ul>
      {rows.map((row) => {
        const status = row.ended_at ? "ended" : new Date(row.ends_at).getTime() <= Date.now() ? "expired" : "active";
        return (
          <WorkRow
            key={row.id}
            name={row.clients?.name ?? "Customer"}
            meta={`${formatDate(row.starts_at)} → ${formatDate(row.ends_at)}`}
            detail={`${row.reason} Notification ${row.customer_notified ? "recorded" : "not recorded"}. ${status}.`}
            mark={status === "active" ? "today" : status === "expired" ? "overdue" : "waiting"}
            action="Open"
            href={`/dashboard/clients/${row.client_id}`}
          />
        );
      })}
    </ul>
  );
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)); }
