import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { EmptyNote, Fact, Panel, WorkRow } from "@/components/platform/workbench";
import { authOptions } from "@/lib/auth";
import { formatUsd } from "@/lib/commercial/catalogue";
import { loadCanonicalCatalogue } from "@/lib/commercial/catalogue-repository";
import { loadMigrationCandidates } from "@/lib/commercial/migration-repository";

export const dynamic = "force-dynamic";

export default async function CommercialMigrationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN" || session.isImpersonating)
    redirect("/login");

  const catalogue = await loadCanonicalCatalogue({ forNewOffer: true });
  const candidates = await loadMigrationCandidates(catalogue);

  const first = candidates[0];
  return (
    <AgencyLayout
      breadcrumb="PLATFORM / COMMERCIAL / MIGRATIONS"
      pageTitle="Customer migration queue"
    >
      <div className="space-y-8">
        <p className="max-w-[62ch] text-[14px] text-[var(--text-secondary)]">
          Review one organisation at a time. The queue does not change a legacy subscription, invoice, or payment. Agentic AI stays off until selected.
        </p>
        <Fact
          name={first ? `${first.clientName} is still on a legacy subscription.` : "No organisation is waiting to migrate."}
          detail={first ? `${first.legacyPlan} → ${first.proposedCrmSku === "crm_starter" ? "Starter" : "Growth"}. A signed agreement is required.` : "Everyone with a legacy CRM subscription already has a commercial v2 account."}
          action={first ? "Review" : "Open organisations"}
          href={first ? `/dashboard/clients/${first.clientId}` : "/dashboard/clients"}
        />
        <Panel title="Queue" count={candidates.length}>
          {candidates.length === 0 ? (
            <EmptyNote title="Queue is clear" detail="No unmigrated CRM subscriptions were found." />
          ) : (
            <ul>
              {candidates.map((candidate) => (
                <WorkRow
                  key={candidate.clientId}
                  name={candidate.clientName}
                  meta={`${candidate.status} · ${candidate.billingCycle}`}
                  detail={`${candidate.legacyPlan} → ${candidate.proposedCrmSku === "crm_starter" ? "Starter" : "Growth"} · ${formatUsd(candidate.proposed.recurringMonthlyUsdCents)} · effective ${formatDate(candidate.proposedEffectiveAt)}`}
                  mark="today"
                  action="Review"
                  href={`/dashboard/clients/${candidate.clientId}`}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AgencyLayout>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}
