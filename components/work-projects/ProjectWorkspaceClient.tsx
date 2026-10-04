"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EntityDocumentsPanel } from "@/components/dashboard/company/documents/EntityDocumentsPanel";
import { PortalAccessPanel } from "@/components/portal/PortalAccessPanel";
import { AskSegmiq } from "@/components/intelligence/AskSegmiq";
import { ProjectCommercialSummary, ProjectEquipmentPanel, ProjectPaymentsPanel } from "@/components/work-projects/ProjectCommercialPanels";
import { ProjectAssetsPanel, ProjectInstallationPanel } from "@/components/work-projects/ProjectInstallationPanels";
import type { InstallationSnapshot } from "@/lib/work-projects/installation-service";
import { ProjectFieldSummary, ProjectTasksPanel, ProjectTeamPanel, ProjectVisitsPanel } from "@/components/work-projects/ProjectFieldPanels";
import type { ProjectCommercialSnapshot } from "@/lib/work-projects/commercial-service";
import type { ProjectFieldSnapshot } from "@/lib/work-projects/field-service";
import { projectAttention } from "@/lib/work-projects/attention";
import {
  WORK_PROJECT_PRIORITIES,
  WORK_PROJECT_STATUSES,
  WORK_PROJECT_WORKFLOWS,
  WORK_PROJECT_EVENT_LABEL,
  nextOperationalStep,
  workProjectPriorityLabel,
  workProjectStatusLabel,
  workProjectWorkflowLabel,
  type WorkProjectEventType,
  type WorkProjectStatus,
  isWorkProjectStatus,
} from "@/lib/work-projects/constants";
import { canTransitionWorkProjectStatus } from "@/lib/work-projects/constants";
import type { WorkProjectRow } from "@/lib/work-projects/service";

type Workspace = {
  project: WorkProjectRow;
  contact: { id: string; name: string | null; phone: string | null; email: string | null; location: string | null; notes: string | null } | null;
  ownerName: string | null;
  lead: { id: string; name: string | null; source: string | null; project_type: string | null; customer_need: string | null } | null;
  deal: { id: string; name: string; stage: string; won_value: number | null; won_at: string | null; service_summary: string | null } | null;
  quotation: {
    id: string;
    quote_number: string | null;
    status: string;
    total: number | null;
    currency: string | null;
    accepted_at: string | null;
    revision_number: number | null;
  } | null;
  solar: {
    systemSize: string | null;
    siteAddress: string | null;
    propertyType: string | null;
    roofType: string | null;
    orientation: string | null;
    shade: string | null;
    warranty: string | null;
  } | null;
  salespersonName: string | null;
  events: Array<{
    id: string;
    event_type: string;
    title: string;
    description: string | null;
    actorName: string | null;
    created_at: string;
  }>;
};

