import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Activity } from "lucide-react";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { CommercialEmptyState, CommercialSection, CommercialUnavailable } from "@/components/commercial/CommercialPrimitives";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type AuditRow = { id: number; client_id: string | null; event_type: string; subject_table: string; subject_id: string; recorded_at: string; details: Record<string, unknown>; clients?: { name?: string } | null };

export default async function CommercialActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN" || session.isImpersonating) redirect("/login");
  const { data, error } = await createAdminClient().from("platform_commercial_audit_events").select("id,client_id,event_type,subject_table,subject_id,recorded_at,details,clients(name)").order("recorded_at", { ascending: false }).limit(250);
  const rows = (data ?? []) as AuditRow[];
  return (
    <AgencyLayout breadcrumb="PLATFORM / COMMERCIAL" pageTitle="Commercial Activity">
      <div className="space-y-5">
        <p className="max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Immutable commercial events across account changes, grace periods, migration, billing controls, and Agentic AI workflows. This view is evidence, not an editing surface.</p>
        {error ? <CommercialUnavailable detail="The immutable commercial audit stream is unavailable. No missing records have been interpreted as successful activity." /> : null}
        <CommercialSection title="Audit timeline" description={`${rows.length} most recent events, newest first.`}>
          {rows.length ? <div className="divide-y divide-[var(--border)] px-4 sm:px-5">{rows.map((row) => <article key={row.id} className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)_auto]"><time className="text-xs text-[var(--text-tertiary)]">{formatDate(row.recorded_at)}</time><div className="min-w-0"><p className="text-sm font-medium capitalize text-[var(--text-primary)]">{row.event_type.replaceAll("_", " ")}</p><p className="mt-1 break-words font-mono text-xs text-[var(--text-tertiary)]">{row.subject_table}:{row.subject_id}</p>{summarize(row.details) ? <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{summarize(row.details)}</p> : null}</div>{row.client_id ? <Link href={`/dashboard/clients/${row.client_id}`} className="inline-flex min-h-10 items-center text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">{row.clients?.name ?? "View customer"}</Link> : <span className="text-xs text-[var(--text-tertiary)]">Platform</span>}</article>)}</div> : <CommercialEmptyState icon={Activity} title="No commercial activity" description="No immutable commercial audit events are available in this environment." />}
        </CommercialSection>
      </div>
    </AgencyLayout>
  );
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC"; }
function summarize(details: Record<string, unknown>) { return Object.entries(details).slice(0, 3).map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`).join(" · "); }
