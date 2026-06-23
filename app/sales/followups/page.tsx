import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { resolveFollowUpDateTime } from "@/lib/call-log-constants";
import { fetchLatestScheduledCallbacksByLeadId } from "@/lib/convert-later-picks";
import { format } from "date-fns";
import Link from "next/link";

type FollowUpLead = {
  id: string;
  name: string | null;
  phone: string | null;
  follow_up_date: string | null;
  clients?: { name?: string } | null;
};

function groupFollowUps(
  leads: FollowUpLead[],
  callbackAtByLeadId: Record<string, string>
) {
  const groups: Record<"OVERDUE" | "TODAY" | "TOMORROW" | "THIS_WEEK" | "LATER", FollowUpLead[]> = {
    OVERDUE: [],
    TODAY: [],
    TOMORROW: [],
    THIS_WEEK: [],
    LATER: [],
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const startOfDayAfterTomorrow = new Date(startOfTomorrow.getTime() + 86400000);
  const startOfNextWeek = new Date(startOfToday.getTime() + 7 * 86400000);

  for (const lead of leads) {
    const d = resolveFollowUpDateTime(lead.follow_up_date, callbackAtByLeadId[lead.id]);
    if (!d) continue;
    if (d < startOfToday) groups.OVERDUE.push(lead);
    else if (d < startOfTomorrow) groups.TODAY.push(lead);
    else if (d < startOfDayAfterTomorrow) groups.TOMORROW.push(lead);
    else if (d < startOfNextWeek) groups.THIS_WEEK.push(lead);
    else groups.LATER.push(lead);
  }

  const sortByCallback = (items: FollowUpLead[]) =>
    [...items].sort((a, b) => {
      const aAt = resolveFollowUpDateTime(a.follow_up_date, callbackAtByLeadId[a.id])?.getTime() ?? 0;
      const bAt = resolveFollowUpDateTime(b.follow_up_date, callbackAtByLeadId[b.id])?.getTime() ?? 0;
      return aAt - bAt;
    });

  for (const key of Object.keys(groups) as Array<keyof typeof groups>) {
    groups[key] = sortByCallback(groups[key]);
  }

  return groups;
}

export default async function SalesFollowupsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const supabase = createAdminClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*, clients ( name )")
    .eq("assigned_to_id", session.userId)
    .not("follow_up_date", "is", null)
    .order("follow_up_date", { ascending: true });

  const list = (leads ?? []) as FollowUpLead[];
  const callbackAtByLeadId = await fetchLatestScheduledCallbacksByLeadId(
    supabase,
    list.map((l) => l.id)
  );
  const groups = groupFollowUps(list, callbackAtByLeadId);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);

  const weekScheduledCount =
    groups.OVERDUE.length + groups.TODAY.length + groups.TOMORROW.length + groups.THIS_WEEK.length;

  const sections: { key: keyof typeof groups; label: ReactNode }[] = [
    {
      key: "OVERDUE",
      label: (
        <span className="flex items-center gap-2 text-[var(--danger-fg)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" aria-hidden />
          OVERDUE
        </span>
      ),
    },
    {
      key: "TODAY",
      label: (
        <span>
          TODAY · {format(startOfToday, "EEEE d MMMM")}
        </span>
      ),
    },
    {
      key: "TOMORROW",
      label: (
        <span>
          TOMORROW · {format(startOfTomorrow, "EEEE d MMMM")}
        </span>
      ),
    },
    { key: "THIS_WEEK", label: <span>THIS WEEK</span> },
    { key: "LATER", label: <span>LATER</span> },
  ];

  return (
    <SalesLayout breadcrumb="SALES / FOLLOW-UPS" pageTitle="Follow-ups">
      <p className="text-sm text-ink-secondary">
        You have {weekScheduledCount} call{weekScheduledCount === 1 ? "" : "s"} scheduled this week.
      </p>
      <div className="mt-8 space-y-10">
        {sections.map(({ key, label }) => {
          const items = groups[key];
          if (!items.length) return null;
          const overdueSection = key === "OVERDUE";
          return (
            <section key={key}>
              <div className="sticky top-0 z-10 border-b border-border bg-surface-canvas px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-secondary">
                {label}
              </div>
              <ul className="mt-0 divide-y divide-border border border-border border-t-0 bg-surface-card">
                {items.map((l) => {
                  const clientName = l.clients?.name ?? "—";
                  return (
                    <li key={l.id} className="border-b border-border last:border-b-0">
                      <Link
                        href={`/sales/leads?lead=${l.id}`}
                        prefetch={false}
                        className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-card-alt ${
                          overdueSection ? "border-l-2 border-l-[var(--danger)]" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-ink-primary">{l.name as string}</div>
                          <div className="font-mono text-xs text-ink-tertiary">{l.phone as string}</div>
                          <div className="mt-1 text-[11px] text-ink-secondary">{clientName}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-xs text-ink-secondary">
                            {(() => {
                              const at = resolveFollowUpDateTime(
                                l.follow_up_date,
                                callbackAtByLeadId[l.id]
                              );
                              return at ? format(at, "HH:mm") : "";
                            })()}
                          </span>
                          {overdueSection ? (
                            <span className="rounded-md bg-[var(--danger)] px-2 py-0.5 font-mono text-[10px] uppercase text-white">
                              Overdue
                            </span>
                          ) : null}
                          <span className="text-xs font-medium text-ink-secondary">Open →</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {!list.length ? <p className="text-sm text-ink-tertiary">No follow-ups scheduled.</p> : null}
      </div>
    </SalesLayout>
  );
}
