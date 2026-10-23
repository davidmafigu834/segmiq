import Link from "next/link";
import { AlertTriangle, Bot, CalendarClock, ReceiptText, Users } from "lucide-react";
import type { CommercialOverview } from "@/lib/commercial/account-repository";
import { formatUsd } from "@/lib/commercial/catalogue";
import { CommercialActions } from "@/components/commercial/CommercialActions";

export function CommercialOverviewPanel({ clientId, overview }: { clientId: string; overview: CommercialOverview }) {
  const account = overview.account;
  return <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:p-5" aria-labelledby="commercial-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><h2 id="commercial-heading" className="text-base font-semibold text-[var(--text-primary)]">Commercial account</h2>{overview.legacy ? <span className="rounded-full border border-[var(--warning)]/40 px-2 py-0.5 text-[11px] font-medium text-[var(--warning)]">Legacy — not migrated</span> : null}</div><p className="mt-1 text-xs text-[var(--text-tertiary)]">Platform pricing is separate from historical subscription terms.</p></div>
      <CommercialActions clientId={clientId} account={account} activeGrace={overview.activeGrace} recommendedSeats={Math.max(1, overview.occupiedSeats)} legacySubscription={overview.legacySubscription} />
    </div>
    {account ? <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<ReceiptText />} label="Plan" value={`${labelSku(account.crmSku)}${account.aiSku ? ` + ${labelSku(account.aiSku)}` : ""}`} detail={`Version ${account.priceVersion}`} />
        <Metric icon={<Users />} label="Seats" value={`${account.occupiedSeats} occupied / ${account.purchasedSeats} purchased`} detail={account.occupiedSeats > account.purchasedSeats ? "Action required — no automatic increase" : "Distinct active internal users"} warning={account.occupiedSeats > account.purchasedSeats} />
        <Metric icon={<CalendarClock />} label="Renewal" value={account.renewalAt ? formatDate(account.renewalAt) : "Not scheduled"} detail={`${account.billingCycle} · ${account.status}`} />
        <Metric icon={<Bot />} label="Agentic AI" value={account.aiSku ? labelSku(account.aiSku) : "Not enabled"} detail={account.aiSku ? "Allowance not yet metered" : "No AI allowance"} />
      </div>
      <div className="mt-4 rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--text-secondary)]"><span className="font-medium text-[var(--text-primary)]">Agreed recurring amount:</span> {formatUsd(account.agreedPriceSnapshot.recurringMonthlyUsdCents)} / month {account.agreementRef ? `· Evidence ${account.agreementRef}` : "· No evidence reference recorded"}</div>
    </> : <div className="mt-5 rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text-secondary)]"><p className="font-medium text-[var(--text-primary)]">Historical terms remain authoritative</p><p className="mt-1">{overview.legacySubscription ? `${labelSku(overview.legacySubscription.plan)} · ${overview.legacySubscription.currency} ${overview.legacySubscription.amount} · ${overview.legacySubscription.status} · ${overview.occupiedSeats} active users` : "No legacy CRM subscription found."}</p></div>}
    {overview.activeGrace ? <div className="mt-4 flex gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/5 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" /><div><p className="font-medium text-[var(--text-primary)]">Grace active until {formatDate(overview.activeGrace.endsAt)}</p><p className="text-[var(--text-secondary)]">{overview.activeGrace.reason}</p></div></div> : null}
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <History title="Recent invoices" empty="No invoice history." items={overview.invoices.map((invoice) => <div key={invoice.id} className="flex items-center justify-between gap-3 py-2 text-xs"><div><p className="font-medium text-[var(--text-primary)]">{invoice.invoiceNumber}</p><p className="text-[var(--text-tertiary)]">{invoice.issuedAt ? formatDate(invoice.issuedAt) : "Not issued"} · {invoice.status}</p></div><span className="font-mono text-[var(--text-secondary)]">{invoice.currency} {invoice.amount}</span></div>)} />
      <History title="Commercial activity" empty="No commercial changes recorded." items={overview.recentChanges.map((change) => <div key={change.id} className="py-2 text-xs"><p className="font-medium text-[var(--text-primary)]">{change.status} · {change.chargeHandling}</p><p className="text-[var(--text-tertiary)]">{change.reason} · effective {formatDate(change.effectiveAt)}</p></div>)} />
    </div>
    {overview.legacySubscription ? <Link href={`/dashboard/billing/subscriptions/${overview.legacySubscription.id}`} className="mt-4 inline-flex text-xs font-medium text-[var(--accent)] hover:underline">Review billing history</Link> : null}
  </section>;
}

function Metric({ icon, label, value, detail, warning }: { icon: React.ReactNode; label: string; value: string; detail: string; warning?: boolean }) { return <div className="rounded-lg border border-[var(--border)] p-3"><div className="flex items-center gap-2 text-[var(--text-tertiary)] [&_svg]:h-4 [&_svg]:w-4"><span aria-hidden>{icon}</span><span className="text-xs">{label}</span></div><p className="mt-2 text-sm font-medium text-[var(--text-primary)]">{value}</p><p className={`mt-1 text-xs ${warning ? "text-[var(--warning)]" : "text-[var(--text-tertiary)]"}`}>{detail}</p></div>; }
function History({ title, empty, items }: { title: string; empty: string; items: React.ReactNode[] }) { return <div><h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{title}</h3><div className="mt-2 divide-y divide-[var(--border)]">{items.length ? items : <p className="py-3 text-xs text-[var(--text-tertiary)]">{empty}</p>}</div></div>; }
function labelSku(value: string) { return value.replace(/^crm_/, "").replace(/^agentic_/, "Agentic ").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC"; }
