import { formatPeriodLabel } from "./period";
import { LOW_ACTIVITY_THRESHOLD } from "./config";
import { buildFunnel, buildPipelineHealth, classifyDeal, funnelDropNarrative } from "./analyse";
import { countLabel, formatMinutes, formatReportMoney } from "./presentation";
import type { ManagerRecommendation, NextWeekPriority, WeeklyReportAiOutput, WeeklyTeamSnapshot } from "./types";

function money(amount: number, currency: string): string {
  return formatReportMoney(amount, currency);
}

export function buildFallbackAi(snapshot: WeeklyTeamSnapshot): WeeklyReportAiOutput {
  const lowData = snapshot.activityVolume < LOW_ACTIVITY_THRESHOLD;
  const funnel = buildFunnel(snapshot);
  const dropNarrative = funnelDropNarrative(funnel);
  const health = buildPipelineHealth(snapshot);
  const quoted = snapshot.activePipeline.filter((d) => classifyDeal(d, snapshot) === "quoted_awaiting_followup");
  const stalled = health.find((b) => b.id === "stalled");
  const atRisk = health.find((b) => b.id === "at_risk");
  const c = snapshot.current;
  const p = snapshot.previous;
  const period = formatPeriodLabel(snapshot.period);
  const slaHours = snapshot.health.slaResponseHours;

  const positives: string[] = [];
  if (c.newLeads > p.newLeads) positives.push("Lead volume increased compared with last week.");
  if (
    c.avgFirstResponseMinutes != null &&
    p.avgFirstResponseMinutes != null &&
    c.avgFirstResponseMinutes < p.avgFirstResponseMinutes
  ) {
    positives.push("Average first response among contacted leads improved.");
  }
  if (c.dealsWon > p.dealsWon) positives.push("More deals were marked won than last week.");
  if (c.quotationsSent > p.quotationsSent) positives.push("More quotations were sent than last week.");
  if (positives.length === 0) {
    positives.push(
      lowData
        ? "There is not yet enough activity to highlight a reliable win."
        : "Activity was recorded, but no single metric clearly outperformed last week."
    );
  }

  const concerns: string[] = [];
  if (c.delayedResponses > 0) {
    concerns.push(
      `${countLabel(c.delayedResponses, "new lead")} missed the ${slaHours}-hour response target.`
    );
  }
  if (stalled && stalled.count > 0) {
    concerns.push(`${countLabel(stalled.count, "active opportunity", "active opportunities")} are currently stalled.`);
  }
  if (quoted.length > 0) {
    concerns.push(
      `${countLabel(quoted.length, "quoted opportunity", "quoted opportunities")} ${quoted.length === 1 ? "has" : "have"} no recorded follow-up inside the follow-up window.`
    );
  }
  if (c.followUpsMissed > 0) concerns.push(`${countLabel(c.followUpsMissed, "follow-up was", "follow-ups were")} missed.`);
  if (c.dealsLost > p.dealsLost) concerns.push("Lost deals increased compared with last week.");

  const biggestRisk =
    stalled && stalled.count > 0 && stalled.pct >= 40
      ? `${formatPctSafe(stalled.pct)} of active pipeline is currently stalled, representing ${money(stalled.value, snapshot.currency)}.`
      : atRisk && atRisk.count > 0
        ? `${countLabel(atRisk.count, "active opportunity is", "active opportunities are")} at risk from inactivity, representing ${money(atRisk.value, snapshot.currency)} of pipeline.`
        : quoted.length > 0
          ? "Quoted opportunities without follow-up are the clearest near-term leakage."
          : "No high-confidence risk stood out from this week's recorded activity.";

  const biggestOpportunity =
    stalled && stalled.count > 0
      ? `Recover stalled pipeline covering ${money(stalled.value, snapshot.currency)}.`
      : quoted.length > 0
        ? `Recover ${countLabel(quoted.length, "quoted opportunity", "quoted opportunities")} before they go quiet.`
        : c.qualifiedLeads > c.quotationsSent
          ? "Move qualified opportunities that did not receive a quotation."
          : "Protect response time and complete overdue follow-ups.";

  const recommendations: ManagerRecommendation[] = [];
  if (c.delayedResponses > 0) {
    recommendations.push({
      title: "Tighten first-response coverage",
      evidence: `${c.delayedResponses} of ${c.newLeads} new leads missed the ${slaHours}-hour response target.`,
      action: "Review afternoon coverage and unassigned enquiry routing.",
      objective: "Increase the share of enquiries contacted inside SLA.",
    });
  }
  if (stalled && stalled.count > 0) {
    recommendations.push({
      title: "Recover stalled pipeline",
      evidence: `${countLabel(stalled.count, "opportunity is", "opportunities are")} stalled, covering ${money(stalled.value, snapshot.currency)}.`,
      action: "Assign an owner and a dated next action to every stalled opportunity this week.",
      objective: "Return inactive pipeline to a managed next step.",
    });
  }
  if (quoted.length > 0) {
    recommendations.push({
      title: "Improve quotation follow-up discipline",
      evidence: `${countLabel(quoted.length, "active quotation", "active quotations")} received no follow-up within the defined follow-up window.`,
      action: `Require first quotation follow-up within ${Math.round(snapshot.health.quoteFollowupHours / 24) || 2} days and create reminders.`,
      objective: "Reduce quoted opportunities becoming inactive.",
    });
  }
  if (c.followUpsMissed > 0) {
    recommendations.push({
      title: "Clear overdue follow-ups",
      evidence: `${countLabel(c.followUpsMissed, "follow-up task")} ${c.followUpsMissed === 1 ? "was" : "were"} missed in ${period}.`,
      action: "Have each owner close or reschedule overdue follow-ups by mid-week.",
      objective: "Restore a dated next action on every live opportunity.",
    });
  }
  if (snapshot.lostThisWeek.some((r) => r.reason === "Reason not recorded")) {
    recommendations.push({
      title: "Record loss reasons",
      evidence: "One or more lost opportunities have no recorded reason.",
      action: "Require a loss reason before a deal can be marked lost.",
      objective: "Make next week's loss review based on evidence rather than guesswork.",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      title: "Keep the operating cadence",
      evidence: "No material leakage was visible in the recorded metrics this week.",
      action: "Maintain current response and follow-up standards and review high-value pipeline in the weekly meeting.",
      objective: "Protect pipeline health while volume is still building.",
    });
  }

  const priorities: NextWeekPriority[] = [];
  if (stalled && stalled.count > 0) {
    priorities.push({
      title: "Recover stalled pipeline",
      affectedCount: stalled.count,
      pipelineValue: stalled.value,
      ownerLabel: "Deal owners",
      targetDate: null,
      summary: `${countLabel(stalled.count, "opportunity")}  ·  ${money(stalled.value, snapshot.currency)} affected`,
    });
  }
  if (c.delayedResponses > 0) {
    priorities.push({
      title: "Improve first-response coverage",
      affectedCount: c.delayedResponses,
      pipelineValue: null,
      ownerLabel: "Sales team",
      targetDate: null,
      summary: `${countLabel(c.delayedResponses, "lead")} missed SLA`,
    });
  }
  if (quoted.length > 0) {
    priorities.push({
      title: "Recover quoted opportunities",
      affectedCount: quoted.length,
      pipelineValue: quoted.reduce((s, d) => s + (d.value ?? 0), 0),
      ownerLabel: "Sales team",
      targetDate: snapshot.period.endDate,
      summary: `${countLabel(quoted.length, "quoted opportunity", "quoted opportunities")} awaiting follow-up`,
    });
  }
  const unquoted = c.qualifiedLeads - c.quotationsSent;
  if (unquoted > 0) {
    priorities.push({
      title: "Move qualified opportunities forward",
      affectedCount: unquoted,
      pipelineValue: null,
      ownerLabel: "Deal owners",
      targetDate: null,
      summary:
        unquoted === 1
          ? "1 qualified opportunity did not receive a quotation"
          : `${unquoted} qualified opportunities did not receive a quotation`,
    });
  }
  const dormant = snapshot.activePipeline.filter((d) => classifyDeal(d, snapshot) === "at_risk");
  if (dormant.length > 0 && !(stalled && stalled.count > 0)) {
    priorities.push({
      title: "Re-engage dormant opportunities",
      affectedCount: dormant.length,
      pipelineValue: dormant.reduce((s, d) => s + (d.value ?? 0), 0),
      ownerLabel: "Deal owners",
      targetDate: null,
      summary: `${countLabel(dormant.length, "opportunity")}  ·  ${money(
        dormant.reduce((s, d) => s + (d.value ?? 0), 0),
        snapshot.currency
      )} affected`,
    });
  }
  if (c.followUpsMissed > 0) {
    priorities.push({
      title: "Complete overdue follow-ups",
      affectedCount: c.followUpsMissed,
      pipelineValue: null,
      ownerLabel: "Sales team",
      targetDate: null,
      summary: `${countLabel(c.followUpsMissed, "follow-up")} missed`,
    });
  }

  const agenda = [
    c.dealsWon > 0 ? "Review previous week's win" : "Review previous week's activity",
    stalled && stalled.count > 0 ? "Review stalled pipeline" : "Review active pipeline health",
    "Assign owners to inactive opportunities",
    c.delayedResponses > 0 ? "Review response-time coverage" : "Confirm first-response coverage",
    quoted.length > 0 ? "Confirm quotation follow-up owners" : "Confirm next actions on qualified opportunities",
    "Agree next-week priorities",
  ];

  const responseClause =
    c.avgFirstResponseMinutes != null && c.delayedResponses > 0 && c.newLeads > 0
      ? ` Average response time among contacted leads was ${formatMinutes(c.avgFirstResponseMinutes)}, while ${c.delayedResponses} of ${c.newLeads} new leads did not receive a response inside the ${slaHours}-hour target.`
      : "";

  const funnelClause = dropNarrative
    ? dropNarrative
    : "No single funnel stage dominated leakage.";

  const executiveSummary = lowData
    ? `Only ${snapshot.activityVolume} sales ${snapshot.activityVolume === 1 ? "activity was" : "activities were"} recorded this week, so there is not yet enough data to identify reliable performance patterns. The facts below are still complete for ${period}.`
    : [
        `Lead volume ${c.newLeads >= p.newLeads ? "increased" : "decreased"} compared with last week${
          c.avgFirstResponseMinutes != null &&
          p.avgFirstResponseMinutes != null &&
          c.avgFirstResponseMinutes < p.avgFirstResponseMinutes
            ? ", and average response time among contacted leads improved"
            : ""
        }.`,
        funnelClause,
        `The priority for next week is ${biggestOpportunity.charAt(0).toLowerCase()}${biggestOpportunity.slice(1)}`,
        responseClause.trim(),
      ]
        .filter(Boolean)
        .join(" ");

  const lostValue = snapshot.lostThisWeek.reduce((s, r) => s + (r.value ?? 0), 0);
  const priced = snapshot.lostThisWeek.filter((r) => /price|pricing/i.test(r.reason)).length;

  return {
    executiveSummary,
    whatWentWell: positives[0] ?? "No standout gain was recorded.",
    whereMomentumWasLost: concerns[0] ?? "No clear loss of momentum was visible in the recorded metrics.",
    biggestRisk,
    biggestOpportunity,
    priorityForNextWeek: priorities[0]?.title ?? "Protect response time and follow-up cadence.",
    positiveFindings: positives.slice(0, 4),
    concerns: concerns.slice(0, 4),
    risks: [biggestRisk],
    opportunities: [biggestOpportunity],
    managerRecommendations: recommendations.slice(0, 6),
    nextWeekPriorities: priorities.slice(0, 6),
    meetingAgenda: agenda,
    salespersonNarratives: [],
    pipelineNarrative:
      snapshot.activePipeline.length === 0
        ? "There is no active commercial pipeline to classify this week."
        : `${countLabel(snapshot.activePipeline.length, "active opportunity was", "active opportunities were")} classified using the organisation's inactivity and quotation follow-up rules.`,
    lossAnalysisNarrative:
      snapshot.lostThisWeek.length === 0
        ? "No opportunities were marked lost during the reporting period."
        : `${countLabel(snapshot.lostThisWeek.length, "opportunity", "opportunities")} worth approximately ${money(lostValue, snapshot.currency)} ${snapshot.lostThisWeek.length === 1 ? "was" : "were"} marked lost.${
            priced > 0 ? ` Pricing appeared in ${countLabel(priced, "recorded loss reason")}.` : ""
          } Reasons that were not captured are labelled "Reason not recorded".`,
    conversationPatterns: snapshot.conversation.patterns.map((p) => ({
      id: p.id,
      interpretation:
        p.count <= 1
          ? "Not enough volume yet to establish a reliable pattern."
          : "Review in the weekly meeting.",
    })),
    dataSufficiencyNote: lowData
      ? `Only ${snapshot.activityVolume} sales ${snapshot.activityVolume === 1 ? "activity was" : "activities were"} recorded this week, so there is not yet enough data to identify reliable performance patterns.`
      : null,
  };
}

function formatPctSafe(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}
