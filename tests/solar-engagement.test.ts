import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  resolveSolarEngagement,
  solarFollowUpWrite,
  solarQualificationReadiness,
  type SolarEngagementInput,
} from "../lib/sales/solar-workflow/engagement";

const NOW = new Date("2026-10-08T12:00:00");

function plan(overrides: Partial<SolarEngagementInput> = {}) {
  const input: SolarEngagementInput = {
    stage: "CONTACTED",
    now: NOW,
    lastMessageDirection: null,
    lastMessageAt: null,
    followUpAt: null,
    service: "Residential solar",
    location: "Borrowdale",
    timeline: "This month",
    budget: null,
    visitScheduled: false,
    visitAt: null,
    assessmentCompletedAt: null,
    quote: null,
    workflowKind: "qualify",
    workflowLabel: "Qualify",
    hasProject: false,
    ...overrides,
  };
  return resolveSolarEngagement(input);
}

test("qualification readiness uses commercial facts only", () => {
  const missing = solarQualificationReadiness({
    service: "Residential solar",
    location: "Borrowdale",
    timeline: "This month",
    budget: null,
  });
  assert.equal(missing.ready, false);
  assert.deepEqual(missing.missingFields, ["Budget"]);
  assert.equal(missing.recommendedQuestion, "Ask about budget");
  assert.equal(missing.missingFields.includes("Roof and site assessment"), false);

  const ready = solarQualificationReadiness({
    service: "Residential solar",
    location: "Borrowdale",
    timeline: "This month",
    budget: "5000",
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.recommendedQuestion, null);
});

test("new lead with no outbound needs a reply and no contact button", () => {
  const result = plan({
    stage: "NEW_LEAD",
    workflowKind: "contact",
    workflowLabel: "Contact lead",
    service: null,
    location: null,
    timeline: null,
  });
  assert.equal(result.stage, "NEW_LEAD");
  assert.equal(result.engagement, "NEEDS_REPLY");
  assert.equal(result.engagementLabel, "Needs reply");
  assert.equal(result.primary.title, "Reply to this customer");
  assert.equal(result.primary.button, null);
  assert.equal(result.secondary, null);
});

test("contacted and waiting does not qualify", () => {
  const result = plan({
    lastMessageDirection: "outbound",
    lastMessageAt: "2026-10-07T12:00:00",
  });
  assert.equal(result.stage, "CONTACTED");
  assert.equal(result.engagement, "WAITING_FOR_CUSTOMER");
  assert.equal(result.engagementLabel, "Waiting for customer");
  assert.notEqual(result.primary.button, "Qualify Lead");
  assert.notEqual(result.secondary?.button, "Qualify Lead");
});

test("customer reply with a missing budget asks for that fact", () => {
  const result = plan({
    lastMessageDirection: "inbound",
    lastMessageAt: "2026-10-08T10:00:00",
  });
  assert.equal(result.stage, "CONTACTED");
  assert.equal(result.engagement, "CUSTOMER_REPLIED");
  assert.equal(result.engagementLabel, "Needs reply");
  assert.equal(result.primary.title, "Ask about budget");
  assert.equal(result.primary.button, null);
  assert.equal(result.secondary, null);
  assert.deepEqual(result.qualification.missingFields, ["Budget"]);
});

test("qualification ready on a reply offers qualify as the secondary action", () => {
  const result = plan({
    budget: "5000",
    lastMessageDirection: "inbound",
    lastMessageAt: "2026-10-08T10:00:00",
  });
  assert.equal(result.primary.title, "Reply");
  assert.equal(result.secondary?.button, "Qualify Lead");
  assert.equal(result.secondary?.changesStage, true);
});

test("qualified opportunity schedules the site visit", () => {
  const result = plan({
    stage: "QUALIFIED",
    budget: "5000",
    workflowKind: "schedule_visit",
    workflowLabel: "Schedule site visit",
  });
  assert.equal(result.stage, "QUALIFIED");
  assert.equal(result.primary.button, "Schedule site visit");
  assert.equal(result.secondary, null);
});

test("qualified plus an unanswered message replies first", () => {
  const result = plan({
    stage: "QUALIFIED",
    budget: "5000",
    workflowKind: "schedule_visit",
    workflowLabel: "Schedule site visit",
    lastMessageDirection: "inbound",
    lastMessageAt: "2026-10-08T10:00:00",
  });
  assert.equal(result.stage, "QUALIFIED");
  assert.equal(result.engagement, "NEEDS_REPLY");
  assert.equal(result.primary.title, "Reply");
  assert.equal(result.primary.button, null);
  assert.equal(result.secondary?.button, "Schedule site visit");
});

test("a scheduled visit opens the visit instead of scheduling another", () => {
  const result = plan({
    stage: "SITE_VISIT_REQUIRED",
    budget: "5000",
    workflowKind: "open_visit",
    workflowLabel: "Open visit",
    visitScheduled: true,
    visitAt: "2026-10-13T10:00:00",
    lastMessageDirection: "outbound",
    lastMessageAt: "2026-10-07T12:00:00",
  });
  assert.equal(result.engagement, "WAITING_FOR_VISIT");
  assert.equal(result.engagementLabel, "Waiting for visit");
  assert.equal(result.primary.button, "Open visit");
  assert.notEqual(result.primary.button, "Schedule site visit");
  assert.notEqual(result.secondary?.button, "Schedule site visit");
});

test("site visit still to schedule stays secondary when follow-up is due", () => {
  const result = plan({
    stage: "SITE_VISIT_REQUIRED",
    budget: "5000",
    workflowKind: "schedule_visit",
    workflowLabel: "Schedule visit",
    lastMessageDirection: "outbound",
    lastMessageAt: "2026-10-05T12:00:00",
  });
  assert.equal(result.stage, "SITE_VISIT_REQUIRED");
  assert.equal(result.engagement, "FOLLOW_UP_DUE");
  assert.equal(result.primary.button, "Follow up");
  assert.equal(result.primary.changesStage, false);
  assert.equal(result.secondary?.button, "Schedule site visit");
});

test("completed assessment prepares a proposal unless the customer is waiting", () => {
  const quiet = plan({
    stage: "SITE_VISIT_COMPLETED",
    budget: "5000",
    workflowKind: "prepare_proposal",
    workflowLabel: "Prepare proposal",
    assessmentCompletedAt: "2026-10-06T09:00:00",
  });
  assert.equal(quiet.primary.button, "Prepare proposal");

  const waiting = plan({
    stage: "SITE_VISIT_COMPLETED",
    budget: "5000",
    workflowKind: "prepare_proposal",
    workflowLabel: "Prepare proposal",
    lastMessageDirection: "inbound",
    lastMessageAt: "2026-10-08T10:00:00",
  });
  assert.equal(waiting.primary.title, "Reply");
  assert.equal(waiting.secondary?.button, "Prepare proposal");
});

test("quote sent yesterday waits and does not open negotiation", () => {
  const result = plan({
    stage: "QUOTE_SENT",
    budget: "5800",
    workflowKind: "follow_up",
    workflowLabel: "Follow up",
    lastMessageDirection: "outbound",
    lastMessageAt: "2026-10-07T12:00:00",
    quote: {
      number: "SQ-1048",
      total: 5800,
      currency: "USD",
      sentAt: "2026-10-07T12:00:00",
      viewedAt: null,
      acceptedAt: null,
      status: "Sent",
    },
  });
  assert.equal(result.stage, "QUOTE_SENT");
  assert.equal(result.engagement, "WAITING_FOR_CUSTOMER");
  assert.equal(result.engagementLabel, "Waiting for customer");
  assert.equal(result.primary.button, null);
  assert.equal(result.secondary, null);
  assert.equal(JSON.stringify(result).includes("Negotiation"), false);
});

test("quote sent four days ago is due for follow-up without changing stage", () => {
  const result = plan({
    stage: "QUOTE_SENT",
    budget: "5800",
    workflowKind: "follow_up",
    workflowLabel: "Follow up",
    lastMessageDirection: "outbound",
    lastMessageAt: "2026-10-04T12:00:00",
    quote: {
      number: "SQ-1048",
      total: 5800,
      currency: "USD",
      sentAt: "2026-10-04T12:00:00",
      viewedAt: null,
      acceptedAt: null,
      status: "Sent",
    },
  });
  assert.equal(result.stage, "QUOTE_SENT");
  assert.equal(result.engagement, "FOLLOW_UP_DUE");
  assert.equal(result.engagementLabel, "Follow-up due");
  assert.equal(result.primary.button, "Follow up");
  assert.equal(result.primary.changesStage, false);
  assert.equal(result.secondary, null);
  assert.match(result.aiHook.draftSeed ?? "", /quotation/);
  assert.match(result.contextLines.join(" "), /SQ-1048/);
  assert.match(result.contextLines.join(" "), /5,800/);
});

test("a viewed quote with a price question needs a reply and stays quote sent", () => {
  const result = plan({
    stage: "QUOTE_SENT",
    budget: "5800",
    workflowKind: "follow_up",
    workflowLabel: "Follow up",
    lastMessageDirection: "inbound",
    lastMessageAt: "2026-10-08T10:00:00",
    quote: {
      number: "SQ-1048",
      total: 5800,
      currency: "USD",
      sentAt: "2026-10-04T12:00:00",
      viewedAt: "2026-10-06T12:00:00",
      acceptedAt: null,
      status: "Viewed",
    },
  });
  assert.equal(result.stage, "QUOTE_SENT");
  assert.equal(result.engagement, "NEEDS_REPLY");
  assert.equal(result.primary.title, "Reply");
  assert.notEqual(result.primary.kind, "mark_won");
  assert.equal(JSON.stringify(result).includes("Negotiation"), false);
});

test("viewed two days ago recommends follow-up and does not mark the deal won", () => {
  const result = plan({
    stage: "QUOTE_SENT",
    budget: "5800",
    workflowKind: "follow_up",
    workflowLabel: "Follow up",
    lastMessageDirection: "outbound",
    lastMessageAt: "2026-10-04T12:00:00",
    quote: {
      number: "SQ-1048",
      total: 5800,
      currency: "USD",
      sentAt: "2026-10-04T12:00:00",
      viewedAt: "2026-10-06T12:00:00",
      acceptedAt: null,
      status: "Viewed",
    },
  });
  assert.equal(result.engagementLabel, "Follow-up recommended");
  assert.equal(result.primary.kind, "follow_up");
  assert.notEqual(result.primary.kind, "mark_won");
});

test("an accepted quote offers mark won and does not apply it", () => {
  const result = plan({
    stage: "QUOTE_SENT",
    budget: "5800",
    workflowKind: "mark_won",
    workflowLabel: "Mark deal won",
    lastMessageDirection: "outbound",
    lastMessageAt: "2026-10-07T12:00:00",
    quote: {
      number: "SQ-1048",
      total: 5800,
      currency: "USD",
      sentAt: "2026-10-06T12:00:00",
      viewedAt: "2026-10-07T12:00:00",
      acceptedAt: "2026-10-08T09:00:00",
      status: "Accepted",
    },
  });
  assert.equal(result.stage, "QUOTE_SENT");
  assert.equal(result.primary.button, "Mark deal won");
  assert.equal(result.engagementLabel, "Quotation accepted");
});

test("overdue follow-up does not change the stage", () => {
  const result = plan({
    followUpAt: "2026-10-07",
    lastMessageDirection: "outbound",
    lastMessageAt: "2026-10-07T12:00:00",
  });
  assert.equal(result.stage, "CONTACTED");
  assert.equal(result.engagement, "FOLLOW_UP_DUE");
  assert.equal(result.primary.changesStage, false);
  assert.notEqual(result.primary.button, "Qualify Lead");
});

test("a future follow-up stays on the current stage", () => {
  const result = plan({
    followUpAt: "2026-10-16",
    lastMessageDirection: "outbound",
    lastMessageAt: "2026-10-06T12:00:00",
  });
  assert.equal(result.stage, "CONTACTED");
  assert.equal(result.engagement, "FOLLOW_UP_SCHEDULED");
  assert.equal(result.engagementLabel, "Waiting for customer");
  assert.match(result.primary.title ?? "", /Friday/);
  assert.equal(result.primary.changesStage, false);
  assert.notEqual(result.secondary?.button, "Qualify Lead");
});

test("follow-up writes one canonical reminder and no stage", () => {
  const deal = solarFollowUpWrite("deal-1", "2026-10-10");
  assert.equal(deal.resource, "deal");
  assert.deepEqual(Object.keys(deal.body).sort(), ["next_action_at", "next_action_label"]);
  const lead = solarFollowUpWrite(null, "2026-10-10");
  assert.equal(lead.resource, "lead");
  assert.deepEqual(Object.keys(lead.body), ["follow_up_date"]);
});

test("won offers the project and drops sales follow-up", () => {
  const create = plan({
    stage: "WON",
    workflowKind: "create_project",
    workflowLabel: "Create project",
    followUpAt: "2026-10-16",
  });
  assert.equal(create.engagementLabel, "Customer won");
  assert.equal(create.primary.button, "Create project");
  assert.equal(create.scheduleFollowUp, false);
  assert.match(create.engagementDetail ?? "", /Reminder/);

  const open = plan({
    stage: "WON",
    workflowKind: "open_project",
    workflowLabel: "Open project",
    hasProject: true,
  });
  assert.equal(open.primary.button, "Open project");
  assert.equal(open.scheduleFollowUp, false);
});

test("activity history stays short", () => {
  const result = plan({
    lastMessageDirection: "inbound",
    lastMessageAt: "2026-10-08T10:00:00",
    visitScheduled: true,
    visitAt: "2026-10-09T10:00:00",
  });
  assert.ok(result.activity.length <= 4);
  assert.ok(result.activity.some((line) => line.startsWith("Customer replied")));
});

test("the panel uses the engagement plan and the canonical follow-up write", () => {
  const panel = readFileSync("components/inbox/SolarOpportunityPanel.tsx", "utf8");
  assert.match(panel, /resolveSolarEngagement/);
  assert.match(panel, /solarFollowUpWrite/);
  assert.doesNotMatch(panel, /Contact lead/);
  assert.match(readFileSync("lib/sales/solar-workflow/service.ts", "utf8"), /deal\?\.next_action_at \|\| lead\.follow_up_date/);
});
