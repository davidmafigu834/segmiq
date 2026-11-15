"use client";

import { useEffect, useState } from "react";
import { EmptyNote, Panel } from "@/components/platform/workbench";
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
    <Panel title="Team" count={activity?.members.length}>
      <p className="border-b border-[var(--border)] px-4 py-3 text-[14px] text-[var(--text-secondary)]">
        {summary ?? "Who is in the app, and whether their latest action was a lead or a deal. Customer records are not shown."}
      </p>
      {error && !activity ? (
        <EmptyNote title="Could not load team activity" detail="Refresh the page to try again." />
      ) : !activity ? (
        <EmptyNote title="Loading team activity" detail="Presence updates about once a minute." />
      ) : activity.members.length === 0 ? (
        <EmptyNote title="No team members" detail="People invited to this organisation appear here." />
      ) : (
        <ul>
          {activity.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{member.name}</p>
                <p className="truncate text-[13px] text-[var(--text-secondary)]">
                  {member.roleLabel} · {member.lastOnlineLabel} · {member.workLabel}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                <span
                  className={`h-2 w-2 rounded-full ${member.isActive ? DOT_CLASS[member.presence] : "bg-[var(--text-tertiary)]"}`}
                  aria-hidden
                />
                {member.presenceLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
