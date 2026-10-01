"use client";

import { useEffect, useState } from "react";
import type { OrganisationTeamActivity as TeamActivity } from "@/lib/agency/organisation-team-activity";
import type { PresenceState } from "@/lib/presence/constants";

const POLL_MS = 60_000;

const DOT_CLASS: Record<PresenceState, string> = {
  online: "bg-[var(--success)]",
  away: "bg-[var(--warning)]",
  busy: "bg-[var(--warning)]",
  offline: "bg-[var(--text-tertiary)]",
};

export function OrganisationTeamActivity({ organisationId }: { organisationId: string }) {
  const [activity, setActivity] = useState<TeamActivity | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const res = await fetch(`/api/admin/organisations/${organisationId}/team-activity`);
        if (!res.ok) throw new Error("Could not load team activity");
        const json = (await res.json()) as TeamActivity;
        if (!cancelled) {
          setActivity(json);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void load();
      }, POLL_MS);
    }

    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void load();
        start();
      } else {
        stop();
      }
    }

    void load();
    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [organisationId]);

  const summary = activity
    ? [
        `${activity.summary.online} online`,
        `${activity.summary.away} away`,
        `${activity.summary.busy} busy`,
        `${activity.summary.offline} offline`,
        activity.summary.disabled > 0 ? `${activity.summary.disabled} disabled` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <section>
      <h2 className="mb-1 text-[15px] font-semibold text-[var(--text-primary)]">Team activity</h2>
      <p className="mb-3 text-[12px] text-[var(--text-tertiary)]">
        Who is in the app, when they were last online, and whether their latest action was a lead or a deal.
        Customer records are not shown.
      </p>
      {error && !activity ? (
        <p className="text-[13px] text-[var(--text-secondary)]">Could not load team activity.</p>
      ) : !activity ? (
        <p className="text-[13px] text-[var(--text-secondary)]">Loading team activity…</p>
      ) : activity.members.length === 0 ? (
        <p className="text-[13px] text-[var(--text-secondary)]">No team members.</p>
      ) : (
        <>
          <p className="mb-3 font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">{summary}</p>
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {activity.members.map((member) => (
              <li key={member.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{member.name}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
                    {member.roleLabel}
                    {" · "}
                    {member.lastOnlineLabel}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{member.workLabel}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                  <span
                    className={`h-2 w-2 rounded-full ${member.isActive ? DOT_CLASS[member.presence] : "bg-[var(--text-tertiary)]"}`}
                    aria-hidden
                  />
                  {member.presenceLabel}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
