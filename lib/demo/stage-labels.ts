import { DEAL_STAGE_LABEL } from "@/lib/sales/deals/display";
import type { DealStage } from "@/types";

/** Existing deal stages, labelled for a vehicle-hire demonstration. */
const VEHICLE_HIRE_STAGE_LABEL: Record<DealStage, string> = {
  QUALIFIED: "Trip details collected",
  SCOPING: "Availability check",
  PROPOSAL_SENT: "Quote sent",
  NEGOTIATING: "Follow-up",
  WON: "Booking confirmed",
  LOST: "Lost",
};

export function demoStageLabels(industry: string | null | undefined): Partial<Record<DealStage, string>> | undefined {
  if (industry === "vehicle_hire") return VEHICLE_HIRE_STAGE_LABEL;
  return undefined;
}

export function labelForDemoStage(industry: string | null | undefined, stage: DealStage): string {
  return demoStageLabels(industry)?.[stage] ?? DEAL_STAGE_LABEL[stage];
}
