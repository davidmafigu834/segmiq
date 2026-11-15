import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { CommercialUnavailable } from "@/components/commercial/CommercialPrimitives";
import { EmptyNote, Fact, Panel, WorkRow } from "@/components/platform/workbench";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type AuditRow = { id: number; client_id: string | null; event_type: string; subject_table: string; subject_id: string; recorded_at: string; details: Record<string, unknown>; clients?: { name?: string } | null };

export default async function CommercialActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN" || session.isImpersonating) redirect("/login");
  const { data, error } = await createAdminClient().from("platform_commercial_audit_events").select("id,client_id,event_type,subject_table,subject_id,recorded_at,details,clients(name)").order("recorded_at", { ascending: false }).limit(250);
  const rows = (data ?? []) as AuditRow[];
  const first = rows[0];
  return (
    <AgencyLayout breadcrumb="PLATFORM / COMMERCIAL" pageTitle="Commercial Activity">
      <div className="space-y-8">
        <p className="max-w-[62ch] text-[14px] text-[var(--text-secondary)]">Evidence only. This register does not edit an account, an invoice, or a message.</p>
        {error ? <CommercialUnavailable detail="The immutable commercial audit stream is unavailable. No missing records have been interpreted as successful activity." /> : null}
        <Fact
          name={first ? first.event_type.replaceAll("_", " ") : "No commercial event is recorded."}
          detail={first ? `${formatDate(first.recorded_at)}. ${summarize(first.details) || `${first.subject_table}:${first.subject_id}`}` : "Events appear here after a commercial change is recorded."}
          action={first?.client_id ? "Open organisation" : "Open organisations"}
          href={first?.client_id ? `/dashboard/clients/${first.client_id}` : "/dashboard/clients"}
        />
        <Panel title="Register" count={rows.length}>
          {rows.length === 0 ? (
            <EmptyNote title="No activity" detail="No immutable commercial events are in this environment." />
          ) : (
            <ul>
              {rows.map((row) => (
                <WorkRow
                  key={row.id}
                  name={row.event_type.replaceAll("_", " ")}
                  meta={formatDate(row.recorded_at)}
                  detail={summarize(row.details) || `${row.subject_table}:${row.subject_id}`}
                  action={row.client_id ? "Open" : "Organisations"}
                  href={row.client_id ? `/dashboard/clients/${row.client_id}` : "/dashboard/clients"}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AgencyLayout>
  );
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC"; }
function summarize(details: Record<string, unknown>) { return Object.entries(details).slice(0, 3).map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`).join(" · "); }
