import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Clock3 } from "lucide-react";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { CommercialEmptyState, CommercialSection, CommercialStatus, CommercialUnavailable } from "@/components/commercial/CommercialPrimitives";
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

  return (
    <AgencyLayout breadcrumb="PLATFORM / COMMERCIAL" pageTitle="Grace Periods">
      <div className="space-y-5">
        <p className="max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Review temporary billing-access exceptions. New grace periods are granted from the customer commercial profile so the affected account, dates, reason, and notification state stay visible together.</p>
        {error ? <CommercialUnavailable detail="The grace-period register is not available. This can mean the pending additive migration has not been applied; no active state has been inferred." /> : null}
        <CommercialSection title="Active grace periods" description={`${active.length} currently within the approved access window.`}>
          {active.length ? <GraceList rows={active} /> : <CommercialEmptyState icon={Clock3} title="No active grace periods" description="No customer currently has a live commercial grace exception." />}
        </CommercialSection>
        <CommercialSection title="Grace history" description="Ended and expired windows remain visible as commercial evidence.">
          {rows.length ? <GraceList rows={rows} /> : <CommercialEmptyState icon={Clock3} title="No grace history" description="Grace periods will appear here after an authorised administrator records one from a customer profile." />}
        </CommercialSection>
      </div>
    </AgencyLayout>
  );
}

function GraceList({ rows }: { rows: GraceRow[] }) {
  return <div className="divide-y divide-[var(--border)] px-4 sm:px-5">{rows.map((row) => { const status = row.ended_at ? "ended" : new Date(row.ends_at).getTime() <= Date.now() ? "expired" : "active"; return <article key={row.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(180px,1fr)_minmax(260px,2fr)_auto] lg:items-center"><div><Link href={`/dashboard/clients/${row.client_id}`} className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">{row.clients?.name ?? "Customer"}</Link><p className="mt-1 text-xs text-[var(--text-tertiary)]">{formatDate(row.starts_at)} → {formatDate(row.ends_at)}</p></div><div><p className="text-sm text-[var(--text-secondary)]">{row.reason}</p><p className="mt-1 text-xs text-[var(--text-tertiary)]">Customer notification: {row.customer_notified ? "recorded" : "not recorded"}</p></div><CommercialStatus value={status} /></article>; })}</div>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)); }
