import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { CommercialUnavailable } from "@/components/commercial/CommercialPrimitives";
import { EmptyNote, Fact, Panel, WorkRow } from "@/components/platform/workbench";
import { authOptions } from "@/lib/auth";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type AgreementRow = { id: string; status: string; signing_flow: string; quote_id: string | null; created_at: string; updated_at: string; expires_at: string | null; clients?: { name?: string } | null; platform_sales_prospects?: { organisation_name?: string } | null; platform_agreement_templates?: { version?: string; status?: string } | null };

export default async function AgreementsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN" || session.isImpersonating) redirect("/login");
  const configured = platformSalesEnabled("agreements");
  const result = configured
    ? await createAdminClient().from("platform_customer_agreements").select("id,status,signing_flow,quote_id,created_at,updated_at,expires_at,clients(name),platform_sales_prospects(organisation_name),platform_agreement_templates(version,status)").order("updated_at", { ascending: false }).limit(200)
    : { data: [], error: null };
  const rows = (result.data ?? []) as AgreementRow[];
  const waiting = rows.find((row) => row.status !== "signed");
  return (
    <AgencyLayout breadcrumb="PLATFORM / COMMERCIAL / AGREEMENTS" pageTitle="Service Agreements">
      <div className="space-y-8">
        <p className="max-w-[62ch] text-[14px] text-[var(--text-secondary)]">Signing stays closed until counsel approves the template. This register does not bypass that gate.</p>
        {!configured ? <CommercialUnavailable detail="The agreement feature is disabled. Existing data is not queried and no signing links can be created." /> : result.error ? <CommercialUnavailable detail="The agreement register could not be loaded. This can mean the additive sales migration is still pending." /> : null}
        <Fact
          name={waiting ? `${waiting.clients?.name ?? waiting.platform_sales_prospects?.organisation_name ?? "A party"} has not signed.` : "No unsigned agreement is waiting."}
          detail={waiting ? `Template ${waiting.platform_agreement_templates?.version ?? "unknown"} · updated ${formatDate(waiting.updated_at)}.` : "Versioned agreements appear here once a quotation is accepted."}
          action="Open quotations"
          href="/dashboard/commercial-sales?view=quotes"
        />
        <Panel title="Register" count={rows.length}>
          {rows.length === 0 ? (
            <EmptyNote title="No agreements" detail={configured ? "No service agreement records have been created." : "Records stay hidden while the feature gate is off."} />
          ) : (
            <ul>
              {rows.map((row) => (
                <WorkRow
                  key={row.id}
                  name={row.clients?.name ?? row.platform_sales_prospects?.organisation_name ?? "Unassigned party"}
                  meta={row.status}
                  detail={`Template ${row.platform_agreement_templates?.version ?? "unknown"} · updated ${formatDate(row.updated_at)}`}
                  mark={row.status === "signed" ? "waiting" : "today"}
                  action="Open quote"
                  href={row.quote_id ? `/dashboard/commercial-sales/quotes/${row.quote_id}` : "/dashboard/commercial-sales?view=quotes"}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AgencyLayout>
  );
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)); }
