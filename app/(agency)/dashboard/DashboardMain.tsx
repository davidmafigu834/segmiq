import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchAgencyDashboardData } from "@/lib/dashboard-data";
import { listActiveGrantsForAdmin, effectiveGrantStatus } from "@/lib/security/support-access";
import { listIncidents } from "@/lib/status-admin";
import { EmptyNote, Fact, Panel, QuietRow, WorkRow } from "@/components/platform/workbench";

export async function DashboardMain() {
  const session = await getServerSession(authOptions);

  const [d, grants, incidents] = await Promise.all([
    fetchAgencyDashboardData(),
    session?.userId ? listActiveGrantsForAdmin(session.userId).catch(() => []) : Promise.resolve([]),
    listIncidents().catch(() => []),
  ]);

  const now = new Date();
  const openIncidents = incidents.filter((i) => !i.resolved_at);
  const activeSupport = grants.filter((g) => effectiveGrantStatus(g) === "ACTIVE").length;

  const attention = [
    ...d.uncontactedFlags.map((row) => ({
      mark: "today" as const,
      name: row.clientName,
      meta: "Uncontacted leads",
      detail: `${row.count} lead${row.count === 1 ? "" : "s"} still have no contact.`,
      href: `/dashboard/clients`,
      action: "Open organisations",
    })),
    ...openIncidents.slice(0, 5).map((inc) => ({
      mark: inc.severity === "critical" ? ("overdue" as const) : ("waiting" as const),
      name: inc.title,
      meta: inc.component_key ?? "Platform",
      detail: inc.severity === "critical" ? "A critical incident is open." : "This incident is still open.",
      href: "/dashboard/status-incidents",
      action: "Open health",
    })),
    ...(activeSupport
      ? [
          {
            mark: "today" as const,
            name: "Support access",
            meta: activeSupport === 1 ? "1 session" : `${activeSupport} sessions`,
            detail: "A privileged session is open. End it when the check is done.",
            href: "/dashboard/support-access",
            action: "Open support",
          },
        ]
      : []),
  ].slice(0, 7);

  const first = attention[0];
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const orgs = d.clientPerf.slice(0, 8);

  return (
    <div className="space-y-8 pb-8">
      <p className="max-w-[62ch] text-[14px] text-[var(--text-secondary)]">
        {dateLabel}. {first ? first.detail : "Nothing is waiting on a decision."}
      </p>
      <Fact
        name={first ? first.name : "Nothing is waiting."}
        detail={first ? `${first.meta}. ${first.detail}` : "Organisations, incidents, and support sessions are clear."}
        action={first ? first.action : "Open organisations"}
        href={first ? first.href : "/dashboard/clients"}
      />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <Panel title="Needs a decision" count={attention.length}>
          {attention.length === 0 ? (
            <EmptyNote title="Nothing waiting" detail="When a lead, incident, or support session needs you, it shows up here." />
          ) : (
            <ul>
              {attention.map((item) => (
                <WorkRow
                  key={`${item.name}-${item.meta}`}
                  name={item.name}
                  meta={item.meta}
                  detail={item.detail}
                  mark={item.mark}
                  action={item.action}
                  href={item.href}
                />
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="On the platform" count={d.clientPerf.length}>
          {orgs.length === 0 ? (
            <EmptyNote title="No organisations" detail="A new organisation shows up here after it is created." />
          ) : (
            <ul>
              {orgs.map((row) => (
                <QuietRow
                  key={row.id}
                  name={row.name}
                  detail={row.hasFlag ? "Needs attention" : row.is_active ? "Active" : "Inactive"}
                  action="Open"
                  href={`/dashboard/clients/${row.id}`}
                />
              ))}
              {d.clientPerf.length > orgs.length ? (
                <li className="border-t border-[var(--border)] px-4 py-3">
                  <Link href="/dashboard/clients" className="text-[13px] font-semibold text-[var(--text-primary)]">
                    All organisations
                  </Link>
                </li>
              ) : null}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
