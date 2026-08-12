/**
 * SegmiQ Guided Learning — shared types.
 * Progress is versioned per course; practice data stays ephemeral (never CRM).
 */

export const GUIDED_COURSE_ID = "segmiq-2" as const;
export const GUIDED_COURSE_VERSION = "2.0" as const;

export type CourseStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DISMISSED";

export type LessonStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED";

export type CourseStepType =
  | "INTRO"
  | "SPOTLIGHT"
  | "ACTION"
  | "NAVIGATION"
  | "PRACTICE"
  | "EXPLANATION"
  | "COMPLETE";

export type CoachPlacement = "top" | "bottom" | "left" | "right" | "auto" | "center";

/** Semantic product / practice events that advance action steps. */
export type CourseEventName =
  | "NAVIGATED_TO_DASHBOARD"
  | "NAVIGATED_TO_PIPELINE"
  | "NAVIGATED_TO_LEADS"
  | "NAVIGATED_TO_TASKS"
  | "NAVIGATED_TO_QUOTES"
  | "NAVIGATED_TO_WHATSAPP"
  | "NAVIGATED_TO_GOALS"
  | "MOBILE_MORE_OPENED"
  | "OPENED_PRACTICE_LEAD"
  | "PRACTICE_QUALIFICATION_UPDATED"
  | "PRACTICE_DEAL_CREATED"
  | "PRACTICE_DEAL_OPENED"
  | "PRACTICE_DEAL_STAGE_CHANGED"
  | "PRACTICE_FOLLOWUP_COMPLETED"
  | "PRACTICE_QUOTE_CREATED"
  | "PRACTICE_WHATSAPP_REPLY_SELECTED"
  | "GOAL_VIEWED"
  | "COURSE_OVERLAY_ACK";

export type PracticeScenarioId =
  | "lead-to-deal"
  | "pipeline-stage"
  | "daily-plan-followup"
  | "quotation"
  | "whatsapp-hub"
  | "goals-overview";

export type CourseAction = {
  event: CourseEventName;
  /** Human cue shown in coachmark footer */
  cue: string;
};

export type CourseStep = {
  id: string;
  lessonId: string;
  type: CourseStepType;
  title: string;
  description: string;
  /** Optional short label above title */
  label?: string;
  /** Preferred route when this step becomes active */
  route?: string;
  /** data-course-target value */
  target?: string;
  /** Mobile-specific target override */
  mobileTarget?: string;
  placement?: CoachPlacement;
  requiredAction?: CourseAction;
  /** Complete when pathname matches (NAVIGATION) */
  routeMatch?: string | RegExp;
  allowManualNext?: boolean;
  practiceScenario?: PracticeScenarioId;
  /** Capability gate — skip if false */
  requiresCapability?: "whatsapp" | "goals" | "quotes";
};

export type CourseLesson = {
  id: string;
  title: string;
  summary: string;
  order: number;
  steps: CourseStep[];
};

export type GuidedCourseDefinition = {
  id: typeof GUIDED_COURSE_ID;
  version: typeof GUIDED_COURSE_VERSION;
  title: string;
  lessons: CourseLesson[];
};

export type LessonProgressRecord = {
  status: LessonStatus;
  currentStepId?: string | null;
  completedAt?: string | null;
  startedAt?: string | null;
};

export type GuidedLearningProgress = {
  courseId: typeof GUIDED_COURSE_ID;
  courseVersion: typeof GUIDED_COURSE_VERSION;
  status: CourseStatus;
  currentLessonId: string | null;
  currentStepId: string | null;
  completedLessonIds: string[];
  skippedLessonIds: string[];
  lessonProgress: Record<string, LessonProgressRecord>;
  welcomeDismissedAt: string | null;
  autoShowWelcome: boolean;
  dashboardCardHidden: boolean;
  startedAt: string | null;
  completedAt: string | null;
  lastSeenAt: string | null;
};

export type GuidedCourseUiMode =
  | "idle"
  | "welcome"
  | "active"
  | "paused"
  | "lesson_complete"
  | "course_complete"
  | "practice"
  | "failure";

export function defaultGuidedProgress(): GuidedLearningProgress {
  return {
    courseId: GUIDED_COURSE_ID,
    courseVersion: GUIDED_COURSE_VERSION,
    status: "NOT_STARTED",
    currentLessonId: null,
    currentStepId: null,
    completedLessonIds: [],
    skippedLessonIds: [],
    lessonProgress: {},
    welcomeDismissedAt: null,
    autoShowWelcome: true,
    dashboardCardHidden: false,
    startedAt: null,
    completedAt: null,
    lastSeenAt: null,
  };
}
