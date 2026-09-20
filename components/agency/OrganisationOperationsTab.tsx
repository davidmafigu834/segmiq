import { formatDistanceToNowStrict } from "date-fns";
import type {
  IntegrationHealth,
  OrganisationDiagnostics,
} from "@/lib/security/support-access/diagnostics";
import { PlatformHealthRow, PlatformStatusBadge } from "@/components/platform/PlatformStatusBadge";
import { PlatformMetric } from "@/components/platform/PlatformMetric";
import type { PlatformStatusKind } from "@/components/platform/PlatformStatusBadge";

/**
 * Normal Super Admin view of an organisation: operational information, not the
 * customer's CRM. Every figure here is an aggregate or a health state.
 */
export function OrganisationOperationsTab({
  diagnostics,
  supportAccess,
}: {
  diagnostics: OrganisationDiagnostics;
  supportAccess: React.ReactNode;
}) {
  const { organisation, usage, integrations, platformHealth, security } = diagnostics;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
      <div className="space-y-8 min-w-0">
        <section>
          <h2 className="mb-4 text-[15px] font-semibold text-[var(--text-primary)]">
            Organisation information
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label="Company" value={organisation.name} />
            <Field label="Organisation ID" value={organisation.id} mono />
            <Field label="Created" value={formatDate(organisation.createdAt)} />
            <Field
              label="Primary administrator"
              value={organisation.primaryAdministrator?.name ?? "None assigned"}
            />
            <Field label="Plan" value={organisation.plan ?? "Not set"} />
            <Field
              label="Subscription"
              value={organisation.subscriptionStatus ? titleCase(organisation.subscriptionStatus) : "None"}
            />
            <Field label="Workspace mode" value={organisation.mode ? titleCase(organisation.mode) : "Team"} />
            <Field label="Last platform activity" value={relative(organisation.lastActivityAt)} />
          </dl>
        </section>

        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-[var(--text-primary)]">Usage this month</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-[var(--border)] py-4 sm:grid-cols-3">
            <PlatformMetric label="Users" value={numberOrDash(usage.activeUsers)} />
            <PlatformMetric label="Leads" value={numberOrDash(usage.leads)} />
            <PlatformMetric label="Deals" value={numberOrDash(usage.deals)} />
            <PlatformMetric label="Messages" value={numberOrDash(usage.messagesThisMonth)} />
            <PlatformMetric label="Agent runs" value={numberOrDash(usage.agentRunsThisMonth)} />
            <PlatformMetric label="Documents" value={numberOrDash(usage.documents)} />
          </div>
          <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
            Aggregate counts only. Individual customer records are not listed here.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-[15px] font-semibold text-[var(--text-primary)]">Diagnostics</h2>
          <dl className="space-y-1.5 text-[13px]">
            <DiagRow label="Agent runs today" value={numberOrDash(platformHealth.agentRunsToday)} />
            <DiagRow label="Failed agent runs" value={numberOrDash(platformHealth.agentFailuresToday)} />
            <DiagRow label="Last agent execution" value={relative(platformHealth.agentLastRunAt)} />
            <DiagRow label="Last failure code" value={platformHealth.agentLastFailureCode ?? "None"} />
            <DiagRow label="Failed sends today" value={numberOrDash(platformHealth.failedOutboundMessages)} />
            <DiagRow label="Webhook failures (7d)" value={numberOrDash(platformHealth.webhookFailures)} />
            <DiagRow label="Users with MFA" value={numberOrDash(security.usersWithMfa)} />
            <DiagRow label="Security events (7d)" value={numberOrDash(security.securityEvents7d)} />
          </dl>
        </section>
      </div>

      <aside className="space-y-8 lg:border-l lg:border-[var(--border)] lg:pl-8">
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Account status</h2>
            <PlatformStatusBadge
              kind={statusKind(organisation.status)}
              label={titleCase(organisation.status)}
            />
          </div>
          <p className="text-[12px] text-[var(--text-secondary)]">
            {organisation.agencyManaged ? "Agency-managed organisation" : "Self-serve organisation"}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-[15px] font-semibold text-[var(--text-primary)]">Health</h2>
          <div className="divide-y divide-[var(--border)]">
            {integrations.map((integration) => (
              <PlatformHealthRow
                key={integration.key}
                name={integration.label}
                kind={integrationKind(integration)}
                label={integration.statusLabel}
                meta={relative(integration.lastSyncAt)}
              />
            ))}
            <PlatformHealthRow
              name="Agent"
              kind={
                platformHealth.agentFailuresToday && platformHealth.agentFailuresToday > 0
                  ? "warning"
                  : "healthy"
              }
              label={
                platformHealth.agentFailuresToday && platformHealth.agentFailuresToday > 0
                  ? "Needs attention"
                  : "Healthy"
              }
            />
          </div>
        </section>

        {supportAccess}
      </aside>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd
        className={`mt-1 truncate text-[13px] text-[var(--text-primary)] ${mono ? "font-mono text-[12px]" : ""}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function DiagRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd className="font-mono text-[12px] tabular-nums text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function statusKind(status: string): PlatformStatusKind {
  if (status === "active") return "active";
  if (status === "suspended") return "suspended";
  return "neutral";
}

function integrationKind(integration: IntegrationHealth): PlatformStatusKind {
  if (integration.status === "connected") return "healthy";
  if (integration.status === "attention_required") return "attention";
  if (integration.status === "disconnected") return "error";
  return "neutral";
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

function relative(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDistanceToNowStrict(date)} ago`;
}
