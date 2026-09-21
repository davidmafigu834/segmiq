import { formatMoney } from "@/lib/quotations/totals";
import { formatPeriodLabel } from "./period";
import { LOW_ACTIVITY_THRESHOLD } from "./config";
import { largestFunnelDropOff, buildFunnel, buildPipelineHealth, classifyDeal } from "./analyse";
import type { ManagerRecommendation, NextWeekPriority, WeeklyReportAiOutput, WeeklyTeamSnapshot } from "./types";

function money(amount: number, currency: string): string {
  return formatMoney(amount, currency);
}

export function buildFallbackAi(snapshot: WeeklyTeamSnapshot): WeeklyReportAiOutput {
  const lowData = snapshot.activityVolume < LOW_ACTIVITY_THRESHOLD;
  const funnel = buildFunnel(snapshot);
  const drop = largestFunnelDropOff(funnel);
  const health = buildPipelineHealth(snapshot);
  const quoted = snapshot.activePipeline.filter((d) => classifyDeal(d, snapshot) === "quoted_awaiting_followup");
  const atRisk = health.find((b) => b.id === "at_risk");
  const c = snapshot.current;
  const p = snapshot.previous;
  const period = formatPeriodLabel(snapshot.period);

  const positives: string[] = [];
  if (c.newLeads > p.newLeads) positives.push("Lead volume increased compared with last week.");
  if (
    c.avgFirstResponseMinutes != null &&
    p.avgFirstResponseMinutes != null &&
    c.avgFirstResponseMinutes < p.avgFirstResponseMinutes
  ) {
    positives.push("Average first response time improved.");
  }
  if (c.dealsWon > p.dealsWon) positives.push("More deals were marked won than last week.");
  if (c.quotationsSent > p.quotationsSent) positives.push("More quotations were sent than last week.");
  if (positives.length === 0) {
    positives.push(lowData ? "There is not yet enough activity to highlight a reliable win." : "Activity was recorded, but no single metric clearly outperformed last week.");
  }

  const concerns: string[] = [];
  if (quoted.length > 0) {
    concerns.push(`${quoted.length} quoted opportunities have no recorded follow-up inside the follow-up window.`);
  }
  if (c.followUpsMissed > 0) concerns.push(`${c.followUpsMissed} follow-ups were missed.`);
  if (c.delayedResponses > 0) concerns.push(`${c.delayedResponses} new leads missed the response-time target.`);
  if (c.dealsLost > p.dealsLost) concerns.push("Lost deals increased compared with last week.");

  const biggestRisk =
    atRisk && atRisk.count > 0
      ? `${atRisk.count} active opportunities are at risk from inactivity, representing ${money(atRisk.value, snapshot.currency)} of pipeline.`
      : quoted.length > 0
        ? "Quoted opportunities without follow-up are the clearest near-term leakage."
        : "No high-confidence risk stood out from this week's recorded activity.";

  const biggestOpportunity =
    quoted.length > 0
      ? `Recover ${quoted.length} quoted opportunities before they go quiet.`
      : c.qualifiedLeads > c.quotationsSent
        ? "Move qualified opportunities that did not receive a quotation."
        : "Protect response time and complete overdue follow-ups.";

  const recommendations: ManagerRecommendation[] = [];
  if (quoted.length > 0) {
    recommendations.push({
      title: "Improve quotation follow-up discipline",
      evidence: `${quoted.length} active quotations received no follow-up within the defined follow-up window.`,
      action: `Require first quotation follow-up within ${Math.round(snapshot.health.quoteFollowupHours / 24) || 2} days and create reminders.`,
      objective: "Reduce quoted opportunities becoming inactive.",
    });
  }
  if (c.delayedResponses > 0) {
    recommendations.push({
      title: "Tighten first-response coverage",
      evidence: `${c.delayedResponses} of ${c.newLeads} new leads missed the ${snapshot.health.slaResponseHours}-hour response target.`,
      action: "Review afternoon coverage and unassigned enquiry routing at the start of next week.",
      objective: "Lift the share of leads contacted inside the SLA.",
    });
  }
  if (c.followUpsMissed > 0) {
    recommendations.push({
      title: "Clear overdue follow-ups",
      evidence: `${c.followUpsMissed} follow-up tasks were missed in ${period}.`,
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
  if (quoted.length > 0) {
    priorities.push({
      title: "Recover quoted opportunities",
      affectedCount: quoted.length,
      pipelineValue: quoted.reduce((s, d) => s + (d.value ?? 0), 0),
      ownerLabel: "Sales team",
      targetDate: snapshot.period.endDate,
    });
  }
  const dormant = snapshot.activePipeline.filter((d) => classifyDeal(d, snapshot) === "at_risk");
  if (dormant.length > 0) {
    priorities.push({
      title: "Re-engage dormant opportunities",
      affectedCount: dormant.length,
      pipelineValue: dormant.reduce((s, d) => s + (d.value ?? 0), 0),
      ownerLabel: "Deal owners",
      targetDate: null,
    });
  }
  if (c.followUpsMissed > 0) {
    priorities.push({
      title: "Complete overdue follow-ups",
      affectedCount: c.followUpsMissed,
      pipelineValue: null,
      ownerLabel: "Sales team",
      targetDate: null,
    });
  }

  const agenda = [
    "Review previous week's wins",
    atRisk && atRisk.count > 0 ? "Review at-risk high-value deals" : "Review active pipeline health",
    quoted.length > 0 ? "Assign actions for quotations awaiting follow-up" : "Confirm quotation follow-up owners",
    snapshot.lostThisWeek.length > 0 ? "Discuss lost-deal patterns" : "Confirm there were no unrecorded losses",
    concerns[0] ? "Coach the team on the key weakness from this week" : "Reinforce what worked",
    "Confirm next-week priorities",
  ];

  const executiveSummary = lowData
    ? `Only ${snapshot.activityVolume} sales activities were recorded this week, so there is not yet enough data to identify reliable performance patterns. The facts below are still complete for ${period}.`
    : [
        `Lead volume ${c.newLeads >= p.newLeads ? "increased" : "decreased"} compared with last week${
          c.avgFirstResponseMinutes != null &&
          p.avgFirstResponseMinutes != null &&
          c.avgFirstResponseMinutes < p.avgFirstResponseMinutes
            ? " and average response time improved"
            : ""
        }.`,
        quoted.length > 0
          ? `Quotation follow-up is the main weakness: ${quoted.length} quoted opportunities have no recorded action after delivery.`
          : drop && drop.dropOff > 0
            ? `The largest funnel fall-off sat at ${drop.label}.`
            : "No single funnel stage dominated leakage.",
        `The largest immediate opportunity for next week is ${biggestOpportunity.charAt(0).toLowerCase()}${biggestOpportunity.slice(1)}`,
      ].join(" ");

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
        : `${snapshot.activePipeline.length} active opportunities were classified using the organisation's inactivity and quotation follow-up rules.`,
    lossAnalysisNarrative:
      snapshot.lostThisWeek.length === 0
        ? "No opportunities were marked lost during the reporting period."
        : `${snapshot.lostThisWeek.length} opportunities worth approximately ${money(lostValue, snapshot.currency)} were marked lost.${
            priced > 0 ? ` Pricing appeared in ${priced} recorded loss reason${priced === 1 ? "" : "s"}.` : ""
          } Reasons that were not captured are labelled "Reason not recorded".`,
    conversationPatterns: snapshot.conversation.patterns.map((p) => ({
      id: p.id,
      interpretation:
        p.count >= 2
          ? `${p.label} appeared in ${p.count} inbound conversations and should be reviewed in the weekly meeting.`
          : `${p.label} appeared once and is not yet a reliable pattern.`,
    })),
    dataSufficiencyNote: lowData
      ? `Only ${snapshot.activityVolume} sales activities were recorded this week, so there is not yet enough data to identify reliable performance patterns.`
      : null,
  };
}
