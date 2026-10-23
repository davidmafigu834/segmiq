import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
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

  return (
    <AgencyLayout
      breadcrumb="PLATFORM / COMMERCIAL / MIGRATIONS"
      pageTitle="Customer migration queue"
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/5 p-4">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Review and migrate one selected customer at a time
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            The queue never changes legacy subscriptions, invoices, or payments. Agentic AI
            defaults to off. A signed agreement or amendment reference is mandatory, and the
            migration cannot be confirmed before or after its effective time.
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold text-[var(--text-primary)]">
              {candidates.length}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              customers with a legacy CRM subscription and no commercial v2 account
            </p>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            Proposed prices use catalogue version 2026-10-22
          </p>
        </div>

        <div className="grid gap-4">
          {candidates.map((candidate) => (
            <article
              key={candidate.clientId}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[var(--text-primary)]">
                    {candidate.clientName}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Legacy subscription: {candidate.status} · {candidate.billingCycle}
                  </p>
                </div>
                <Link
                  href={`/dashboard/clients/${candidate.clientId}`}
                  className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--accent)] px-3 text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  Review migration
                </Link>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <Datum label="Existing plan" value={candidate.legacyPlan} />
                <Datum
                  label="Current agreed monthly"
                  value={
                    candidate.currentMonthlyUsdCents === null
                      ? `${candidate.currency} ${candidate.amount}`
                      : formatUsd(candidate.currentMonthlyUsdCents)
                  }
                />
                <Datum label="Current users" value={String(candidate.activeUsers)} />
                <Datum
                  label="Proposed plan"
                  value={candidate.proposedCrmSku === "crm_starter" ? "Starter" : "Growth"}
                />
                <Datum
                  label="Proposed monthly"
                  value={formatUsd(candidate.proposed.recurringMonthlyUsdCents)}
                />
                <Datum label="Agentic AI" value="Not selected" />
              </dl>
              <div className="mt-4 grid gap-2 border-t border-[var(--border)] pt-3 text-xs sm:grid-cols-2">
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text-tertiary)]">Proposed effective date:</span>{" "}
                  {formatDate(candidate.proposedEffectiveAt)}
                </p>
                <p className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text-tertiary)]">Contract requirement:</span>{" "}
                  Signed agreement or amendment required
                </p>
              </div>
            </article>
          ))}
          {!candidates.length ? (
            <p className="rounded-xl border border-[var(--border)] p-6 text-sm text-[var(--text-secondary)]">
              No unmigrated CRM subscriptions were found.
            </p>
          ) : null}
        </div>
      </div>
    </AgencyLayout>
  );
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}
