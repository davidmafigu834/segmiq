import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canManualAdvance,
  completeCurrentStep,
  DEFAULT_CAPABILITIES,
  dismissWelcome,
  goToPreviousStep,
  normalizeProgress,
  replayLesson,
  resolveStep,
  startCourse,
  stepAcceptsEvent,
  completedLessonCount,
  totalLessonCount,
} from "../lib/sales/training/engine";
import { defaultGuidedProgress } from "../lib/sales/training/types";
import { createPracticeSeed } from "../lib/sales/training/practice/practice-state";
import { courseEventForPathname } from "../lib/sales/training/course-events";

describe("guided learning engine", () => {
  it("starts at getting-started first step", () => {
    const next = startCourse(defaultGuidedProgress());
    assert.equal(next.status, "IN_PROGRESS");
    assert.equal(next.currentLessonId, "getting-started");
    assert.equal(next.currentStepId, "gs-welcome");
    assert.equal(next.autoShowWelcome, false);
  });

  it("does not allow Next on action-required pipeline step", () => {
    let p = startCourse(defaultGuidedProgress());
    // jump to pipeline nav step
    p = {
      ...p,
      currentLessonId: "getting-started",
      currentStepId: "gs-open-pipeline",
    };
    const step = resolveStep(p)!;
    assert.equal(step.requiredAction?.event, "NAVIGATED_TO_PIPELINE");
    assert.equal(canManualAdvance(step), false);
    assert.equal(stepAcceptsEvent(step, "NAVIGATED_TO_PIPELINE"), true);
    assert.equal(stepAcceptsEvent(step, "NAVIGATED_TO_LEADS"), false);
  });

  it("completes navigation step on matching event", () => {
    let p = startCourse(defaultGuidedProgress());
    p = { ...p, currentLessonId: "getting-started", currentStepId: "gs-open-pipeline" };
    const after = completeCurrentStep(p);
    assert.equal(after.currentStepId, "gs-back-dashboard");
  });

  it("persists progress across conceptual refresh via normalize", () => {
    const started = startCourse(defaultGuidedProgress());
    const restored = normalizeProgress(JSON.parse(JSON.stringify(started)));
    assert.equal(restored.currentLessonId, started.currentLessonId);
    assert.equal(restored.currentStepId, started.currentStepId);
    assert.equal(restored.status, "IN_PROGRESS");
  });

  it("dismiss welcome does not force restart", () => {
    const d = dismissWelcome(defaultGuidedProgress());
    assert.equal(d.status, "DISMISSED");
    assert.equal(d.autoShowWelcome, false);
    assert.ok(d.welcomeDismissedAt);
  });

  it("replay keeps completed lesson ids", () => {
    let p = startCourse(defaultGuidedProgress());
    p = {
      ...p,
      completedLessonIds: ["getting-started"],
      status: "IN_PROGRESS",
    };
    const replayed = replayLesson(p, "getting-started");
    assert.ok(replayed.completedLessonIds.includes("getting-started"));
    assert.equal(replayed.currentLessonId, "getting-started");
    assert.equal(replayed.currentStepId, "gs-welcome");
  });

  it("back revisits previous step without clearing completion", () => {
    let p = startCourse(defaultGuidedProgress());
    p = completeCurrentStep(p); // gs-dashboard
    const back = goToPreviousStep(p);
    assert.equal(back.currentStepId, "gs-welcome");
  });

  it("counts lessons with capabilities", () => {
    assert.equal(totalLessonCount(DEFAULT_CAPABILITIES), 7);
    assert.equal(completedLessonCount(defaultGuidedProgress()), 0);
  });
});

describe("guided learning route events", () => {
  it("maps pipeline and leads routes", () => {
    assert.equal(courseEventForPathname("/sales/leads"), "NAVIGATED_TO_PIPELINE");
    assert.equal(courseEventForPathname("/sales/call-now"), "NAVIGATED_TO_LEADS");
    assert.equal(courseEventForPathname("/sales/dashboard"), "NAVIGATED_TO_DASHBOARD");
  });
});

describe("practice seed isolation", () => {
  it("creates ephemeral practice lead without CRM ids from product", () => {
    const seed = createPracticeSeed();
    assert.equal(seed.lead.id.startsWith("practice-"), true);
    assert.equal(seed.deal.id.startsWith("practice-"), true);
    assert.equal(seed.lead.dealCreated, false);
    assert.equal(seed.deal.quoteCreated, false);
  });
});
