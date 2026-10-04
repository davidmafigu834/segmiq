"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { projectAttention } from "@/lib/work-projects/attention";
import {
  WORK_PROJECT_STATUSES,
  WORK_PROJECT_WORKFLOWS,
  nextOperationalStep,
  workProjectStatusLabel,
  workProjectWorkflowLabel,
  type WorkProjectStatus,
} from "@/lib/work-projects/constants";
import type { WorkProjectRow } from "@/lib/work-projects/service";

type ListItem = {
  project: WorkProjectRow;
  customerName: string | null;
  customerPhone: string | null;
  ownerName: string | null;
};

function money(value: number | null, currency: string) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${currency} ${Number(value).toLocaleString()}`;
  }
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = value.length <= 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ProjectListClient({
  initialItems,
  basePath,
  canCreate,
  owners,
  operations,
}: {
  initialItems: ListItem[];
  basePath: "/client/projects" | "/sales/projects";
  canCreate: boolean;
  owners: Array<{ id: string; name: string | null }>;
  operations?: {
    visitsToday: number;
    upcomingAssessments: number;
    overdueVisits: number;
    overdueTasks: number;
    projectsWithoutOwner: number;
    waitingAfterAssessment: number;
    awaitingDeposit?: number;
    partiallyPaid?: number;
    readyForEquipment?: number;
    missingStock?: number;
    fullyReserved?: number;
    outstandingTotal?: number;
    installationsToday?: number;
    installationsInProgress?: number;
    qaPending?: number;
    commissioningPending?: number;
    handoverPending?: number;
    readyToComplete?: number;
    installationsBlocked?: number;
    procurement?: Array<{ description: string; missing: number; projects: number }>;
  } | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  async function applyFilters(event?: React.FormEvent) {
    event?.preventDefault();
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (ownerId) params.set("ownerId", ownerId);
    if (workflow) params.set("workflow", workflow);
    if (q.trim()) params.set("q", q.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/work-projects?${params.toString()}`);
    const json = (await res.json().catch(() => ({}))) as { projects?: ListItem[] };
    if (res.ok) setItems(json.projects ?? []);
    setLoading(false);
  }

  const empty = items.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-[13px] text-sales-text-secondary">
          Delivery work after a deal is won. Project value is operational context and is not added to sales revenue.
        </p>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex min-h-11 items-center rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white"
          >
            New project
          </button>
        ) : null}
      </div>

      {operations ? (
        <dl className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Today's visits", operations.visitsToday],
            ["Upcoming assessments", operations.upcomingAssessments],
            ["Overdue visits", operations.overdueVisits],
            ["Overdue tasks", operations.overdueTasks],
            ["No owner", operations.projectsWithoutOwner],
            ["Waiting after assessment", operations.waitingAfterAssessment],
            ["Awaiting deposit", operations.awaitingDeposit ?? 0],
            ["Partially paid", operations.partiallyPaid ?? 0],
            ["Ready for equipment", operations.readyForEquipment ?? 0],
            ["Missing stock", operations.missingStock ?? 0],
            ["Fully reserved", operations.fullyReserved ?? 0],
            ["Installations today", operations.installationsToday ?? 0],
            ["Installations in progress", operations.installationsInProgress ?? 0],
            ["QA pending", operations.qaPending ?? 0],
            ["Commissioning pending", operations.commissioningPending ?? 0],
            ["Handover pending", operations.handoverPending ?? 0],
            ["Ready to complete", operations.readyToComplete ?? 0],
            ["Installation blocked", operations.installationsBlocked ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-sales-md border border-sales-border px-3 py-2">
              <dt className="text-[11px] text-sales-text-muted">{label}</dt>
              <dd className="text-[18px] font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {operations?.procurement?.length ? (
        <ul className="space-y-1 text-[13px] text-sales-text-secondary">
          {operations.procurement.slice(0, 6).map((row) => (
            <li key={row.description}>{row.missing} × {row.description} across {row.projects} project{row.projects === 1 ? "" : "s"}</li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={(e) => void applyFilters(e)} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search number, title, customer"
          className="min-h-11 rounded-sales-md border border-sales-border bg-sales-surface px-3 text-[13px] lg:col-span-2"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11 rounded-sales-md border border-sales-border bg-sales-surface px-3 text-[13px]">
          <option value="">All statuses</option>
          {WORK_PROJECT_STATUSES.map((item) => (
            <option key={item} value={item}>{workProjectStatusLabel(item)}</option>
          ))}
        </select>
        <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="min-h-11 rounded-sales-md border border-sales-border bg-sales-surface px-3 text-[13px]">
          <option value="">All owners</option>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>{owner.name || "Team member"}</option>
          ))}
        </select>
        <select value={workflow} onChange={(e) => setWorkflow(e.target.value)} className="min-h-11 rounded-sales-md border border-sales-border bg-sales-surface px-3 text-[13px]">
          <option value="">All workflows</option>
          {WORK_PROJECT_WORKFLOWS.map((item) => (
            <option key={item} value={item}>{workProjectWorkflowLabel(item)}</option>
          ))}
        </select>
        <button type="submit" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold">
          {loading ? "Loading…" : "Filter"}
        </button>
        <label className="text-[12px] text-sales-text-secondary">
          Target from
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border bg-sales-surface px-3 text-[13px]" />
        </label>
        <label className="text-[12px] text-sales-text-secondary">
          Target to
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border bg-sales-surface px-3 text-[13px]" />
        </label>
      </form>

      {empty ? (
        <div className="rounded-sales-lg border border-sales-border bg-sales-surface px-5 py-10">
          <p className="text-[15px] font-semibold text-sales-text-primary">No projects yet</p>
          <p className="mt-1 max-w-md text-[13px] text-sales-text-secondary">
            Mark a deal won, then create a project to track delivery. Historical won deals stay as they are until you create a project.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {items.map((item) => (
              <ProjectCard key={item.project.id} item={item} href={`${basePath}/${item.project.id}`} />
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wide text-sales-text-muted">
                <tr>
                  {["Project", "Customer", "Type", "Status", "Owner", "Value", "Start", "Target", "Updated"].map((label) => (
                    <th key={label} className="px-2 py-2 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const flags = projectAttention(item.project);
                  return (
                    <tr key={item.project.id} className="border-t border-sales-border-subtle">
                      <td className="px-2 py-3">
                        <Link href={`${basePath}/${item.project.id}`} className="font-semibold text-sales-text-primary hover:underline">
                          {item.project.title}
                        </Link>
                        <p className="text-[12px] text-sales-text-muted">{item.project.project_number}</p>
                      </td>
                      <td className="px-2 py-3">{item.customerName || "—"}</td>
                      <td className="px-2 py-3">{workProjectWorkflowLabel(item.project.workflow_key)}</td>
                      <td className="px-2 py-3">
                        {workProjectStatusLabel(item.project.status)}
                        {flags.overdue ? <span className="ml-2 text-[12px] font-semibold text-sales-danger-fg">Overdue</span> : null}
                        {flags.startOverdue ? <span className="ml-2 text-[12px] font-semibold text-sales-danger-fg">Start overdue</span> : null}
                      </td>
                      <td className="px-2 py-3">{item.ownerName || "—"}</td>
                      <td className="px-2 py-3 tabular-nums">{money(item.project.project_value, item.project.currency)}</td>
                      <td className="px-2 py-3">{dateLabel(item.project.planned_start_date || item.project.scheduled_start_at)}</td>
                      <td className="px-2 py-3">{dateLabel(item.project.target_completion_date)}</td>
                      <td className="px-2 py-3">{dateLabel(item.project.updated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {creating ? (
        <ManualProjectDialog
          owners={owners}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`${basePath}/${id}`)}
        />
      ) : null}
    </div>
  );
}

function ProjectCard({ item, href }: { item: ListItem; href: string }) {
  const flags = projectAttention(item.project);
  return (
    <Link href={href} className="block rounded-sales-lg border border-sales-border bg-sales-surface p-4">
      <p className="text-[12px] text-sales-text-muted">{item.project.project_number}</p>
      <p className="mt-1 text-[15px] font-semibold text-sales-text-primary">{item.project.title}</p>
      <p className="mt-1 text-[13px] text-sales-text-secondary">{item.customerName || "No customer"} · {workProjectStatusLabel(item.project.status)}</p>
      <p className="mt-2 text-[13px] text-sales-text-secondary">
        {money(item.project.project_value, item.project.currency)} · Target {dateLabel(item.project.target_completion_date)}
      </p>
      {flags.overdue ? <p className="mt-2 text-[12px] font-semibold text-sales-danger-fg">Overdue</p> : null}
      {flags.startOverdue ? <p className="mt-1 text-[12px] font-semibold text-sales-danger-fg">Start overdue</p> : null}
    </Link>
  );
}

function ManualProjectDialog({
  owners,
  onClose,
  onCreated,
}: {
  owners: Array<{ id: string; name: string | null }>;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [contacts, setContacts] = useState<Array<{ id: string; name: string | null; phone: string | null }>>([]);
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [workflowKey, setWorkflowKey] = useState<"GENERAL_TRADES" | "SOLAR_INSTALLATION">("GENERAL_TRADES");
  const [error, setError] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [saving, setSaving] = useState(false);
  const heading = useMemo(
    () => (workflowKey === "SOLAR_INSTALLATION" ? "Create solar project" : "Create project"),
    [workflowKey]
  );

  async function searchContacts() {
    const res = await fetch(`/api/work-projects/contacts?q=${encodeURIComponent(q)}`);
    const json = (await res.json().catch(() => ({}))) as { contacts?: typeof contacts; error?: string };
    if (!res.ok) {
      setError(json.error || "Could not search customers.");
      return;
    }
    setContacts(json.contacts ?? []);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/work-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId,
        title: title || (workflowKey === "SOLAR_INSTALLATION" ? "Solar installation" : "Project"),
        workflowKey,
        ownerId: ownerId || null,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { project?: { id: string }; error?: string };
    setSaving(false);
    if (!res.ok || !json.project) {
      setError(json.error || "Could not create the project.");
      return;
    }
    onCreated(json.project.id);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center">
      <form onSubmit={(e) => void submit(e)} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-sales-xl bg-sales-surface p-5 sm:rounded-sales-xl">
        <h2 className="text-[16px] font-semibold">{heading}</h2>
        <p className="mt-1 text-[13px] text-sales-text-secondary">A lead or deal is optional. Choose the customer this work is for.</p>
        <label className="mt-4 block text-[12px] font-medium">
          Workflow
          <select value={workflowKey} onChange={(e) => setWorkflowKey(e.target.value as typeof workflowKey)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]">
            {WORK_PROJECT_WORKFLOWS.map((item) => (
              <option key={item} value={item}>{workProjectWorkflowLabel(item)}</option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer name or phone" className="min-h-11 flex-1 rounded-sales-md border border-sales-border px-3 text-[13px]" />
          <button type="button" onClick={() => void searchContacts()} className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[13px] font-semibold">Search</button>
        </div>
        <div className="mt-2 space-y-1">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => {
                setContactId(contact.id);
                if (!title && contact.name) {
                  setTitle(workflowKey === "SOLAR_INSTALLATION" ? `${contact.name} — Solar Installation` : `${contact.name} — Project`);
                }
              }}
              className={`block min-h-11 w-full rounded-sales-md px-3 text-left text-[13px] ${contactId === contact.id ? "bg-sales-surface-hover font-semibold" : ""}`}
            >
              {contact.name || "Customer"} {contact.phone ? `· ${contact.phone}` : ""}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-[12px] font-medium">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]" />
        </label>
        <label className="mt-3 block text-[12px] font-medium">
          Owner
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]">
            <option value="">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.name || "Team member"}</option>
            ))}
          </select>
        </label>
        {error ? <p className="mt-3 text-[13px] text-sales-danger-fg">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-sales-md border border-sales-border text-[13px] font-semibold">Cancel</button>
          <button type="submit" disabled={!contactId || saving} className="min-h-11 flex-1 rounded-sales-md bg-sales-text-primary text-[13px] font-semibold text-white disabled:opacity-50">
            {saving ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function statusChoices(current: WorkProjectStatus, canManage: boolean): WorkProjectStatus[] {
  if ((current === "COMPLETED" || current === "CANCELLED") && !canManage) return [];
  return WORK_PROJECT_STATUSES.filter((status) => status !== current);
}

export { nextOperationalStep };
