import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { FileSignature } from "lucide-react";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { CommercialEmptyState, CommercialSection, CommercialStatus, CommercialUnavailable } from "@/components/commercial/CommercialPrimitives";
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
  return (
    <AgencyLayout breadcrumb="PLATFORM / COMMERCIAL / AGREEMENTS" pageTitle="Service Agreements">
      <div className="space-y-5">
        <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/5 p-4">
          <p className="text-sm font-medium text-[var(--text-primary)]">Agreement template — pending legal approval</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Signing remains unavailable until counsel approves the template, identity and retention policy, private PDF sealing is verified, and controlled end-to-end evidence passes. This register does not bypass those gates.</p>
        </div>
        {!configured ? <CommercialUnavailable detail="The agreement feature is disabled. Existing data is not queried and no signing links can be created." /> : result.error ? <CommercialUnavailable detail="The agreement register could not be loaded. This can mean the additive sales migration is still pending." /> : null}
        <CommercialSection title="Agreement register" description="Versioned customer and prospect agreements with their current signature state.">
          {rows.length ? <div className="divide-y divide-[var(--border)] px-4 sm:px-5">{rows.map((row) => <article key={row.id} className="grid gap-3 py-4 md:grid-cols-[minmax(180px,1.2fr)_minmax(150px,0.8fr)_minmax(140px,0.7fr)_auto] md:items-center"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-primary)]">{row.clients?.name ?? row.platform_sales_prospects?.organisation_name ?? "Unassigned party"}</p><p className="mt-1 truncate font-mono text-xs text-[var(--text-tertiary)]">{row.id}</p></div><div><p className="text-xs text-[var(--text-tertiary)]">Template</p><p className="mt-1 text-sm text-[var(--text-primary)]">{row.platform_agreement_templates?.version ?? "Unknown"}</p></div><div><p className="text-xs text-[var(--text-tertiary)]">Updated</p><p className="mt-1 text-sm text-[var(--text-primary)]">{formatDate(row.updated_at)}</p></div><CommercialStatus value={row.status} /></article>)}</div> : <CommercialEmptyState icon={FileSignature} title="No agreements available" description={configured ? "No service agreement records have been created." : "Agreement records remain hidden while the feature gate is off."} />}
        </CommercialSection>
      </div>
    </AgencyLayout>
  );
}
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)); }
