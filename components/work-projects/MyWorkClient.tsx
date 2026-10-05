"use client";

import Link from "next/link";
import { workProjectVisitTypeLabel } from "@/lib/work-projects/constants";

type Task = {
  id: string;
  project_id: string;
  title: string;
  status: string;
  due_at: string | null;
  overdue: boolean;
  projectTitle: string;
  projectNumber: string;
};

type Visit = {
  id: string;
  project_id: string;
  title: string;
  visit_type: string;
  status: string;
  scheduled_start_at: string | null;
  site_address: string | null;
  overdue: boolean;
  projectTitle: string;
  projectNumber: string;
};

function bucket(start: string | null, overdue: boolean) {
  if (overdue) return "Overdue";
  if (!start) return "Upcoming";
  const time = new Date(start).getTime();
  const now = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (time <= end.getTime() && time >= new Date(now.toDateString()).getTime()) return "Today";
  return "Upcoming";
}

function clock(value: string | null) {
  if (!value) return "Time not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not set";
  return date.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

export function MyWorkClient({
  tasks,
  visits,
  basePath,
}: {
  tasks: Task[];
  visits: Visit[];
  basePath: "/sales/projects" | "/client/projects";
}) {
  const items = [
    ...visits.map((visit) => ({
      id: visit.id,
      href: `${basePath}/${visit.project_id}/visits/${visit.id}`,
      title: workProjectVisitTypeLabel(visit.visit_type),
      detail: `${visit.projectNumber} · ${visit.site_address || visit.projectTitle}`,
      when: visit.scheduled_start_at,
      group: bucket(visit.scheduled_start_at, visit.overdue),
    })),
    ...tasks.filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED").map((task) => ({
      id: task.id,
      href: `${basePath}/${task.project_id}`,
      title: task.title,
      detail: `${task.projectNumber} · ${task.projectTitle}`,
      when: task.due_at,
      group: bucket(task.due_at, task.overdue),
    })),
  ];
  return (
    <div className="space-y-6">
      {(["Today", "Upcoming", "Overdue"] as const).map((group) => {
        const rows = items.filter((item) => item.group === group);
        return (
          <section key={group}>
            <h2 className="text-[15px] font-semibold">{group}</h2>
            {rows.length === 0 ? <p className="mt-2 text-[15px] text-sales-text-secondary">{group === "Today" ? "Nothing scheduled today." : group === "Overdue" ? "Nothing overdue." : "Nothing coming up."}</p> : null}
            <ul className="mt-3 divide-y divide-sales-border-subtle">
              {rows.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-4">
                    <p className="text-[15px] font-semibold tabular-nums">{clock(item.when)}</p>
                    <div>
                      <p className="text-[16px] font-semibold">{item.title}</p>
                      <p className="mt-1 text-[14px] text-sales-text-secondary">{item.detail}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
