import type { WorkProjectStatus } from "@/lib/work-projects/constants";

export type ProjectAttention = {
  overdue: boolean;
  startOverdue: boolean;
};

function todayUtcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function projectAttention(
  project: {
    status: WorkProjectStatus | string;
    target_completion_date: string | null;
    scheduled_start_at: string | null;
  },
  now: Date = new Date()
): ProjectAttention {
  const closed = project.status === "COMPLETED" || project.status === "CANCELLED";
  const target = project.target_completion_date?.slice(0, 10) ?? null;
  const overdue = Boolean(target) && !closed && target! < todayUtcDate(now);
  const startOverdue =
    project.status === "SCHEDULED" &&
    Boolean(project.scheduled_start_at) &&
    new Date(project.scheduled_start_at as string).getTime() < now.getTime();
  return { overdue, startOverdue };
}
