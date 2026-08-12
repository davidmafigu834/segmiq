import { createAdminClient } from "@/lib/supabase/admin";
import {
  GUIDED_COURSE_ID,
  GUIDED_COURSE_VERSION,
  defaultGuidedProgress,
  type GuidedLearningProgress,
} from "./types";
import { normalizeProgress } from "./engine";

type DbRow = {
  course_id: string;
  course_version: string;
  status: GuidedLearningProgress["status"];
  current_lesson_id: string | null;
  current_step_id: string | null;
  completed_lesson_ids: unknown;
  skipped_lesson_ids: unknown;
  lesson_progress: unknown;
  welcome_dismissed_at: string | null;
  auto_show_welcome: boolean;
  dashboard_card_hidden: boolean;
  started_at: string | null;
  completed_at: string | null;
  last_seen_at: string | null;
};

function rowToProgress(row: DbRow): GuidedLearningProgress {
  return normalizeProgress({
    courseId: GUIDED_COURSE_ID,
    courseVersion: (row.course_version as "2.0") || GUIDED_COURSE_VERSION,
    status: row.status,
    currentLessonId: row.current_lesson_id,
    currentStepId: row.current_step_id,
    completedLessonIds: Array.isArray(row.completed_lesson_ids)
      ? (row.completed_lesson_ids as string[])
      : [],
    skippedLessonIds: Array.isArray(row.skipped_lesson_ids)
      ? (row.skipped_lesson_ids as string[])
      : [],
    lessonProgress:
      row.lesson_progress && typeof row.lesson_progress === "object"
        ? (row.lesson_progress as GuidedLearningProgress["lessonProgress"])
        : {},
    welcomeDismissedAt: row.welcome_dismissed_at,
    autoShowWelcome: row.auto_show_welcome,
    dashboardCardHidden: row.dashboard_card_hidden,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastSeenAt: row.last_seen_at,
  });
}

function isSchemaMissing(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /sales_guided_learning_progress|relation|does not exist|Could not find the table/i.test(
    message
  );
}

export async function getGuidedLearningProgress(opts: {
  userId: string;
  clientId: string;
}): Promise<{ progress: GuidedLearningProgress; schemaMissing: boolean }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_guided_learning_progress")
    .select(
      "course_id, course_version, status, current_lesson_id, current_step_id, completed_lesson_ids, skipped_lesson_ids, lesson_progress, welcome_dismissed_at, auto_show_welcome, dashboard_card_hidden, started_at, completed_at, last_seen_at"
    )
    .eq("user_id", opts.userId)
    .eq("client_id", opts.clientId)
    .eq("course_id", GUIDED_COURSE_ID)
    .eq("course_version", GUIDED_COURSE_VERSION)
    .maybeSingle();

  if (error) {
    if (isSchemaMissing(error)) {
      return { progress: defaultGuidedProgress(), schemaMissing: true };
    }
    throw error;
  }
  if (!data) {
    return { progress: defaultGuidedProgress(), schemaMissing: false };
  }
  return { progress: rowToProgress(data as DbRow), schemaMissing: false };
}

export async function upsertGuidedLearningProgress(opts: {
  userId: string;
  clientId: string;
  progress: GuidedLearningProgress;
}): Promise<{ schemaMissing: boolean }> {
  const supabase = createAdminClient();
  const p = normalizeProgress(opts.progress);
  const payload = {
    user_id: opts.userId,
    client_id: opts.clientId,
    course_id: GUIDED_COURSE_ID,
    course_version: GUIDED_COURSE_VERSION,
    status: p.status,
    current_lesson_id: p.currentLessonId,
    current_step_id: p.currentStepId,
    completed_lesson_ids: p.completedLessonIds,
    skipped_lesson_ids: p.skippedLessonIds,
    lesson_progress: p.lessonProgress,
    welcome_dismissed_at: p.welcomeDismissedAt,
    auto_show_welcome: p.autoShowWelcome,
    dashboard_card_hidden: p.dashboardCardHidden,
    started_at: p.startedAt,
    completed_at: p.completedAt,
    last_seen_at: p.lastSeenAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("sales_guided_learning_progress")
    .upsert(payload, { onConflict: "user_id,client_id,course_id,course_version" });

  if (error) {
    if (isSchemaMissing(error)) return { schemaMissing: true };
    throw error;
  }
  return { schemaMissing: false };
}
