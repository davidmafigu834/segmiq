/**
 * Pure Guided Learning engine — start/pause/resume/complete without React.
 * Safe for unit tests.
 */

import { orderedSegmiq2Lessons, SEGMIQ_2_COURSE } from "./courses/segmiq-2";
import {
  defaultGuidedProgress,
  type CourseEventName,
  type CourseStep,
  type GuidedLearningProgress,
  type LessonProgressRecord,
} from "./types";

export type CourseCapabilities = {
  whatsapp: boolean;
  goals: boolean;
  quotes: boolean;
};

export const DEFAULT_CAPABILITIES: CourseCapabilities = {
  whatsapp: true,
  goals: true,
  quotes: true,
};

function nowIso() {
  return new Date().toISOString();
}

export function isStepAvailable(
  step: CourseStep,
  caps: CourseCapabilities = DEFAULT_CAPABILITIES
): boolean {
  if (!step.requiresCapability) return true;
  return caps[step.requiresCapability] === true;
}

export function getLessonSteps(
  lessonId: string,
  caps: CourseCapabilities = DEFAULT_CAPABILITIES
): CourseStep[] {
  const lesson = SEGMIQ_2_COURSE.lessons.find((l) => l.id === lessonId);
  if (!lesson) return [];
  return lesson.steps.filter((s) => isStepAvailable(s, caps));
}

export function firstLessonId(caps: CourseCapabilities = DEFAULT_CAPABILITIES): string | null {
  for (const lesson of orderedSegmiq2Lessons()) {
    if (getLessonSteps(lesson.id, caps).length > 0) return lesson.id;
  }
  return null;
}

export function nextLessonId(
  currentLessonId: string,
  progress: GuidedLearningProgress,
  caps: CourseCapabilities = DEFAULT_CAPABILITIES
): string | null {
  const lessons = orderedSegmiq2Lessons();
  const idx = lessons.findIndex((l) => l.id === currentLessonId);
  for (let i = idx + 1; i < lessons.length; i++) {
    const id = lessons[i]!.id;
    if (progress.completedLessonIds.includes(id)) continue;
    if (getLessonSteps(id, caps).length === 0) continue;
    return id;
  }
  return null;
}

export function resolveStep(
  progress: GuidedLearningProgress,
  caps: CourseCapabilities = DEFAULT_CAPABILITIES
): CourseStep | null {
  if (!progress.currentLessonId) return null;
  const steps = getLessonSteps(progress.currentLessonId, caps);
  if (!steps.length) return null;
  if (progress.currentStepId) {
    const found = steps.find((s) => s.id === progress.currentStepId);
    if (found) return found;
  }
  return steps[0] ?? null;
}

export function stepIndex(
  lessonId: string,
  stepId: string,
  caps: CourseCapabilities = DEFAULT_CAPABILITIES
): { index: number; total: number } {
  const steps = getLessonSteps(lessonId, caps);
  const index = Math.max(0, steps.findIndex((s) => s.id === stepId));
  return { index: index + 1, total: steps.length };
}

export function completedLessonCount(progress: GuidedLearningProgress): number {
  return progress.completedLessonIds.length;
}

export function totalLessonCount(caps: CourseCapabilities = DEFAULT_CAPABILITIES): number {
  return orderedSegmiq2Lessons().filter((l) => getLessonSteps(l.id, caps).length > 0).length;
}

function patchLesson(
  progress: GuidedLearningProgress,
  lessonId: string,
  patch: Partial<LessonProgressRecord>
): GuidedLearningProgress {
  const prev = progress.lessonProgress[lessonId] ?? { status: "NOT_STARTED" as const };
  return {
    ...progress,
    lessonProgress: {
      ...progress.lessonProgress,
      [lessonId]: { ...prev, ...patch },
    },
  };
}

export function startCourse(
  progress: GuidedLearningProgress,
  caps: CourseCapabilities = DEFAULT_CAPABILITIES,
  lessonId?: string
): GuidedLearningProgress {
  const startLesson = lessonId ?? firstLessonId(caps);
  if (!startLesson) return progress;
  const steps = getLessonSteps(startLesson, caps);
  const firstStep = steps[0];
  const ts = nowIso();
  let next: GuidedLearningProgress = {
    ...progress,
    status: "IN_PROGRESS",
    currentLessonId: startLesson,
    currentStepId: firstStep?.id ?? null,
    startedAt: progress.startedAt ?? ts,
    lastSeenAt: ts,
    welcomeDismissedAt: progress.welcomeDismissedAt ?? ts,
    autoShowWelcome: false,
  };
  next = patchLesson(next, startLesson, {
    status: "IN_PROGRESS",
    currentStepId: firstStep?.id ?? null,
    startedAt: next.lessonProgress[startLesson]?.startedAt ?? ts,
  });
  return next;
}

export function dismissWelcome(progress: GuidedLearningProgress): GuidedLearningProgress {
  return {
    ...progress,
    status: progress.status === "NOT_STARTED" ? "DISMISSED" : progress.status,
    welcomeDismissedAt: nowIso(),
    autoShowWelcome: false,
    lastSeenAt: nowIso(),
  };
}

export function hideDashboardCard(progress: GuidedLearningProgress): GuidedLearningProgress {
  return { ...progress, dashboardCardHidden: true, lastSeenAt: nowIso() };
}

export function disableAutoWelcome(progress: GuidedLearningProgress): GuidedLearningProgress {
  return { ...progress, autoShowWelcome: false, lastSeenAt: nowIso() };
}

