/**
 * Pure Company Team page metrics — attention, roles, win rate, composition, goal coverage.
 * No I/O. Used by aggregators and unit tests.
 */

import type {
  CompanyTeamAttention,
  CompanyTeamCompositionSlice,
  CompanyTeamGoalCoverageBucket,
  CompanyTeamRoleGroup,
} from "@/components/dashboard/company/team/types";

export const COMPANY_TEAM_PAGE_SIZE = 10;
export const HOT_LEAD_SCORE_THRESHOLD = 70;

const COMPOSITION_COLORS: Record<CompanyTeamRoleGroup, string> = {
  salesperson: "#D4FF4F",
  manager: "#60A5FA",
  support: "#F59E0B",
};

const COVERAGE_COLORS: Record<CompanyTeamGoalCoverageBucket["id"], string> = {
  above_80: "#16A34A",
  mid: "#D4FF4F",
  below_50: "#F59E0B",
  no_goal: "#98A2B3",
};

export function companyTeamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function companyTeamRoleGroup(role: string): CompanyTeamRoleGroup {
  if (role === "CLIENT_MANAGER") return "manager";
  return "salesperson";
}

/** Role column: Salesperson / Sales Manager / Manager */
export function companyTeamRoleColumn(role: string, alsoSells: boolean | null | undefined): string {
  if (role === "CLIENT_MANAGER") return alsoSells ? "Sales Manager" : "Manager";
  return "Salesperson";
}

/** Title under the name in the Team member cell */
export function companyTeamTitleLabel(role: string, alsoSells: boolean | null | undefined): string {
  if (role === "CLIENT_MANAGER") {
    return alsoSells ? "Company Manager · Also sells" : "Company Manager";
  }
  return "Sales Executive";
}

export function companyTeamAttentionLabel(attention: CompanyTeamAttention): string {
  if (attention === "needs_attention") return "Needs attention";
  if (attention === "watch") return "Watch";
  return "On track";
}

/**
 * Canonical Deal win rate: Won / (Won + Lost).
 * Does not include Not Qualified Leads or open Deals.
 * Returns null when there are no closed Deals — never fake 0%.
 */
export function companyTeamWinRate(wonCount: number, lostCount: number): number | null {
  const closed = Math.max(0, wonCount) + Math.max(0, lostCount);
  if (closed <= 0) return null;
  return Math.round((wonCount / closed) * 100);
}

/**
 * Coaching attention — not employment status, and not "goal < 50% ⇒ at risk".
 *
 * needs_attention: multiple operational failures (overdue follow-ups, at-risk Deals, hot Leads waiting).
 * watch: a single meaningful signal, or Goal progress well behind expected month-to-date pace.
 * on_track: otherwise.
 */
export function deriveCompanyTeamAttention(opts: {
  overdueFollowUps: number;
  dealsAtRisk: number;
  hotAwaitingContact: number;
  noNextAction: number;
  hasGoal: boolean;
  goalProgressPct: number | null;
  dayOfMonth: number;
  daysInMonth: number;
}): { attention: CompanyTeamAttention; reason: string | null } {
  const overdue = Math.max(0, opts.overdueFollowUps);
  const atRisk = Math.max(0, opts.dealsAtRisk);
  const hot = Math.max(0, opts.hotAwaitingContact);
  const noNext = Math.max(0, opts.noNextAction);

  const expectedPace =
    opts.daysInMonth > 0 ? Math.min(1, Math.max(0, opts.dayOfMonth / opts.daysInMonth)) : 0;
  const behindGoal =
    opts.hasGoal &&
    opts.goalProgressPct != null &&
    expectedPace >= 0.25 &&
    opts.goalProgressPct < expectedPace * 50;

  const criticalHits =
    (overdue >= 2 ? 1 : 0) + (atRisk >= 2 ? 1 : 0) + (hot >= 2 ? 1 : 0) + (noNext >= 3 ? 1 : 0);

  if (overdue >= 3 || atRisk >= 2 || criticalHits >= 2) {
    const reason =
      overdue >= 2
        ? `${overdue} overdue follow-up${overdue === 1 ? "" : "s"}`
        : atRisk >= 1
          ? `${atRisk} Deal${atRisk === 1 ? "" : "s"} at risk`
          : hot >= 1
            ? `${hot} Hot Lead${hot === 1 ? "" : "s"} awaiting contact`
            : "Multiple Deals have no next action";
    return { attention: "needs_attention", reason };
  }

  if (overdue >= 1 || atRisk >= 1 || hot >= 1 || noNext >= 2 || behindGoal) {
    const reason = overdue
      ? `${overdue} overdue follow-up${overdue === 1 ? "" : "s"}`
      : atRisk
        ? `${atRisk} Deal${atRisk === 1 ? "" : "s"} at risk`
        : hot
          ? `${hot} Hot Lead${hot === 1 ? "" : "s"} awaiting contact`
          : behindGoal
            ? `${opts.goalProgressPct}% Goal progress — behind expected pace`
            : "Deals missing a next action";
    return { attention: "watch", reason };
  }

  return { attention: "on_track", reason: null };
}

