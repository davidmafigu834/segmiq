import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
import { formatUsd } from "@/lib/commercial/catalogue";
import type { QuoteSnapshot } from "@/lib/platform-sales/types";

export const dynamic = "force-dynamic";
export default async function PlatformQuotePage({
  params,
}: {
  params: { quoteId: string };
}) {
  const session = await getServerSession(authOptions);
  if (
    !session?.userId ||
    session.role !== "SUPER_ADMIN" ||
    session.isImpersonating
  )
    redirect("/login");
  if (!platformSalesEnabled("quotes")) redirect("/dashboard/commercial-sales");
  const db = createAdminClient();
  const [{ data: quote }, { data: revisions }, { data: events }] =
    await Promise.all([
      db
        .from("platform_sales_quotes")
        .select(
          "id,quote_number,status,current_revision,accepted_revision,valid_until,platform_sales_prospects(organisation_name,contact_name)",
        )
        .eq("id", params.quoteId)
        .maybeSingle(),
      db
        .from("platform_sales_quote_revisions")
        .select(
          "revision,status,pricing_snapshot,content_sha256,pdf_sha256,issued_at,created_at",
        )
        .eq("quote_id", params.quoteId)
        .order("revision", { ascending: false }),
      db
        .from("platform_sales_quote_events")
        .select("id,revision,actor_type,action,occurred_at,metadata")
        .eq("quote_id", params.quoteId)
        .order("occurred_at", { ascending: false })
        .limit(100),
    ]);
  if (!quote) notFound();
  const prospect = quote.platform_sales_prospects as unknown as {
    organisation_name: string;
    contact_name: string;
  };
  return (
    <AgencyLayout
      breadcrumb="COMMERCIAL SALES / QUOTATIONS"
      pageTitle={String(quote.quote_number)}
    >
      <div className="space-y-5">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">
                {prospect.organisation_name}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {prospect.contact_name} · Revision {quote.current_revision} ·{" "}
                {quote.status}
              </p>
            </div>
            <a
              className="inline-flex min-h-10 items-center text-sm font-medium text-[var(--accent)]"
              href={`/api/admin/platform-sales/quotes/${quote.id}/pdf`}
            >
              Fresh private PDF link
            </a>
          </div>
        </section>
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
          <h2 className="font-semibold text-[var(--text-primary)]">
            Revision history
          </h2>
          <div className="mt-3 divide-y divide-[var(--border)]">
            {(revisions ?? []).map((revision) => {
              const snapshot = revision.pricing_snapshot as QuoteSnapshot;
              return (
                <article key={revision.revision as number} className="py-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">
                        Revision {revision.revision as number} ·{" "}
                        {revision.status as string}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                        Content {String(revision.content_sha256).slice(0, 16)}…{" "}
                        {revision.pdf_sha256
                          ? `· PDF ${String(revision.pdf_sha256).slice(0, 16)}…`
                          : "· PDF pending"}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>
                        {formatUsd(snapshot.recurringTotalUsdCents)} / month
                      </p>
                      <p className="text-[var(--text-tertiary)]">
                        {formatUsd(snapshot.initialDueUsdCents)} initial due
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
          <h2 className="font-semibold text-[var(--text-primary)]">
            Audit timeline
          </h2>
          <div className="mt-3 divide-y divide-[var(--border)]">
            {(events ?? []).map((event) => (
              <div
                key={event.id as number}
                className="flex justify-between gap-3 py-3 text-sm"
              >
                <span>
                  {event.action as string} · {event.actor_type as string}
                </span>
                <time className="text-[var(--text-tertiary)]">
                  {new Date(event.occurred_at as string).toLocaleString("en", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AgencyLayout>
  );
}
