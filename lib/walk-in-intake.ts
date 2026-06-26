import type { LeadStatus } from "@/types";
import { format } from "date-fns";

export type WalkInIntakeOutcome =
  | "quote_requested"
  | "follow_up_later"
  | "still_deciding"
  | "won_on_spot"
  | "just_browsing";

export const WALK_IN_OUTCOMES: {
  value: WalkInIntakeOutcome;
  label: string;
  hint: string;
}[] = [
  { value: "quote_requested", label: "Send quote", hint: "Quote due today" },
  { value: "follow_up_later", label: "Follow up later", hint: "Pick a callback date" },
  { value: "still_deciding", label: "Still deciding", hint: "Warm — no rush" },
  { value: "won_on_spot", label: "Won on the spot", hint: "Closed at the desk" },
  { value: "just_browsing", label: "Just browsing", hint: "Low priority" },
];

export function isWalkInSource(source: string): boolean {
  return source.trim().toLowerCase() === "walk-in" || source.trim().toLowerCase() === "walk_in";
}

function todayDateStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export type ResolvedWalkInIntake = {
  status: LeadStatus;
  manualPriority: "hot" | "warm" | "cold";
  followUpDate?: string;
  dealValue?: number;
  hubIntake: WalkInIntakeOutcome;
};

export function resolveWalkInIntake(
  outcome: WalkInIntakeOutcome,
  opts: { followUpDate?: string; dealValue?: number }
): ResolvedWalkInIntake {
  switch (outcome) {
    case "quote_requested":
      return {
        hubIntake: outcome,
        status: "CONTACTED",
        manualPriority: "hot",
        followUpDate: opts.followUpDate ?? todayDateStr(),
      };
    case "follow_up_later":
      return {
        hubIntake: outcome,
        status: "CONTACTED",
        manualPriority: "warm",
        followUpDate: opts.followUpDate,
      };
    case "still_deciding":
      return {
        hubIntake: outcome,
        status: "CONTACTED",
        manualPriority: "warm",
      };
    case "won_on_spot":
      return {
        hubIntake: outcome,
        status: "WON",
        manualPriority: "hot",
        dealValue: opts.dealValue,
      };
    case "just_browsing":
      return {
        hubIntake: outcome,
        status: "CONTACTED",
        manualPriority: "cold",
      };
  }
}

export function intakeOutcomeLabel(outcome: WalkInIntakeOutcome): string {
  return WALK_IN_OUTCOMES.find((o) => o.value === outcome)?.label ?? outcome;
}
