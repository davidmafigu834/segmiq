/**
 * Sales assessment → work project handoff.
 * The original sales assessment stays immutable. Delivery does not start
 * another site assessment when a completed sales assessment is linked.
 * Readiness is not claimed while payment or equipment is still open.
 */

import type { WorkProjectStatus } from "@/lib/work-projects/constants";

export function initialDeliveryStatus(input: {
  workflow: "GENERAL_TRADES" | "SOLAR_INSTALLATION";
  salesAssessmentCompleted: boolean;
  paymentReady: boolean;
  equipmentReady: boolean;
}): WorkProjectStatus {
  if (!input.salesAssessmentCompleted) return "PLANNING";
  if (input.workflow === "SOLAR_INSTALLATION" && input.paymentReady && input.equipmentReady) {
    return "READY_TO_SCHEDULE";
  }
  return "PLANNING";
}

export function planWonProjectHandoff(input: {
  dealStage: string | null;
  assessmentStatus: "DRAFT" | "COMPLETED" | null;
}): {
  createProjectAllowed: boolean;
  linkAssessment: boolean;
  skipOperationalAssessment: boolean;
  initialStatus: WorkProjectStatus;
} {
  const won = input.dealStage === "WON";
  const completed = input.assessmentStatus === "COMPLETED";
  return {
    createProjectAllowed: won,
    linkAssessment: won && completed,
    skipOperationalAssessment: won && completed,
    initialStatus: initialDeliveryStatus({
      workflow: "SOLAR_INSTALLATION",
      salesAssessmentCompleted: completed,
      paymentReady: false,
      equipmentReady: false,
    }),
  };
}

export function rejectCrossTenant(actorClientId: string, rowClientId: string): boolean {
  return actorClientId !== rowClientId;
}
