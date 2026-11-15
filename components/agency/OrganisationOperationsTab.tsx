import { formatDistanceToNowStrict } from "date-fns";
import { OrganisationTeamActivity } from "@/components/agency/OrganisationTeamActivity";
import { CommercialActions } from "@/components/commercial/CommercialActions";
import { EmptyNote, Fact, Panel, QuietRow, WorkRow } from "@/components/platform/workbench";
import { formatUsd } from "@/lib/commercial/catalogue";
import type { CommercialOverview } from "@/lib/commercial/account-repository";
import type { OrganisationDiagnostics } from "@/lib/security/support-access/diagnostics";

export function OrganisationOperationsTab({
  clientId,
  diagnostics,
  commercial,
  supportAccess,
}: {
  clientId: string;
  diagnostics: OrganisationDiagnostics;
  commercial: CommercialOverview;
  supportAccess: React.ReactNode;
}) {
  const { organisation, usage, integrations, platformHealth, security } = diagnostics;
  const account = commercial.account;
  const base = `/dashboard/clients/${clientId}`;
  const seatsOver = Boolean(account && account.occupiedSeats > account.purchasedSeats);
  const unpaid = commercial.invoices.find((invoice) => invoice.status === "overdue" || invoice.status === "sent");
  const attention = integrations.find(
    (integration) => integration.status === "attention_required" || integration.status === "disconnected",
  );
  const fact =
    organisation.status === "suspended"
      ? {
          name: "This organisation is suspended.",
          detail: "Settings is where the account is reopened.",
          action: "Open settings",
          href: `${base}/settings`,
        }
      : commercial.activeGrace
        ? {
            name: `Grace is open until ${formatWhen(commercial.activeGrace.endsAt)}.`,
            detail: commercial.activeGrace.reason,
            action: "Open grace",
            href: "/dashboard/grace-periods",
          }
        : seatsOver && account
          ? {
              name: "More people are using seats than were purchased.",
              detail: `${account.occupiedSeats} occupied, ${account.purchasedSeats} purchased. Seats do not increase on their own.`,
              action: "Open users",
              href: `${base}/team`,
            }
          : unpaid
            ? {
                name: `${unpaid.invoiceNumber} is ${unpaid.status}.`,
                detail: `${unpaid.currency} ${unpaid.amount}`,
                action: "Open invoice",
                href: `/dashboard/billing/invoices/${unpaid.id}`,
              }
            : commercial.legacy
              ? {
                  name: "This organisation is still on a legacy subscription.",
                  detail: commercial.legacySubscription
                    ? `${labelSku(commercial.legacySubscription.plan)} · ${commercial.legacySubscription.status}`
                    : "No legacy CRM subscription was found.",
                  action: "Open billing",
                  href: commercial.legacySubscription
                    ? `/dashboard/billing/subscriptions/${commercial.legacySubscription.id}`
                    : "/dashboard/billing",
                }
              : attention
                ? {
                    name: `${attention.label} needs a decision.`,
                    detail: attention.statusLabel,
                    action: "Open integrations",
                    href: `${base}/facebook`,
                  }
                : {
                    name: `${organisation.name} has nothing waiting.`,
                    detail: "Open users when someone needs access.",
                    action: "Open users",
                    href: `${base}/team`,
                  };

  return (
    <div className="space-y-8">
      <Fact name={fact.name} detail={fact.detail} action={fact.action} href={fact.href} />

      <Panel title="Commercial">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <p className="max-w-[52ch] text-[14px] text-[var(--text-secondary)]">
            {account
              ? `${formatUsd(account.agreedPriceSnapshot.recurringMonthlyUsdCents)} a month. Catalogue version ${account.priceVersion}.`
              : "Historical terms stay in force until a v2 account is recorded."}
          </p>
          <CommercialActions
            clientId={clientId}
            account={account}
            activeGrace={commercial.activeGrace}
            recommendedSeats={Math.max(1, commercial.occupiedSeats)}
            legacySubscription={commercial.legacySubscription}
          />
        </div>
        <ul>
          <QuietRow
            name="Plan"
            detail={
              account
                ? `${labelSku(account.crmSku)}${account.aiSku ? ` + ${labelSku(account.aiSku)}` : ""} · ${account.status}`
                : commercial.legacySubscription
                  ? `${labelSku(commercial.legacySubscription.plan)} · legacy`
                  : "No plan is recorded"
            }
            action="Open billing"
            href="/dashboard/billing"
          />
          <QuietRow
            name="Seats"
            detail={
              account
                ? `${account.occupiedSeats} occupied · ${account.purchasedSeats} purchased`
                : `${commercial.occupiedSeats} active users`
            }
            action="Open users"
            href={`${base}/team`}
          />
          <QuietRow
            name="Evidence"
            detail={account?.agreementRef ?? "No evidence reference recorded"}
          />
          <QuietRow
            name="Renewal"
            detail={
              account
                ? `${account.renewalAt ? formatWhen(account.renewalAt) : "Not scheduled"} · ${account.billingCycle}`
                : commercial.legacySubscription?.currentPeriodEnd
                  ? formatWhen(commercial.legacySubscription.currentPeriodEnd)
                  : "Not scheduled"
            }
          />
        </ul>
      </Panel>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <Panel title="Invoices" count={commercial.invoices.length}>
          {commercial.invoices.length === 0 ? (
            <EmptyNote title="No invoices" detail="Invoices for this organisation appear here." />
          ) : (
            <ul>
              {commercial.invoices.slice(0, 6).map((invoice) => (
                <WorkRow
                  key={invoice.id}
                  name={invoice.invoiceNumber}
                  meta={invoice.status}
                  detail={`${invoice.currency} ${invoice.amount}${invoice.issuedAt ? ` · ${formatWhen(invoice.issuedAt)}` : ""}`}
                  mark={invoice.status === "overdue" ? "overdue" : invoice.status === "sent" ? "today" : "waiting"}
                  action="Open"
                  href={`/dashboard/billing/invoices/${invoice.id}`}
                />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Changes" count={commercial.recentChanges.length}>
          {commercial.recentChanges.length === 0 ? (
            <EmptyNote title="No commercial changes" detail="Plan changes and grace events stay here." />
          ) : (
            <ul>
              {commercial.recentChanges.map((change) => (
                <QuietRow
                  key={change.id}
                  name={change.status.replaceAll("_", " ")}
                  detail={`${change.reason} · ${change.chargeHandling.replaceAll("_", " ")} · ${formatWhen(change.effectiveAt)}`}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Record">
        <ul>
          <QuietRow name="Organisation" detail={organisation.id} />
          <QuietRow name="Created" detail={formatDate(organisation.createdAt)} />
          <QuietRow
            name="Administrator"
            detail={organisation.primaryAdministrator?.name ?? "None assigned"}
            action="Open users"
            href={`${base}/team`}
          />
          <QuietRow name="Subscription" detail={organisation.subscriptionStatus ? titleCase(organisation.subscriptionStatus) : "None"} action="Open billing" href="/dashboard/billing" />
          <QuietRow name="Workspace" detail={organisation.mode ? titleCase(organisation.mode) : "Team"} />
          <QuietRow name="Last activity" detail={relative(organisation.lastActivityAt)} />
          <QuietRow name="Management" detail={organisation.agencyManaged ? "Agency managed" : "Self serve"} />
        </ul>
      </Panel>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <Panel title="This month">
          <ul>
            <QuietRow name="Users" detail={numberOrDash(usage.activeUsers)} action="Open users" href={`${base}/team`} />
            <QuietRow name="Leads" detail={numberOrDash(usage.leads)} />
            <QuietRow name="Deals" detail={numberOrDash(usage.deals)} />
            <QuietRow name="Messages" detail={numberOrDash(usage.messagesThisMonth)} />
            <QuietRow name="Agent runs" detail={numberOrDash(usage.agentRunsThisMonth)} />
            <QuietRow name="Documents" detail={numberOrDash(usage.documents)} />
          </ul>
          <p className="border-t border-[var(--border)] px-4 py-3 text-[13px] text-[var(--text-tertiary)]">
            Counts only. Customer names are not listed here.
          </p>
        </Panel>
        <Panel title="Health">
          <ul>
            {integrations.map((integration) => (
              <QuietRow
                key={integration.key}
                name={integration.label}
                detail={`${integration.statusLabel}${integration.lastSyncAt ? ` · ${relative(integration.lastSyncAt)}` : ""}`}
                action={integration.key === "facebook" ? "Open" : undefined}
                href={integration.key === "facebook" ? `${base}/facebook` : undefined}
              />
            ))}
            <QuietRow
              name="Agent"
              detail={
                platformHealth.agentFailuresToday && platformHealth.agentFailuresToday > 0
                  ? `${platformHealth.agentFailuresToday} failed today`
                  : "No failed runs today"
              }
            />
            <QuietRow name="Failed sends" detail={numberOrDash(platformHealth.failedOutboundMessages)} />
            <QuietRow name="Webhook failures" detail={numberOrDash(platformHealth.webhookFailures)} />
            <QuietRow name="Users with MFA" detail={numberOrDash(security.usersWithMfa)} />
            <QuietRow name="Security events" detail={numberOrDash(security.securityEvents7d)} />
          </ul>
        </Panel>
      </div>

      <OrganisationTeamActivity organisationId={organisation.id} />
      {supportAccess}
    </div>
  );
}

function labelSku(value: string) {
  return value
    .replace(/^crm_/, "")
    .replace(/^agentic_/, "Agentic ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function numberOrDash(value: number | null): string {
  return value == null ? "—" : value.toLocaleString();
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function relative(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDistanceToNowStrict(date)} ago`;
}