function money(value: number | null | undefined, currency: string | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${currency || ""} ${Number(value).toLocaleString()}`;
  }
}

function when(value: string | null | undefined) {
  if (!value) return "—";
  const date = value.length <= 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: value.length <= 10 ? undefined : "2-digit", minute: value.length <= 10 ? undefined : "2-digit" });
}

const TABS = ["Overview", "Tasks", "Visits", "Payments", "Equipment", "Installation", "Assets", "Activity", "Documents", "Sales context"] as const;

export function ProjectWorkspaceClient({
  workspace,
  basePath,
  salesBase,
  canManage,
  documentsEnabled,
  clientId,
  owners,
  field,
  commercial,
  installation,
  initialTab = "Overview",
}: {
  workspace: Workspace;
  basePath: "/client/projects" | "/sales/projects";
  salesBase: "sales" | "client";
  canManage: boolean;
  documentsEnabled: boolean;
  clientId: string;
  owners: Array<{ id: string; name: string | null }>;
  field: ProjectFieldSnapshot;
  commercial: ProjectCommercialSnapshot;
  installation: InstallationSnapshot;
  initialTab?: (typeof TABS)[number];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>(initialTab);
  const [project, setProject] = useState(workspace.project);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const flags = projectAttention(project);
  const site = [project.site_name, project.site_address, project.site_city].filter(Boolean).join(", ");
  const customer = workspace.contact?.name || "Customer";

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/work-projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { project?: WorkProjectRow; error?: string };
    setBusy(false);
    if (!res.ok || !json.project) {
      setError(json.error || "Could not save.");
      return;
    }
    setProject(json.project);
    router.refresh();
  }

  async function changeStatus(status: WorkProjectStatus) {
    if (status === "CANCELLED" && !reason.trim()) {
      setError("A cancellation reason is required.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch(`/api/work-projects/${project.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason: status === "CANCELLED" ? reason.trim() : null }),
    });
    const json = (await res.json().catch(() => ({}))) as { project?: WorkProjectRow; error?: string };
    setBusy(false);
    if (!res.ok || !json.project) {
      setError(json.error || "Could not change status.");
      return;
    }
    setProject(json.project);
    setReason("");
    router.refresh();
  }

  async function saveNote() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/work-projects/${project.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: note }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not save the note.");
      return;
    }
    setNote("");
    router.refresh();
  }

  const quoteHref = workspace.quotation
    ? salesBase === "sales"
      ? `/sales/quotes/${workspace.quotation.id}`
      : `/client/quotations?quotation=${workspace.quotation.id}`
    : null;
  const dealHref = workspace.deal
    ? salesBase === "sales"
      ? `/sales/deals/${workspace.deal.id}`
      : `/client/deals/${workspace.deal.id}`
    : null;
  const leadHref = workspace.lead
    ? salesBase === "sales"
      ? `/sales/leads?lead=${workspace.lead.id}`
      : `/client/leads?lead=${workspace.lead.id}`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={basePath} className="text-[13px] font-medium text-sales-text-secondary hover:text-sales-text-primary">
          Projects
        </Link>
        <p className="mt-3 text-[12px] font-medium tracking-wide text-sales-text-muted">{project.project_number}</p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight text-sales-text-primary">{project.title}</h1>
        <p className="mt-2 text-[14px] text-sales-text-secondary">
          {workProjectStatusLabel(project.status)}
          {flags.overdue ? " · Overdue" : ""}
          {flags.startOverdue ? " · Start overdue" : ""}
          {installation.attention[0] ? ` · ${installation.attention[0]}` : ""}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Customer" value={customer} />
        <Fact label="Site" value={site || "Not set"} />
        <Fact label="Value" value={money(project.project_value, project.currency)} />
        <Fact label="Owner" value={workspace.ownerName || "Unassigned"} />
        <Fact label="Target completion" value={when(project.target_completion_date)} />
        <Fact label="Workflow" value={workProjectWorkflowLabel(project.workflow_key)} />
      </dl>

      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold ${tab === item ? "bg-sales-text-primary text-white" : "bg-sales-surface text-sales-text-secondary"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {error ? <p className="text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}

      {tab === "Overview" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
          <section className="space-y-5">
            <ProjectCommercialSummary commercial={commercial} />
            <ProjectFieldSummary field={field} projectStatus={project.status} basePath={basePath} projectId={project.id} />
            <ProjectTeamPanel projectId={project.id} field={field} owners={owners} />
            <div>
              <h2 className="text-[15px] font-semibold">Current status</h2>
              <p className="mt-1 text-[18px] font-semibold">{workProjectStatusLabel(project.status)}</p>
              <p className="mt-2 text-[14px] text-sales-text-secondary">{nextOperationalStep(project.status, project.next_step)}</p>
            </div>
            {project.workflow_key === "SOLAR_INSTALLATION" ? (
              <SolarSummary
                service={project.project_type || workspace.deal?.service_summary || null}
                quotation={workspace.quotation}
                value={money(project.project_value, project.currency)}
                site={site || workspace.solar?.siteAddress || "Not set"}
                customer={customer}
                status={workProjectStatusLabel(project.status)}
                target={when(project.target_completion_date)}
                solar={workspace.solar}
              />
            ) : null}
            <label className="block text-[12px] font-medium">
              Customer requirements
              <textarea
                defaultValue={project.customer_requirements ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (project.customer_requirements ?? "")) {
                    void patch({ customerRequirements: e.target.value });
                  }
                }}
                rows={4}
                className="mt-1 w-full rounded-sales-md border border-sales-border px-3 py-2 text-[13px]"
              />
            </label>
            <label className="block text-[12px] font-medium">
              Internal notes
              <textarea
                defaultValue={project.internal_notes ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (project.internal_notes ?? "")) void patch({ internalNotes: e.target.value });
                }}
                rows={3}
                className="mt-1 w-full rounded-sales-md border border-sales-border px-3 py-2 text-[13px]"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <DateField label="Planned start" type="date" value={project.planned_start_date} onSave={(value) => void patch({ plannedStartDate: value || null })} />
              <DateField label="Scheduled start" type="datetime-local" value={toLocalInput(project.scheduled_start_at)} onSave={(value) => void patch({ scheduledStartAt: value ? new Date(value).toISOString() : null })} />
              <DateField label="Target completion" type="date" value={project.target_completion_date} onSave={(value) => void patch({ targetCompletionDate: value || null })} />
              <Fact label="Actual start" value={when(project.actual_start_at)} />
              <Fact label="Completed" value={when(project.actual_completion_at || project.completed_at)} />
            </div>
          </section>
          <aside className="space-y-4">
            <label className="block text-[12px] font-medium">
              Status
              <select
                value={project.status}
                disabled={busy}
                onChange={(e) => {
                  if (isWorkProjectStatus(e.target.value)) void changeStatus(e.target.value);
                }}
                className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]"
              >
                {WORK_PROJECT_STATUSES.filter((status) =>
                  status === project.status ||
                  canTransitionWorkProjectStatus(project.status, status, { allowReopen: canManage })
                ).map((status) => (
                  <option key={status} value={status}>{workProjectStatusLabel(status)}</option>
                ))}
              </select>
            </label>
            {canManage ? <PortalAccessPanel projectId={project.id} contactId={project.contact_id} /> : null}
            <AskSegmiq projectId={project.id} />
            {canManage ? (
              <label className="block text-[12px] font-medium">
                Cancellation reason
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]" placeholder="Required to cancel" />
              </label>
            ) : null}
            <label className="block text-[12px] font-medium">
              Priority
              <select
                value={project.priority}
                onChange={(e) => void patch({ priority: e.target.value })}
                className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]"
              >
                {WORK_PROJECT_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{workProjectPriorityLabel(priority)}</option>
                ))}
              </select>
            </label>
            <label className="block text-[12px] font-medium">
              Workflow
              <select
                value={project.workflow_key}
                onChange={(e) => void patch({ workflowKey: e.target.value })}
                className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]"
              >
                {WORK_PROJECT_WORKFLOWS.map((workflow) => (
                  <option key={workflow} value={workflow}>{workProjectWorkflowLabel(workflow)}</option>
                ))}
              </select>
            </label>
            {canManage ? (
              <label className="block text-[12px] font-medium">
                Owner
                <select
                  value={project.project_owner_id ?? ""}
                  onChange={(e) => void patch({ ownerId: e.target.value || null })}
                  className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]"
                >
                  <option value="">Unassigned</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>{owner.name || "Team member"}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block text-[12px] font-medium">
              Next step
              <textarea
                defaultValue={project.next_step ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (project.next_step ?? "")) void patch({ nextStep: e.target.value });
                }}
                rows={3}
                className="mt-1 w-full rounded-sales-md border border-sales-border px-3 py-2 text-[13px]"
              />
            </label>
            <div>
              <label className="block text-[12px] font-medium">Add a note</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-sales-md border border-sales-border px-3 py-2 text-[13px]" />
              <button type="button" disabled={busy || !note.trim()} onClick={() => void saveNote()} className="mt-2 min-h-11 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white disabled:opacity-50">
                Save note
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "Tasks" ? <ProjectTasksPanel projectId={project.id} field={field} members={field.members} /> : null}
      {tab === "Visits" ? (
        <ProjectVisitsPanel
          projectId={project.id}
          field={field}
          basePath={basePath}
          defaultSite={project.site_address}
          suggestAssessment={project.status === "SITE_ASSESSMENT" || project.workflow_key === "SOLAR_INSTALLATION"}
        />
      ) : null}
      {tab === "Payments" ? (
        <ProjectPaymentsPanel projectId={project.id} clientId={clientId} commercial={commercial} documentsEnabled={documentsEnabled} />
      ) : null}
      {tab === "Equipment" ? <ProjectEquipmentPanel projectId={project.id} commercial={commercial} /> : null}
      {tab === "Installation" ? (
        <ProjectInstallationPanel
          projectId={project.id}
          clientId={clientId}
          workflow={project.workflow_key}
          installation={installation}
          members={field.members}
          locations={commercial.locations}
          canManage={canManage}
          documentsEnabled={documentsEnabled}
        />
      ) : null}
      {tab === "Assets" ? <ProjectAssetsPanel projectId={project.id} installation={installation} canManage={canManage} /> : null}

      {tab === "Activity" ? (
        <ol className="space-y-4">
          {workspace.events.length === 0 ? <p className="text-[13px] text-sales-text-secondary">No activity yet.</p> : null}
          {workspace.events.map((event) => (
            <li key={event.id} className="border-b border-sales-border-subtle pb-3">
              <p className="text-[13px] font-semibold">{WORK_PROJECT_EVENT_LABEL[event.event_type as WorkProjectEventType] ?? event.title}</p>
              {event.description ? <p className="mt-1 text-[13px] text-sales-text-secondary">{event.description}</p> : null}
              <p className="mt-1 text-[12px] text-sales-text-muted">
                {event.actorName || "SegmiQ"} · {when(event.created_at)}
              </p>
            </li>
          ))}
        </ol>
      ) : null}

      {tab === "Documents" ? (
        documentsEnabled ? (
          <EntityDocumentsPanel clientId={clientId} entityType="WORK_PROJECT" entityId={project.id} entityLabel={project.project_number} />
        ) : (
          <p className="text-[13px] text-sales-text-secondary">Documents are not enabled for this company.</p>
        )
      ) : null}

      {tab === "Sales context" ? (
        <div className="space-y-3 text-[14px]">
          <ContextRow label="Original lead" value={workspace.lead?.name || "—"} href={leadHref} />
          <ContextRow label="Lead source" value={workspace.lead?.source?.replace(/_/g, " ") || "—"} />
          <ContextRow label="Salesperson" value={workspace.salespersonName || "—"} />
          <ContextRow label="Deal" value={workspace.deal?.name || "—"} href={dealHref} />
          <ContextRow label="Deal won value" value={workspace.deal ? money(workspace.deal.won_value, project.currency) : "—"} />
          <ContextRow
            label={workspace.quotation?.status === "accepted" ? "Accepted quotation" : "Quotation"}
            value={
              workspace.quotation
                ? `${workspace.quotation.quote_number || "Quotation"} · ${money(workspace.quotation.total, workspace.quotation.currency)} · ${workspace.quotation.status}${workspace.quotation.revision_number != null ? ` · rev ${workspace.quotation.revision_number}` : ""}`
                : "No quotation linked"
            }
            href={quoteHref}
          />
          {workspace.quotation?.accepted_at ? <ContextRow label="Accepted" value={when(workspace.quotation.accepted_at)} /> : null}
          {quoteHref && workspace.quotation ? (
            <a className="inline-flex min-h-11 items-center text-[13px] font-semibold underline" href={`/api/quotations/${workspace.quotation.id}/pdf`}>
              Download PDF
            </a>
          ) : null}
          <ContextRow label="Customer requirement" value={workspace.lead?.customer_need || project.customer_requirements || "—"} />
          <ContextRow label="Sales notes" value={workspace.contact?.notes || workspace.deal?.service_summary || "—"} />
        </div>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-sales-text-muted">{label}</dt>
      <dd className="mt-0.5 text-[14px] font-medium text-sales-text-primary">{value}</dd>
    </div>
  );
}