export function companyTeamComposition(
  members: Array<{ roleGroup: CompanyTeamRoleGroup; isActive: boolean }>
): { slices: CompanyTeamCompositionSlice[]; total: number } {
  const active = members.filter((m) => m.isActive);
  const total = active.length;
  const counts: Record<CompanyTeamRoleGroup, number> = {
    salesperson: 0,
    manager: 0,
    support: 0,
  };
  for (const m of active) counts[m.roleGroup] += 1;

  const labels: Record<CompanyTeamRoleGroup, string> = {
    salesperson: "Salespeople",
    manager: "Managers",
    support: "Support",
  };

  const slices: CompanyTeamCompositionSlice[] = (["salesperson", "manager", "support"] as const)
    .filter((id) => counts[id] > 0)
    .map((id) => ({
      id,
      label: labels[id],
      count: counts[id],
      pct: total > 0 ? Math.round((counts[id] / total) * 100) : 0,
      color: COMPOSITION_COLORS[id],
    }));

  return { slices, total };
}

/**
 * Average Goal progress across members who have a Goal.
 * All Company Goals are REVENUE_WON / monthly — same unit, so a simple average is valid.
 * Null when nobody has a Goal.
 */
export function companyTeamAvgGoalProgress(
  members: Array<{ hasGoal: boolean; goalProgressPct: number | null; isActive: boolean }>
): number | null {
  const withGoal = members.filter(
    (m) => m.isActive && m.hasGoal && m.goalProgressPct != null && Number.isFinite(m.goalProgressPct)
  );
  if (withGoal.length === 0) return null;
  const sum = withGoal.reduce((s, m) => s + (m.goalProgressPct ?? 0), 0);
  return Math.round(sum / withGoal.length);
}

export function companyTeamGoalCoverage(members: Array<{
  hasGoal: boolean;
  goalProgressPct: number | null;
  isActive: boolean;
}>): CompanyTeamGoalCoverageBucket[] {
  const active = members.filter((m) => m.isActive);
  let above = 0;
  let mid = 0;
  let below = 0;
  let none = 0;
  for (const m of active) {
    if (!m.hasGoal || m.goalProgressPct == null) {
      none += 1;
      continue;
    }
    if (m.goalProgressPct >= 80) above += 1;
    else if (m.goalProgressPct >= 50) mid += 1;
    else below += 1;
  }
  return [
    { id: "above_80", label: "Above 80%", count: above, color: COVERAGE_COLORS.above_80 },
    { id: "mid", label: "50%–80%", count: mid, color: COVERAGE_COLORS.mid },
    { id: "below_50", label: "Below 50%", count: below, color: COVERAGE_COLORS.below_50 },
    { id: "no_goal", label: "No Goal set", count: none, color: COVERAGE_COLORS.no_goal },
  ];
}

export function matchesCompanyTeamTab(
  tab: "all" | "salespeople" | "managers" | "inactive",
  member: { isActive: boolean; roleGroup: CompanyTeamRoleGroup }
): boolean {
  if (tab === "inactive") return !member.isActive;
  if (!member.isActive) return false;
  if (tab === "salespeople") return member.roleGroup === "salesperson";
  if (tab === "managers") return member.roleGroup === "manager";
  return true;
}

export function matchesCompanyTeamSearch(
  query: string,
  member: { name: string; email: string | null; roleColumn: string; titleLabel: string }
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    member.name.toLowerCase().includes(q) ||
    (member.email ?? "").toLowerCase().includes(q) ||
    member.roleColumn.toLowerCase().includes(q) ||
    member.titleLabel.toLowerCase().includes(q)
  );
}

export function matchesCompanyTeamFilters(
  filters: {
    attention: "all" | CompanyTeamAttention;
    goal: "all" | "has" | "none";
    followUpsDue: boolean;
    dealsAtRisk: boolean;
  },
  member: {
    attention: CompanyTeamAttention;
    hasGoal: boolean;
    followUpsDue: number;
    dealsAtRisk: number;
  }
): boolean {
  if (filters.attention !== "all" && member.attention !== filters.attention) return false;
  if (filters.goal === "has" && !member.hasGoal) return false;
  if (filters.goal === "none" && member.hasGoal) return false;
  if (filters.followUpsDue && member.followUpsDue <= 0) return false;
  if (filters.dealsAtRisk && member.dealsAtRisk <= 0) return false;
  return true;
}

export function companyTeamFiltersActive(filters: {
  attention: "all" | CompanyTeamAttention;
  goal: "all" | "has" | "none";
  followUpsDue: boolean;
  dealsAtRisk: boolean;
}): boolean {
  return (
    filters.attention !== "all" ||
    filters.goal !== "all" ||
    filters.followUpsDue ||
    filters.dealsAtRisk
  );
}
