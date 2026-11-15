import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformSalesEnabled } from "@/lib/platform-sales/flags";
import { formatUsd } from "@/lib/commercial/catalogue";
import { Fact, Panel, QuietRow } from "@/components/platform/workbench";
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
      <div className="space-y-8">
        <Fact
          name={String(quote.status) === "accepted" ? `${prospect.organisation_name} accepted this quotation.` : `${prospect.organisation_name} has not accepted this quotation.`}
          detail={`${prospect.contact_name} · revision ${quote.current_revision} · ${quote.status}`}
          action="Open agreements"
          href="/dashboard/commercial-sales/agreements"
        />
        <p>
          <a className="text-[14px] font-semibold text-[var(--text-primary)] underline decoration-[var(--border)] underline-offset-4" href={`/api/admin/platform-sales/quotes/${quote.id}/pdf`}>
            Fresh private PDF
          </a>
        </p>
        <Panel title="Revisions" count={(revisions ?? []).length}>
          <ul>
            {(revisions ?? []).map((revision) => {
              const snapshot = revision.pricing_snapshot as QuoteSnapshot;
              return (
                <QuietRow
                  key={revision.revision as number}
                  name={`Revision ${revision.revision as number}`}
                  detail={`${revision.status as string} · ${formatUsd(snapshot.recurringTotalUsdCents)} / month · ${formatUsd(snapshot.initialDueUsdCents)} initial`}
                />
              );
            })}
          </ul>
        </Panel>
        <Panel title="Audit" count={(events ?? []).length}>
          <ul>
            {(events ?? []).map((event) => (
              <QuietRow
                key={event.id as number}
                name={`${event.action as string}`}
                detail={`${event.actor_type as string} · ${new Date(event.occurred_at as string).toLocaleString("en", { timeZone: "UTC" })} UTC`}
              />
            ))}
          </ul>
        </Panel>
      </div>
    </AgencyLayout>
  );
}
