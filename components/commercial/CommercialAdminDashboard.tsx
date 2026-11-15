import type { CommercialHealthSnapshot } from "@/lib/commercial-launch/types";
import { CommercialUnavailable } from "@/components/commercial/CommercialPrimitives";
import { EmptyNote, Fact, Panel, QuietRow, WorkRow, type WorkMark } from "@/components/platform/workbench";

type ProspectRow = { id: string; organisation_name: string; contact_name: string; status: string; updated_at: string };
type QuoteRow = { id: string; quote_number: string; status: string; valid_until: string; platform_sales_prospects?: { organisation_name?: string } | null };

export function CommercialAdminDashboard({
  health,
  prospects,
  quotes,
  salesAvailable,
}: {
  health: CommercialHealthSnapshot | null;
  prospects: ProspectRow[];
  quotes: QuoteRow[];
  salesAvailable: boolean;
}) {
  const awaitingQuotes = quotes.filter((quote) => ["link_created", "sent", "viewed", "changes_requested"].includes(quote.status));
  const unsigned = health?.counts.outstandingAgreementSignatures ?? null;
  const legacy = health?.counts.legacySubscriptions ?? null;
  const overdue = health?.counts.overdueInvoices ?? null;
  const firstQuote = awaitingQuotes[0];
  const quoteOrg = firstQuote?.platform_sales_prospects?.organisation_name;

  const fact = firstQuote
    ? {
        name: `${firstQuote.quote_number} is waiting${quoteOrg ? ` on ${quoteOrg}` : ""}.`,
        detail: "The quotation was sent. Opening it is the next step. Sending it again is a separate action.",
        action: "Open quotation",
        href: `/dashboard/commercial-sales/quotes/${firstQuote.id}`,
      }
    : unsigned
      ? {
          name: unsigned === 1 ? "One agreement is unsigned." : `${unsigned} agreements are unsigned.`,
          detail: "The customer has not signed. Open the agreements register.",
          action: "Open agreements",
          href: "/dashboard/commercial-sales/agreements",
        }
      : overdue
        ? {
            name: overdue === 1 ? "One invoice is overdue." : `${overdue} invoices are overdue.`,
            detail: "Payment has not been recorded. Open billing and the invoice.",
            action: "Open billing",
            href: "/dashboard/billing",
          }
        : legacy
          ? {
              name: legacy === 1 ? "One legacy subscription is waiting." : `${legacy} legacy subscriptions are waiting.`,
              detail: "A controlled migration has not started.",
              action: "Open migrations",
              href: "/dashboard/commercial-migrations",
            }
          : {
              name: "Nothing is waiting.",
              detail: "Quotations, agreements, invoices, and migrations are clear.",
              action: "Open prospects",
              href: "/dashboard/commercial-sales",
            };

  const rows: Array<{ name: string; meta: string; detail: string; mark: WorkMark; action: string; href: string }> = [
    {
      name: "Quotations awaiting a response",
      meta: firstQuote ? firstQuote.quote_number : "None",
      detail: awaitingQuotes.length ? `${awaitingQuotes.length} waiting on the customer.` : "No quotation is waiting.",
      mark: awaitingQuotes.length ? "today" : "waiting",
      action: "Open",
      href: "/dashboard/commercial-sales?view=quotes",
    },
    {
      name: "Agreements awaiting signature",
      meta: unsigned ? String(unsigned) : "None",
      detail: unsigned ? "Sent, not signed." : "No signature is outstanding.",
      mark: unsigned ? "today" : "waiting",
      action: "Open",
      href: "/dashboard/commercial-sales/agreements",
    },
    {
      name: "Legacy subscriptions",
      meta: legacy ? String(legacy) : "None",
      detail: legacy ? "Controlled migration has not started." : "No legacy subscription is waiting.",
      mark: "waiting",
      action: "Open",
      href: "/dashboard/commercial-migrations",
    },
    {
      name: "Overdue invoices",
      meta: overdue ? String(overdue) : "None",
      detail: overdue ? "Past the due date. No payment is recorded." : "No invoice is overdue.",
      mark: overdue ? "overdue" : "waiting",
      action: "Open",
      href: "/dashboard/billing",
    },
  ];

  return (
    <div className="space-y-8">
      <p className="max-w-[62ch] text-[14px] text-[var(--text-secondary)]">
        Subscriptions, agreements, quotations, and grace. Customer-facing sales stay fail-closed.
      </p>
      {!health ? <CommercialUnavailable detail="The release-control read model could not be loaded. No readiness state has been inferred." /> : null}
      {!salesAvailable ? <CommercialUnavailable detail="Prospect and quotation tables are not available in this environment. Sales actions stay disabled by their server gates." /> : null}
      <Fact name={fact.name} detail={fact.detail} action={fact.action} href={fact.href} />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <Panel title="Needs a decision" count={rows.filter((row) => row.mark !== "waiting").length}>
          <ul>
            {rows.map((row) => (
              <WorkRow key={row.name} {...row} />
            ))}
          </ul>
        </Panel>
        <Panel title="Prospects" count={prospects.length}>
          {prospects.length === 0 ? (
            <EmptyNote title="No prospects" detail="A prospect shows up here after it is created. Creating one does not provision a customer." />
          ) : (
            <ul>
              {prospects.slice(0, 6).map((prospect) => (
                <QuietRow
                  key={prospect.id}
                  name={prospect.organisation_name}
                  detail={`${prospect.contact_name} · ${prospect.status.replaceAll("_", " ")}`}
                  action="Open"
                  href="/dashboard/commercial-sales"
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
