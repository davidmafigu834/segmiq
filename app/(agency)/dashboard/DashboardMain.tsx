import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchAgencyDashboardData } from "@/lib/dashboard-data";
import { listActiveGrantsForAdmin, effectiveGrantStatus } from "@/lib/security/support-access";
import { listIncidents } from "@/lib/status-admin";
import { PlatformMetric } from "@/components/platform/PlatformMetric";
import { PlatformHealthRow, PlatformStatusBadge } from "@/components/platform/PlatformStatusBadge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Building2 } from "lucide-react";
import { formatCurrencyUsd } from "@/lib/format";

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatSigned(n: number, suffix = ""): string {
  const abs = Math.abs(n);
  const formatted = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  if (n > 0) return `+${formatted}${suffix}`;
  if (n < 0) return `−${formatted}${suffix}`;
  return `0${suffix}`;
}

export async function DashboardMain() {
  const session = await getServerSession(authOptions);
  const firstName = (session?.user?.name ?? "there").split(/\s+/)[0];

  const [d, grants, incidents] = await Promise.all([
    fetchAgencyDashboardData(),
    session?.userId ? listActiveGrantsForAdmin(session.userId).catch(() => []) : Promise.resolve([]),
    listIncidents().catch(() => []),
  ]);

  const now = new Date();
  const totalOrgs = d.clientPerf.length;
  const activeOrgs = d.clientPerf.filter((r) => r.is_active).length;
  const flaggedOrgs = d.clientPerf.filter((r) => r.hasFlag).length;
  const openIncidents = incidents.filter((i) => !i.resolved_at);
  const criticalOpen = openIncidents.some((i) => i.severity === "critical");
  const platformKind = criticalOpen ? "error" : openIncidents.length ? "warning" : "operational";
  const platformLabel = criticalOpen
    ? "Incident in progress"
    : openIncidents.length
      ? "Needs attention"
      : "All critical systems operational";
  const activeSupport = grants.filter((g) => effectiveGrantStatus(g) === "ACTIVE").length;

  const attention = [
    ...d.uncontactedFlags.map((row) => ({
      severity: "warning" as const,
      title: `${row.count} uncontacted lead${row.count === 1 ? "" : "s"}`,
      org: row.clientName,
      href: "/dashboard/clients",
      action: "Review",
    })),
    ...openIncidents.slice(0, 5).map((inc) => ({
      severity: inc.severity === "critical" ? ("error" as const) : ("warning" as const),
      title: inc.title,
      org: inc.component_key ?? "Platform",
      href: "/dashboard/status-incidents",
      action: "Investigate",
    })),
  ].slice(0, 7);

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[15px] text-[var(--text-secondary)]">
            {greeting(now)}, {firstName}.
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">{dateLabel}</p>
        </div>
        <PlatformStatusBadge kind={platformKind} label={platformLabel} />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--border)] py-5 md:grid-cols-3 lg:grid-cols-5">
        <PlatformMetric
          label="Organisations"
          value={totalOrgs.toLocaleString()}
          context={`${activeOrgs} active`}
        />
        <PlatformMetric
          label="Inbound today"
          value={d.leadsToday.toLocaleString()}
          context={
            d.leadsDeltaNeutral
              ? "Flat vs yesterday"
              : `${formatSigned(d.dayDeltaPct, "%")} vs yesterday`
          }
        />
        <PlatformMetric
          label="Deals won MTD"
          value={d.dealsWonMTD.count.toLocaleString()}
          context={
            d.dealsWonMTD.valueSum > 0
              ? formatCurrencyUsd(d.dealsWonMTD.valueSum)
              : "Across organisations"
          }
        />
        <PlatformMetric
          label="Contact rate"
          value={`${Math.round(d.contactRate)}%`}
          context={`${formatSigned(d.contactRateDeltaPts, " pts")} vs last week`}
        />
        <PlatformMetric
          label="Support access"
          value={activeSupport.toLocaleString()}
          context={activeSupport === 1 ? "1 active session" : "Active sessions"}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Organisation health</h2>
            <p className="text-[12px] text-[var(--text-tertiary)]">
              {totalOrgs} total · {activeOrgs} active · {flaggedOrgs} flagged
            </p>
          </div>
          {totalOrgs === 0 ? (
            <EmptyState
              icon={Building2}
              title="No organisations yet"
              description="New organisations will appear here as they join SegmiQ."
            />
          ) : (
            <div className="space-y-2.5">
              <HealthBar label="Active" value={activeOrgs} total={totalOrgs} tone="success" />
              <HealthBar label="Needs attention" value={flaggedOrgs} total={totalOrgs} tone="warning" />
              <HealthBar
                label="Inactive"
                value={Math.max(0, totalOrgs - activeOrgs)}
                total={totalOrgs}
                tone="neutral"
              />
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Platform health</h2>
            <Link
              href="/dashboard/status-incidents"
              className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              View details →
            </Link>
          </div>
          <div className="divide-y divide-[var(--border)]">
            <PlatformHealthRow
              name="Status page"
              kind={platformKind}
              label={openIncidents.length ? `${openIncidents.length} open` : "Operational"}
            />
            <PlatformHealthRow
              name="Support access"
              kind={activeSupport ? "attention" : "operational"}
              label={activeSupport ? `${activeSupport} active` : "None"}
            />
            <PlatformHealthRow
              name="Organisation flags"
              kind={flaggedOrgs ? "warning" : "operational"}
              label={flaggedOrgs ? `${flaggedOrgs} flagged` : "Clear"}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,1fr)]">
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Needs attention</h2>
          </div>
          {attention.length === 0 ? (
            <p className="py-6 text-[13px] text-[var(--text-tertiary)]">Nothing requires attention.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {attention.map((item, i) => (
                <li key={`${item.title}-${i}`} className="flex items-start gap-3 py-3">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      item.severity === "error" ? "bg-[var(--error)]" : "bg-[var(--warning)]"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">{item.title}</p>
                    <p className="text-[12px] text-[var(--text-tertiary)]">{item.org}</p>
                  </div>
                  <Link
                    href={item.href}
                    className="shrink-0 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    {item.action} →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Organisations</h2>
            <Link
              href="/dashboard/clients"
              className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              View all →
            </Link>
          </div>
          {d.clientPerf.length === 0 ? (
            <p className="py-6 text-[13px] text-[var(--text-tertiary)]">No organisations to show.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow isHeader>
                    <TableHead className="pl-0">Organisation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead align="right">This week</TableHead>
                    <TableHead align="right">Won MTD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.clientPerf.slice(0, 7).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-0">
                        <Link
                          href={`/dashboard/clients/${row.id}`}
                          className="font-medium text-[var(--text-primary)] hover:underline"
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <PlatformStatusBadge
                          kind={row.hasFlag ? "attention" : row.is_active ? "active" : "suspended"}
                          label={row.hasFlag ? "Issue" : row.is_active ? "Active" : "Inactive"}
                        />
                      </TableCell>
                      <TableCell align="right">{row.leadsThisWeek.toLocaleString()}</TableCell>
                      <TableCell align="right">{row.dealsWonMtd.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function HealthBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "success" | "warning" | "neutral";
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  const bar =
    tone === "success"
      ? "bg-[var(--accent)]"
      : tone === "warning"
        ? "bg-[var(--warning)]"
        : "bg-[var(--text-tertiary)]";
  return (
    <div className="flex items-center gap-3">
      <span className="w-[7.5rem] shrink-0 text-[12px] text-[var(--text-secondary)]">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-[12px] tabular-nums text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}
