/* Hallmark · macrostructure: Workbench · theme: SegmiQ modern-minimal · accent: lime · P5 H5 E4 S5 R5 V3 */
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  FileSignature,
  FileText,
  HeartPulse,
  ReceiptText,
  UserRoundPlus,
} from "lucide-react";
import type { CommercialHealthSnapshot } from "@/lib/commercial-launch/types";
import {
  CommercialEmptyState,
  CommercialMetric,
  CommercialSection,
  CommercialStatus,
  CommercialUnavailable,
} from "@/components/commercial/CommercialPrimitives";

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
  const unsignedAgreements = health?.counts.outstandingAgreementSignatures ?? null;
  const activeAccounts = health?.counts.signedV2ActiveAccounts ?? null;
  const aiAccounts = health?.counts.usageBillingRecords ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <CommercialStatus value={health?.control.mode ?? "UNKNOWN"} />
              <span className="text-xs text-[var(--text-tertiary)]">Customer-facing commercial operations remain fail-closed</span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Commercial control centre</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Manage subscriptions, customer agreements, sales quotations, billing exceptions, and Agentic AI usage from one operational view.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[390px]">
            <ActionLink href="/dashboard/commercial-sales?view=prospects&create=1" icon={UserRoundPlus} label="New prospect" primary />
            <ActionLink href="/dashboard/commercial-sales?view=builder" icon={FileText} label="Create quotation" />
          </div>
        </div>
        <div className="mt-6 grid border-t border-[var(--border)] sm:grid-cols-2 xl:grid-cols-4">
          <CommercialMetric icon={Building2} label="Active commercial accounts" value={displayCount(activeAccounts)} detail="Signed v2 accounts currently active" />
          <CommercialMetric icon={Bot} label="AI usage records" value={displayCount(aiAccounts)} detail="Observed billing-period records" />
          <CommercialMetric icon={FileText} label="Quotes awaiting response" value={awaitingQuotes.length.toLocaleString()} detail="Issued, viewed, or changes requested" />
          <CommercialMetric icon={FileSignature} label="Signatures outstanding" value={displayCount(unsignedAgreements)} detail="Agreement action still required" />
        </div>
      </section>

      {!health ? <CommercialUnavailable detail="The release-control read model could not be loaded. No readiness state has been inferred." /> : null}
      {!salesAvailable ? <CommercialUnavailable detail="Prospect and quotation tables are not available in this environment. Sales actions stay disabled by their server gates." /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <CommercialSection
          title="Attention queue"
          description="Records that need an explicit commercial decision. Nothing here triggers a customer charge or message automatically."
          action={<TextLink href="/dashboard/commercial-health" label="Open health" />}
        >
          <div className="divide-y divide-[var(--border)] px-4 sm:px-5">
            <QueueRow icon={ReceiptText} label="Legacy subscriptions awaiting controlled migration" count={health?.counts.legacySubscriptions ?? null} href="/dashboard/commercial-migrations" />
            <QueueRow icon={FileText} label="Quotations awaiting a response" count={awaitingQuotes.length} href="/dashboard/commercial-sales?view=quotes" />
            <QueueRow icon={FileSignature} label="Agreements awaiting signatures" count={unsignedAgreements} href="/dashboard/commercial-sales/agreements" />
            <QueueRow icon={HeartPulse} label="Unresolved usage reconciliations" count={health?.counts.unresolvedUsageReconciliations ?? null} href="/dashboard/commercial-health" />
            <QueueRow icon={Activity} label="Overdue invoices" count={health?.counts.overdueInvoices ?? null} href="/dashboard/billing" />
          </div>
        </CommercialSection>

        <CommercialSection title="Recent prospects" description="Latest platform-owned sales records. Creating one does not provision a customer.">
          {prospects.length ? (
            <div className="divide-y divide-[var(--border)] px-4 sm:px-5">
              {prospects.slice(0, 5).map((prospect) => (
                <div key={prospect.id} className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{prospect.organisation_name}</p>
                    <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">{prospect.contact_name} · updated {formatDate(prospect.updated_at)}</p>
                  </div>
                  <CommercialStatus value={prospect.status} />
                </div>
              ))}
            </div>
          ) : (
            <CommercialEmptyState title="No prospects yet" description="Add the first prospect when the sales feature gate is enabled." action={<TextLink href="/dashboard/commercial-sales" label="Open prospects" />} />
          )}
        </CommercialSection>
      </div>

      <CommercialSection title="Commercial workspaces" description="Move through the lifecycle without duplicating customer, billing, or release-control records.">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          <Workspace href="/dashboard/clients" icon={Building2} title="Customers" detail="Profiles, plan changes, grace, and account history" />
          <Workspace href="/dashboard/commercial-sales" icon={FileText} title="Sales" detail="Prospects, quotation builder, and response state" />
          <Workspace href="/dashboard/billing" icon={ReceiptText} title="Billing" detail="Subscriptions, invoices, and payment history" />
          <Workspace href="/dashboard/commercial-ai-usage" icon={Bot} title="Agentic AI" detail="Allowances, shadow usage, and approved top-ups" />
        </div>
      </CommercialSection>
    </div>
  );
}

function ActionLink({ href, icon: Icon, label, primary = false }: { href: string; icon: typeof Activity; label: string; primary?: boolean }) {
  return <Link href={href} className={primary ? "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" : "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"}><Icon className="h-4 w-4" aria-hidden="true" />{label}</Link>;
}
function TextLink({ href, label }: { href: string; label: string }) { return <Link href={href} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">{label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>; }
function QueueRow({ icon: Icon, label, count, href }: { icon: typeof Activity; label: string; count: number | null; href: string }) { return <Link href={href} className="group flex min-h-14 items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"><Icon className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden="true" /><span className="min-w-0 flex-1 text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">{label}</span><span className="font-mono text-sm text-[var(--text-primary)]">{displayCount(count)}</span><ArrowRight className="h-4 w-4 text-[var(--text-tertiary)]" aria-hidden="true" /></Link>; }
function Workspace({ href, icon: Icon, title, detail }: { href: string; icon: typeof Activity; title: string; detail: string }) { return <Link href={href} className="group border-b border-[var(--border)] p-5 last:border-b-0 hover:bg-[var(--bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] sm:border-r sm:[&:nth-child(2n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2n)]:border-r xl:last:border-r-0"><Icon className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent)]" aria-hidden="true" /><h3 className="mt-4 text-sm font-semibold text-[var(--text-primary)]">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--text-tertiary)]">{detail}</p></Link>; }
function displayCount(value: number | null) { return value === null ? "—" : value.toLocaleString(); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)); }