export function advanceToStep(
  progress: GuidedLearningProgress,
  lessonId: string,
  stepId: string
): GuidedLearningProgress {
  let next: GuidedLearningProgress = {
    ...progress,
    status: "IN_PROGRESS",
    currentLessonId: lessonId,
    currentStepId: stepId,
    lastSeenAt: nowIso(),
  };
  next = patchLesson(next, lessonId, {
    status: "IN_PROGRESS",
    currentStepId: stepId,
  });
  return next;
}

export function completeCurrentStep(
  progress: GuidedLearningProgress,
  caps: CourseCapabilities = DEFAULT_CAPABILITIES
): GuidedLearningProgress {
  const step = resolveStep(progress, caps);
  if (!step || !progress.currentLessonId) return progress;
  const steps = getLessonSteps(progress.currentLessonId, caps);
  const idx = steps.findIndex((s) => s.id === step.id);
  const nextStep = idx >= 0 ? steps[idx + 1] : undefined;

  if (nextStep) {
    return advanceToStep(progress, progress.currentLessonId, nextStep.id);
  }

  // Lesson complete
  const ts = nowIso();
  const completedLessonIds = progress.completedLessonIds.includes(progress.currentLessonId)
    ? progress.completedLessonIds
    : [...progress.completedLessonIds, progress.currentLessonId];

  let next: GuidedLearningProgress = {
    ...progress,
    completedLessonIds,
    lastSeenAt: ts,
  };
  next = patchLesson(next, progress.currentLessonId, {
    status: "COMPLETED",
    completedAt: ts,
    currentStepId: step.id,
  });

  const following = nextLessonId(progress.currentLessonId, next, caps);
  if (!following) {
    return {
      ...next,
      status: "COMPLETED",
      completedAt: ts,
      currentLessonId: progress.currentLessonId,
      currentStepId: step.id,
    };
  }

  const followingSteps = getLessonSteps(following, caps);
  const first = followingSteps[0];
  next = {
    ...next,
    status: "IN_PROGRESS",
    currentLessonId: following,
    currentStepId: first?.id ?? null,
  };
  if (first) {
    next = patchLesson(next, following, {
      status: "IN_PROGRESS",
      currentStepId: first.id,
      startedAt: ts,
    });
  }
  return next;
}

export function goToPreviousStep(
  progress: GuidedLearningProgress,
  caps: CourseCapabilities = DEFAULT_CAPABILITIES
): GuidedLearningProgress {
  const step = resolveStep(progress, caps);
  if (!step || !progress.currentLessonId) return progress;
  const steps = getLessonSteps(progress.currentLessonId, caps);
  const idx = steps.findIndex((s) => s.id === step.id);
  if (idx <= 0) return progress;
  const prev = steps[idx - 1]!;
  // Never undo actions — revisit explanation only
  return advanceToStep(progress, progress.currentLessonId, prev.id);
}

export function skipLesson(
  progress: GuidedLearningProgress,
  lessonId: string,
  caps: CourseCapabilities = DEFAULT_CAPABILITIES
): GuidedLearningProgress {
  const ts = nowIso();
  const skipped = progress.skippedLessonIds.includes(lessonId)
    ? progress.skippedLessonIds
    : [...progress.skippedLessonIds, lessonId];
  let next: GuidedLearningProgress = {
    ...progress,
    skippedLessonIds: skipped,
    lastSeenAt: ts,
  };
  next = patchLesson(next, lessonId, { status: "SKIPPED", completedAt: ts });
  const following = nextLessonId(lessonId, next, caps);
  if (!following) {
    return {
      ...next,
      status: completedLessonCount(next) >= totalLessonCount(caps) ? "COMPLETED" : next.status,
      currentLessonId: lessonId,
    };
  }
  const steps = getLessonSteps(following, caps);
  return startCourse({ ...next, currentLessonId: null, currentStepId: null }, caps, following);
}

export function replayLesson(
  progress: GuidedLearningProgress,
  lessonId: string,
  caps: CourseCapabilities = DEFAULT_CAPABILITIES
): GuidedLearningProgress {
  const steps = getLessonSteps(lessonId, caps);
  const first = steps[0];
  if (!first) return progress;
  let next: GuidedLearningProgress = {
    ...progress,
    status: "IN_PROGRESS",
    currentLessonId: lessonId,
    currentStepId: first.id,
    lastSeenAt: nowIso(),
    // Keep overall completion; replay does not remove completedLessonIds
  };
  next = patchLesson(next, lessonId, {
    status: "IN_PROGRESS",
    currentStepId: first.id,
    startedAt: nowIso(),
  });
  return next;
}

export function stepAcceptsEvent(step: CourseStep, event: CourseEventName): boolean {
  if (!step.requiredAction) return false;
  return step.requiredAction.event === event;
}

export function canManualAdvance(step: CourseStep): boolean {
  if (step.requiredAction) return false;
  return step.allowManualNext === true || step.type === "INTRO" || step.type === "EXPLANATION" || step.type === "COMPLETE" || step.type === "PRACTICE" || step.type === "SPOTLIGHT";
}

export function normalizeProgress(raw: Partial<GuidedLearningProgress> | null | undefined): GuidedLearningProgress {
  const base = defaultGuidedProgress();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    courseId: "segmiq-2",
    courseVersion: raw.courseVersion === "2.0" ? "2.0" : base.courseVersion,
    completedLessonIds: Array.isArray(raw.completedLessonIds) ? raw.completedLessonIds : [],
    skippedLessonIds: Array.isArray(raw.skippedLessonIds) ? raw.skippedLessonIds : [],
    lessonProgress: raw.lessonProgress && typeof raw.lessonProgress === "object" ? raw.lessonProgress : {},
  };
}
