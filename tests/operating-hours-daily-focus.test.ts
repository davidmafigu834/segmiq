import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDailyFocusStatus, trackingStartDate } from "@/lib/sales/intelligence/daily-focus";
import {
  countGoalWorkingDaysLeft,
  formatDaysLeftLabel,
  formatWorkingDaysLabel,
  localClockInTimezone,
  resolveOperatingHours,
  resolveWorkdayState,
  scheduleSummaryLine,
} from "@/lib/sales/intelligence/operating-hours";
import { countWorkingDaysLeft } from "@/lib/sales/intelligence/timezone";

const HARARE = "Africa/Harare";
const HOURS = resolveOperatingHours({
  workingDays: [1, 2, 3, 4, 5],
  workStartTime: "08:00",
  workEndTime: "17:00",
});

describe("operating hours clock", () => {
  it("knows Tuesday 18 August 2026 10:00 is inside 8am–5pm in Harare", () => {
    // 10:00 CAT = 08:00 UTC
    const now = new Date("2026-08-18T08:00:00.000Z");
    const clock = localClockInTimezone(now, HARARE);
    assert.equal(clock.date, "2026-08-18");
    assert.equal(clock.weekday, 2);
    assert.equal(clock.weekdayLabel, "Tuesday");
    assert.equal(clock.dateLabel, "18 August 2026");

    const state = resolveWorkdayState(now, HARARE, HOURS);
    assert.equal(state.isWorkingDay, true);
    assert.equal(state.withinHours, true);
    assert.equal(state.beforeStart, false);
    assert.equal(state.afterEnd, false);
    assert.ok((state.minutesLeftInWorkday ?? 0) >= 6 * 60);
    assert.match(scheduleSummaryLine(state), /Tuesday 18 August 2026/);
  });

  it("treats Tuesday 7:30am as before work starts", () => {
    const now = new Date("2026-08-18T05:30:00.000Z");
    const state = resolveWorkdayState(now, HARARE, HOURS);
    assert.equal(state.beforeStart, true);
    assert.equal(state.withinHours, false);
  });

  it("treats Tuesday 5:00pm as after the workday", () => {
    const now = new Date("2026-08-18T15:00:00.000Z");
    const state = resolveWorkdayState(now, HARARE, HOURS);
    assert.equal(state.afterEnd, true);
    assert.equal(state.withinHours, false);
    assert.equal(state.minutesLeftInWorkday, 0);
  });

  it("treats Sunday as a rest day", () => {
    const now = new Date("2026-08-16T08:00:00.000Z");
    const state = resolveWorkdayState(now, HARARE, HOURS);
    assert.equal(state.isWorkingDay, false);
    assert.equal(state.weekdayLabel, "Sunday");
  });
});

describe("working days left", () => {
  it("counts remaining Mon–Fri days in August 2026 from Tuesday 18th during work hours", () => {
    const now = new Date("2026-08-18T08:00:00.000Z");
    const schedule = resolveWorkdayState(now, HARARE, HOURS);
    const days = countGoalWorkingDaysLeft({ schedule, periodEndInclusive: "2026-08-31" });
    // 18–31 Aug 2026 working days: 18-21, 24-28, 31 = 10
    assert.equal(days, 10);
    assert.equal(formatDaysLeftLabel(days), "10 days left");
  });

  it("excludes today after closing time", () => {
    const now = new Date("2026-08-18T15:30:00.000Z");
    const schedule = resolveWorkdayState(now, HARARE, HOURS);
    const days = countGoalWorkingDaysLeft({ schedule, periodEndInclusive: "2026-08-31" });
    assert.equal(days, 9);
  });

  it("skips weekends when includeFromDate is false", () => {
    assert.equal(countWorkingDaysLeft("2026-08-21", "2026-08-24", [1, 2, 3, 4, 5], false), 1);
  });
});

describe("operating hours labels", () => {
  it("formats weekday ranges", () => {
    assert.equal(formatWorkingDaysLabel([1, 2, 3, 4, 5]), "Mon–Fri");
    assert.equal(formatWorkingDaysLabel([1, 3, 5]), "Mon, Wed, Fri");
  });
});

describe("daily focus streak", () => {
  it("says yesterday was missed when the previous working day is incomplete", () => {
    const now = new Date("2026-08-18T08:00:00.000Z");
    const schedule = resolveWorkdayState(now, HARARE, HOURS);
    const status = buildDailyFocusStatus({
      schedule,
      todayComplete: false,
      trackingStartDate: "2026-08-01",
      logs: [{ planDate: "2026-08-17", planComplete: false }],
    });
    assert.equal(status.yesterdayMissed, true);
    assert.match(status.headline ?? "", /Yesterday you didn/);
  });

  it("counts 4 consecutive working days without completing daily focus", () => {
    const now = new Date("2026-08-18T08:00:00.000Z");
    const schedule = resolveWorkdayState(now, HARARE, HOURS);
    const status = buildDailyFocusStatus({
      schedule,
      todayComplete: false,
      trackingStartDate: "2026-08-01",
      logs: [
        { planDate: "2026-08-17", planComplete: false },
        { planDate: "2026-08-14", planComplete: false },
        { planDate: "2026-08-13", planComplete: false },
        { planDate: "2026-08-12", planComplete: false },
        { planDate: "2026-08-11", planComplete: true },
      ],
    });
    assert.equal(status.missedStreak, 4);
    assert.equal(status.headline, "You have 4 days without completing your daily focus");
  });

  it("does not invent missed days before the goal was set", () => {
    const now = new Date("2026-08-18T08:00:00.000Z");
    const schedule = resolveWorkdayState(now, HARARE, HOURS);
    const status = buildDailyFocusStatus({
      schedule,
      todayComplete: true,
      trackingStartDate: "2026-08-18",
      logs: [],
    });
    assert.equal(status.missedStreak, 0);
    assert.equal(status.yesterdayMissed, false);
    assert.equal(status.headline, null);
  });

  it("counts today after hours if the plan was not completed", () => {
    const now = new Date("2026-08-18T15:10:00.000Z");
    const schedule = resolveWorkdayState(now, HARARE, HOURS);
    const status = buildDailyFocusStatus({
      schedule,
      todayComplete: false,
      trackingStartDate: "2026-08-18",
      logs: [],
    });
    assert.equal(status.missedStreak, 1);
    assert.match(status.headline ?? "", /today/);
  });

  it("uses the later of period start and goal created date", () => {
    assert.equal(
      trackingStartDate({
        periodStart: "2026-08-01",
        goalCreatedAt: "2026-08-10T09:00:00.000Z",
        planDate: "2026-08-18",
      }),
      "2026-08-10"
    );
  });
});
