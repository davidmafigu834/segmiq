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
            {rows.length === 0 ? <p className="mt-1 text-[13px] text-sales-text-secondary">Nothing here.</p> : null}
            <ul className="mt-2 space-y-2">
              {rows.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="block min-h-11 rounded-sales-md border border-sales-border px-3 py-3">
                    <p className="text-[14px] font-medium">{item.title}</p>
                    <p className="mt-1 text-[13px] text-sales-text-secondary">{item.detail}</p>
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
