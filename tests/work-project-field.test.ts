import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { REAL_ESTATE_COMPANY_NAVIGATION } from "../lib/sales/navigation/company-nav-config";
import { resolveSalesNavItems } from "../lib/sales/navigation/sales-nav-config";
import {
  canMemberUpdateTask,
  emptySolarAssessment,
  fieldAttention,
  isTaskOverdue,
  isVisitOverdue,
  parseSolarAssessment,
  solarAssessmentCompletionError,
  solarLoadSummary,
} from "../lib/work-projects/field-rules";

const fieldSql = readFileSync("supabase/migrations/20261003223000_work_project_field_operations.sql", "utf8");
const fieldService = readFileSync("lib/work-projects/field-service.ts", "utf8");
const reminders = readFileSync("lib/work-projects/reminders.ts", "utf8");
const calendarPage = readFileSync("app/client/calendar/page.tsx", "utf8");
const closeDeal = readFileSync("lib/sales/deals/close-deal.ts", "utf8");

const now = new Date("2026-10-07T08:00:00.000Z");

describe("project tasks", () => {
  it("marks an open task overdue only after its due time", () => {
    assert.equal(isTaskOverdue({ status: "TODO", due_at: "2026-10-06T08:00:00.000Z" }, now), true);
    assert.equal(isTaskOverdue({ status: "COMPLETED", due_at: "2026-10-06T08:00:00.000Z" }, now), false);
    assert.equal(isTaskOverdue({ status: "CANCELLED", due_at: "2026-10-06T08:00:00.000Z" }, now), false);
    assert.equal(isTaskOverdue({ status: "TODO", due_at: "2026-10-08T08:00:00.000Z" }, now), false);
  });

  it("lets a member update only their own assigned task, and only into progress, blocked, or completed", () => {
    assert.equal(canMemberUpdateTask({ isManager: false, actorUserId: "a", assignedToId: "a", nextStatus: "COMPLETED" }), true);
    assert.equal(canMemberUpdateTask({ isManager: false, actorUserId: "a", assignedToId: "b", nextStatus: "COMPLETED" }), false);
    assert.equal(canMemberUpdateTask({ isManager: false, actorUserId: "a", assignedToId: "a", nextStatus: "CANCELLED" }), false);
    assert.equal(canMemberUpdateTask({ isManager: true, actorUserId: "a", assignedToId: "b", nextStatus: "CANCELLED" }), true);
  });
});

describe("field visits", () => {
  it("flags a scheduled visit overdue without treating a completed visit as missed", () => {
    assert.equal(isVisitOverdue({ status: "SCHEDULED", scheduled_end_at: "2026-10-07T07:00:00.000Z", scheduled_start_at: "2026-10-07T06:00:00.000Z" }, now), true);
    assert.equal(isVisitOverdue({ status: "COMPLETED", scheduled_end_at: "2026-10-07T07:00:00.000Z", scheduled_start_at: "2026-10-07T06:00:00.000Z" }, now), false);
    assert.equal(isVisitOverdue({ status: "SCHEDULED", scheduled_end_at: null, scheduled_start_at: "2026-10-07T09:00:00.000Z" }, now), false);
  });

  it("requires a cancellation reason, keeps the project, and records the previous time on reschedule", () => {
    assert.match(fieldService, /Choose a cancellation reason/);
    assert.match(fieldService, /VISIT_RESCHEDULED/);
    assert.match(fieldService, /previous/);
    assert.equal(fieldService.includes('.from("call_logs")'), false);
    assert.equal(fieldService.includes("follow_up_date"), false);
    assert.equal(closeDeal.includes("work_project_visits"), false);
  });

  it("rejects an assignee who is not already on the project", () => {
    assert.match(fieldService, /Assign someone who is already on this project/);
  });
});

describe("solar site assessment", () => {
  it("keeps a draft when required outcome is missing and accepts structured loads", () => {
    const draft = emptySolarAssessment();
    draft.site.address = "Borrowdale, Harare";
    draft.loads = [{ name: "Borehole pump", quantity: 1, watts: 1100, essential: true, notes: "1HP" }];
    assert.equal(solarAssessmentCompletionError(draft, null), "Choose an assessment outcome.");
    const parsed = parseSolarAssessment({
      site: { address: "Borrowdale, Harare" },
      loads: [{ name: "Borehole pump", quantity: 1, watts: null, essential: true, notes: "1HP" }],
      outcome: "suitable",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.data.loads[0]?.watts, null);
    assert.match(solarLoadSummary(parsed.data) || "", /Essential loads: Borehole pump/);
  });

  it("completes the visit and assessment in one database function without moving the project", () => {
    assert.match(fieldSql, /complete_work_project_assessment/);
    assert.match(fieldSql, /SITE_ASSESSMENT_COMPLETED/);
    assert.match(fieldSql, /VISIT_COMPLETED/);
    assert.match(fieldSql, /schema_version/);
    assert.equal(fieldSql.includes("SET status = 'READY_TO_SCHEDULE'"), false);
    assert.match(fieldSql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(fieldSql, /WORK_PROJECT_VISIT/);
    assert.match(fieldSql, /WORK_PROJECT_ALERT/);
  });
});

describe("operational attention and calendar", () => {
  it("builds deterministic project attention", () => {
    const lines = fieldAttention({
      projectStatus: "SITE_ASSESSMENT",
      members: [{ role: "SALES_COORDINATOR" }],
      tasks: [{ status: "TODO", due_at: "2026-10-01T00:00:00.000Z" }],
      visits: [{ visit_type: "SITE_ASSESSMENT", status: "SCHEDULED", scheduled_end_at: "2026-10-01T00:00:00.000Z", scheduled_start_at: "2026-10-01T00:00:00.000Z" }],
      assessmentCompleted: true,
    }, now);
    assert.deepEqual(lines, [
      "1 project task overdue",
      "Site assessment overdue",
      "No field staff assigned",
      "Site assessment completed but project still in Site Assessment",
    ]);
  });

  it("adds field visits to the company calendar without writing sales callbacks", () => {
    assert.match(calendarPage, /listOperationalCalendar/);
    assert.match(calendarPage, /field_visit/);
    assert.match(calendarPage, /project_start/);
    assert.equal(calendarPage.includes("call_logs"), false);
    assert.match(reminders, /visit24:/);
    assert.match(reminders, /visitMorning:/);
    assert.match(reminders, /23505/);
  });

  it("keeps My work off the real-estate navigation", () => {
    assert.equal(REAL_ESTATE_COMPANY_NAVIGATION.some((item) => item.id === "myWork"), false);
    assert.equal(resolveSalesNavItems(false, "real_estate").some((item) => item.id === "myWork"), false);
    assert.equal(resolveSalesNavItems(false, "trades").some((item) => item.id === "myWork"), true);
  });
});