function DateField({
  label,
  type,
  value,
  onSave,
}: {
  label: string;
  type: "date" | "datetime-local";
  value: string | null;
  onSave: (value: string) => void;
}) {
  return (
    <label className="block text-[12px] font-medium">
      {label}
      <input
        type={type}
        defaultValue={value ?? ""}
        onBlur={(e) => onSave(e.target.value)}
        className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]"
      />
    </label>
  );
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ContextRow({ label, value, href }: { label: string; value: string; href?: string | null }) {
  return (
    <p>
      <span className="text-sales-text-muted">{label}. </span>
      {href ? <Link href={href} className="font-medium underline">{value}</Link> : <span>{value}</span>}
    </p>
  );
}

function SolarSummary(props: {
  service: string | null;
  quotation: Workspace["quotation"];
  value: string;
  site: string;
  customer: string;
  status: string;
  target: string;
  solar: Workspace["solar"];
}) {
  const rows = [
    ["System / service", props.service || props.solar?.systemSize || "—"],
    ["Quotation", props.quotation ? `${props.quotation.quote_number || "Quotation"} · ${props.quotation.status}` : "—"],
    ["Project value", props.value],
    ["Site", props.site],
    ["Customer", props.customer],
    ["Current stage", props.status],
    ["Target completion", props.target],
    ["System size", props.solar?.systemSize || "—"],
    ["Property", props.solar?.propertyType || "—"],
    ["Roof", props.solar?.roofType || "—"],
    ["Orientation", props.solar?.orientation || "—"],
    ["Shade", props.solar?.shade || "—"],
    ["Warranty", props.solar?.warranty || "—"],
  ].filter((row) => row[1] && row[1] !== "—");
  return (
    <section>
      <h2 className="text-[15px] font-semibold">Solar installation</h2>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[12px] text-sales-text-muted">{label}</dt>
            <dd className="text-[13px]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
