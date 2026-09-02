/**
 * Appointment prep briefing — grounded, compact sections.
 */

import { enrichFocusItem } from "./enrichment";
import type { SalesContextSummary } from "./context-summary";

export type AppointmentPrepBrief = {
  customerName: string;
  appointmentLabel: string;
  appointmentAt: string | null;
  whyMeeting: string;
  customerNeed: string | null;
  recentDiscussion: string | null;
  commercialState: string | null;
  openQuestions: string[];
  whatToAccomplish: string;
  importantRequirements: string[];
};

export async function buildAppointmentPrepBrief(opts: {
  clientId: string;
  salespersonId: string;
  leadId: string | null;
  dealId?: string | null;
  customerName: string;
  appointmentLabel?: string | null;
  appointmentAt?: string | null;
  dealStage?: string | null;
  projectType?: string | null;
  quoteLabel?: string | null;
}): Promise<AppointmentPrepBrief> {
  let summary: SalesContextSummary | null = null;
  if (opts.leadId) {
    summary = await enrichFocusItem({
      clientId: opts.clientId,
      salespersonId: opts.salespersonId,
      leadId: opts.leadId,
      dealId: opts.dealId,
      context: {
        projectType: opts.projectType,
        dealStage: opts.dealStage,
        quoteLabel: opts.quoteLabel,
      },
    });
  }

  const whyMeeting =
    opts.appointmentLabel?.trim() ||
    (opts.projectType ? `Discuss ${opts.projectType}` : "Scheduled sales appointment");

  const commercialState = [
    opts.dealStage ? `Stage: ${opts.dealStage.replace(/_/g, " ")}` : null,
    opts.quoteLabel ? `Quotation ${opts.quoteLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ") || null;

  return {
    customerName: opts.customerName,
    appointmentLabel: opts.appointmentLabel?.trim() || "Appointment",
    appointmentAt: opts.appointmentAt ?? null,
    whyMeeting,
    customerNeed: summary?.customerNeed ?? opts.projectType ?? null,
    recentDiscussion: summary?.customerPosition ?? summary?.whatHappened ?? null,
    commercialState,
    openQuestions: summary?.openQuestions ?? [],
    whatToAccomplish:
      summary?.commitment ||
      "Confirm requirements, resolve open questions, and agree the next commercial step.",
    importantRequirements: summary?.importantRequirements ?? [],
  };
}
