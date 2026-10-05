"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  VISIT_CANCEL_REASONS,
  WORK_PROJECT_ASSIGNABLE_ROLES,
  WORK_PROJECT_TASK_TYPES,
  WORK_PROJECT_VISIT_TYPES,
  workProjectMemberRoleLabel,
  workProjectTaskStatusLabel,
  workProjectTaskTypeLabel,
  workProjectVisitStatusLabel,
  workProjectVisitTypeLabel,
} from "@/lib/work-projects/constants";
import type { ProjectFieldSnapshot } from "@/lib/work-projects/field-service";

function when(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ProjectFieldSummary({
  field,
  projectStatus,
  basePath,
  projectId,
}: {
  field: ProjectFieldSnapshot;
  projectStatus: string;
  basePath: string;
  projectId: string;
}) {
  if (projectStatus !== "SITE_ASSESSMENT" || !field.canManageTeam) return null;
  return (
    <section>
      {projectStatus === "SITE_ASSESSMENT" && field.canManageTeam ? (
        <Link href={`${basePath}/${projectId}?tab=visits`} className="inline-flex min-h-11 items-center text-[15px] font-semibold">
          Schedule site assessment
        </Link>
      ) : null}
    </section>
  );
}

export function ProjectTasksPanel({
  projectId,
  field,
  members,
}: {
  projectId: string;
  field: ProjectFieldSnapshot;
  members: ProjectFieldSnapshot["members"];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [type, setType] = useState("GENERAL");
  const [error, setError] = useState("");
  const groups = ["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as const;

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch(`/api/work-projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, taskType: type, assignedToId: assignee || null }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error || "Could not create the task.");
      return;
    }
    setTitle("");
    router.refresh();
  }

  async function setStatus(taskId: string, status: string) {
    await fetch(`/api/work-projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {field.canManageTeam ? (
        <form onSubmit={(event) => void createTask(event)} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_11rem_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task" aria-label="Task" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[15px]" />
          <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Task type" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[15px]">
            {WORK_PROJECT_TASK_TYPES.map((item) => <option key={item} value={item}>{workProjectTaskTypeLabel(item)}</option>)}
          </select>
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)} aria-label="Assignee" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[15px]">
            <option value="">Unassigned</option>
            {members.map((member) => <option key={member.userId} value={member.userId}>{member.name || "Team member"}</option>)}
          </select>
          <button className="min-h-11 rounded-sales-md bg-segmiq-lime px-4 text-[14px] font-semibold text-sales-text-primary" type="submit">Add task</button>
        </form>
      ) : null}
      {error ? <p className="text-[14px] text-sales-danger-fg">{error}</p> : null}
      {field.tasks.length === 0 ? <p className="text-[16px] text-sales-text-secondary">Nothing to do here.</p> : null}
      {groups.map((status) => {
        const rows = field.tasks.filter((task) => task.status === status);
        if (!rows.length) return null;
        return (
          <section key={status}>
            <h3 className="text-[15px] font-semibold">{workProjectTaskStatusLabel(status)}</h3>
            <ul className="mt-1 divide-y divide-sales-border-subtle">
              {rows.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-[16px] font-semibold">{task.title}</p>
                    <p className="mt-1 text-[14px] text-sales-text-secondary">
                      {task.assigneeName || "Unassigned"}
                      {task.dueAt ? ` · Due ${when(task.dueAt)}` : ""}
                      {task.overdue ? " · Overdue" : ""}
                    </p>
                  </div>
                  {status !== "COMPLETED" ? (
                    <button type="button" className="min-h-11 rounded-sales-md bg-segmiq-lime px-4 text-[14px] font-semibold text-sales-text-primary" onClick={() => void setStatus(task.id, "COMPLETED")}>Complete</button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function ProjectVisitsPanel({
  projectId,
  field,
  basePath,
  defaultSite,
  suggestAssessment,
}: {
  projectId: string;
  field: ProjectFieldSnapshot;
  basePath: string;
  defaultSite: string | null;
  suggestAssessment: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(suggestAssessment && field.canManageTeam);
  const [visitType, setVisitType] = useState(suggestAssessment ? "SITE_ASSESSMENT" : "SITE_ASSESSMENT");
  const [whenValue, setWhenValue] = useState("");
  const [duration, setDuration] = useState(90);
  const [assignee, setAssignee] = useState("");
  const [site, setSite] = useState(defaultSite ?? "");
  const [instructions, setInstructions] = useState("");
  const [notify, setNotify] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function schedule(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch(`/api/work-projects/${projectId}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitType,
        startAt: new Date(whenValue).toISOString(),
        durationMinutes: duration,
        assigneeIds: assignee ? [assignee] : [],
        siteAddress: site || null,
        instructions: instructions || null,
        notifyCustomer: notify,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; customerNotice?: string | null };
    if (!res.ok) {
      setError(json.error || "Could not schedule the visit.");
      return;
    }
    setNotice(json.customerNotice || "Visit scheduled.");
    setOpen(false);
    router.refresh();
  }

  const groups = [
    ["Upcoming", field.visits.filter((visit) => visit.status === "SCHEDULED" || visit.status === "DRAFT" || visit.status === "ON_SITE")],
    ["Completed", field.visits.filter((visit) => visit.status === "COMPLETED")],
    ["Cancelled", field.visits.filter((visit) => visit.status === "CANCELLED" || visit.status === "NO_ACCESS" || visit.status === "RESCHEDULED")],
  ] as const;

  return (
    <div className="space-y-5">
      {field.canManageTeam ? (
        <button type="button" className="min-h-11 rounded-sales-md bg-segmiq-lime px-4 text-[14px] font-semibold text-sales-text-primary" onClick={() => setOpen((value) => !value)}>
          {suggestAssessment ? "Schedule site assessment" : "Schedule visit"}
        </button>
      ) : null}
      {open ? (
        <form onSubmit={(event) => void schedule(event)} className="max-w-lg space-y-3 border-t border-sales-border pt-4">
          <label className="block text-[12px] font-medium">Visit type
            <select value={visitType} onChange={(event) => setVisitType(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]">
              {WORK_PROJECT_VISIT_TYPES.map((item) => <option key={item} value={item}>{workProjectVisitTypeLabel(item)}</option>)}
            </select>
          </label>
          <label className="block text-[12px] font-medium">Date and time
            <input required type="datetime-local" value={whenValue} onChange={(event) => setWhenValue(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]" />
          </label>
          <label className="block text-[12px] font-medium">Expected duration (minutes)
            <input type="number" min={15} max={1440} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]" />
          </label>
          <label className="block text-[12px] font-medium">Assigned staff
            <select required value={assignee} onChange={(event) => setAssignee(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]">
              <option value="">Choose</option>
              {field.members.map((member) => <option key={member.userId} value={member.userId}>{member.name || "Team member"} · {workProjectMemberRoleLabel(member.role)}</option>)}
            </select>
          </label>
          <label className="block text-[12px] font-medium">Site
            <input value={site} onChange={(event) => setSite(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]" />
          </label>
          <label className="block text-[12px] font-medium">Instructions
            <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} className="mt-1 w-full rounded-sales-md border border-sales-border px-3 py-2 text-[13px]" />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-[13px]">
            <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
            Notify customer on WhatsApp
          </label>
          {error ? <p className="text-[13px] text-sales-danger-fg">{error}</p> : null}
          <button type="submit" className="min-h-11 rounded-sales-md bg-segmiq-lime px-4 text-[14px] font-semibold text-sales-text-primary">Schedule visit</button>
        </form>
      ) : null}
      {notice ? <p className="text-[13px] text-sales-text-secondary">{notice}</p> : null}
      {groups.map(([label, rows]) => {
        if (!rows.length && label !== "Upcoming") return null;
        return (
        <section key={label}>
          <h3 className="text-[15px] font-semibold">{label}</h3>
          {rows.length === 0 ? <p className="mt-2 text-[15px] text-sales-text-secondary">No site visits scheduled.</p> : null}
          <ul className="mt-1 divide-y divide-sales-border-subtle">
            {rows.map((visit) => (
              <li key={visit.id} className="py-4">
                <p className="text-[16px] font-semibold">{workProjectVisitTypeLabel(visit.visitType)}</p>
                <p className="mt-1 text-[15px]">{when(visit.scheduledStartAt)}</p>
                <p className="text-[14px] text-sales-text-secondary">{visit.siteAddress || "Site not set"} · {visit.assigneeNames.join(", ") || "Unassigned"}</p>
                <p className="mt-1 text-[14px] text-sales-text-secondary">{workProjectVisitStatusLabel(visit.status)}{visit.overdue ? " · Overdue" : ""}</p>
                {visit.outcomeSummary ? <p className="mt-1 text-[15px]">{visit.outcomeSummary}</p> : null}
                {visit.visitType === "SITE_ASSESSMENT" ? (
                  <Link href={`${basePath}/${projectId}/visits/${visit.id}`} className="mt-2 inline-flex min-h-11 items-center text-[15px] font-semibold">
                    {visit.canEditAssessment ? "Open assessment" : "View assessment"}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        );
      })}
      <VisitCancel projectId={projectId} visits={field.visits} canManage={field.canManageTeam} />
      <VisitReschedule projectId={projectId} visits={field.visits} canManage={field.canManageTeam} />
    </div>
  );
}

function VisitReschedule({
  projectId,
  visits,
  canManage,
}: {
  projectId: string;
  visits: ProjectFieldSnapshot["visits"];
  canManage: boolean;
}) {
  const router = useRouter();
  const [visitId, setVisitId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [duration, setDuration] = useState(90);
  if (!canManage) return null;
  const open = visits.filter((visit) => visit.status === "SCHEDULED" || visit.status === "ON_SITE");
  if (!open.length) return null;
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        void fetch(`/api/work-projects/${projectId}/visits/${visitId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reschedule", startAt: new Date(startAt).toISOString(), durationMinutes: duration }),
        }).then(() => router.refresh());
      }}
    >
      <select value={visitId} onChange={(event) => setVisitId(event.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]">
        <option value="">Reschedule a visit</option>
        {open.map((visit) => <option key={visit.id} value={visit.id}>{workProjectVisitTypeLabel(visit.visitType)} · {when(visit.scheduledStartAt)}</option>)}
      </select>
      <input required type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]" />
      <input type="number" min={15} max={1440} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]" />
      <button type="submit" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold">Save new time</button>
    </form>
  );
}

function VisitCancel({
  projectId,
  visits,
  canManage,
}: {
  projectId: string;
  visits: ProjectFieldSnapshot["visits"];
  canManage: boolean;
}) {
  const router = useRouter();
  const [visitId, setVisitId] = useState("");
  const [reason, setReason] = useState("");
  if (!canManage) return null;
  const open = visits.filter((visit) => visit.status === "SCHEDULED" || visit.status === "ON_SITE");
  if (!open.length) return null;
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        void fetch(`/api/work-projects/${projectId}/visits/${visitId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "cancel", reason }),
        }).then(() => router.refresh());
      }}
    >
      <select value={visitId} onChange={(event) => setVisitId(event.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]">
        <option value="">Cancel a visit</option>
        {open.map((visit) => <option key={visit.id} value={visit.id}>{workProjectVisitTypeLabel(visit.visitType)} · {when(visit.scheduledStartAt)}</option>)}
      </select>
      <select value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]">
        <option value="">Reason</option>
        {VISIT_CANCEL_REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <button type="submit" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold">Cancel visit</button>
    </form>
  );
}

export function ProjectTeamPanel({
  projectId,
  field,
  owners,
}: {
  projectId: string;
  field: ProjectFieldSnapshot;
  owners: Array<{ id: string; name: string | null }>;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("ENGINEER");
  if (!field.canManageTeam && field.members.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-semibold">Project team</h2>
      <ul className="space-y-1 text-[13px]">
        {field.members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-2">
            <span>{member.name || "Team member"} · {workProjectMemberRoleLabel(member.role)}</span>
            {field.canManageTeam ? (
              <button
                type="button"
                className="min-h-11 px-2 text-[12px] font-semibold text-sales-text-secondary"
                onClick={() => {
                  void fetch(`/api/work-projects/${projectId}/members?userId=${member.userId}`, { method: "DELETE" }).then(() => router.refresh());
                }}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {field.canManageTeam ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void fetch(`/api/work-projects/${projectId}/members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, role }),
            }).then(() => router.refresh());
          }}
        >
          <select value={userId} onChange={(event) => setUserId(event.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]">
            <option value="">Add someone</option>
            {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name || "Team member"}</option>)}
          </select>
          <select value={role} onChange={(event) => setRole(event.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px]">
            {WORK_PROJECT_ASSIGNABLE_ROLES.map((item) => <option key={item} value={item}>{workProjectMemberRoleLabel(item)}</option>)}
          </select>
          <button type="submit" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold">Add</button>
        </form>
      ) : null}
    </section>
  );
}
