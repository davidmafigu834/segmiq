"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge, Button } from "@/components/sales/ui";

export type OperationsTab = "milestones" | "documents" | "people" | "activities" | "commission";

type Person = { id: string; name: string; role: string };
type Milestone = {
  id: string;
  milestone_key: string;
  status: string;
  due_at: string | null;
  assigned_to_id: string | null;
  notes: string | null;
};
type Participant = {
  id: string;
  user_id: string | null;
  participant_role: string;
  responsibilities: string | null;
  started_at: string;
  ended_at: string | null;
  access_status: string;
  external_name: string | null;
};
type DocumentRow = {
  id: string;
  category: string;
  filename: string | null;
  review_status: string;
  visibility: string;
  uploaded_by: string | null;
  reviewed_by: string | null;
  rejection_reason?: string | null;
  notes: string | null;
  has_file?: boolean;
  created_at: string;
};
type Activity = { id: string; title: string; due_at: string | null; completed_at: string | null; assigned_to_id: string | null; priority: string };
type Operations = {
  permissions: {
    manageMilestones: boolean;
    reviewDocuments: boolean;
    addParticipants: boolean;
    uploadDocuments: boolean;
    viewCommission: boolean;
    manageCommission: boolean;
  };
  milestones: Milestone[];
  participants: Participant[];
  documents: DocumentRow[];
  documentsHidden: number;
  activities: Activity[];
  commission: { commissions: Array<Record<string, unknown>>; allocations: Array<Record<string, unknown>> } | null;
  names: Record<string, string>;
  team: Person[];
};

const DOCUMENT_TYPES = [
  ["sale_agreement", "Sale agreement"],
  ["lease_agreement", "Lease agreement"],
  ["identity", "Identity document"],
  ["title_deed", "Title deed"],
  ["deposit_receipt", "Deposit receipt"],
  ["proof_of_payment", "Proof of payment"],
  ["commission_invoice", "Commission invoice"],
  ["compliance", "Compliance document"],
  ["other", "Other"],
] as const;

const PARTICIPANT_ROLES = [
  "listing_agent",
  "buyer_agent",
  "sourcing_agent",
  "introducing_agent",
  "transaction_coordinator",
  "supervising_manager",
  "additional",
];

const MILESTONE_STATUSES = ["pending", "in_progress", "done", "skipped", "blocked"];

const selectClass = "min-h-10 w-full rounded-md border border-sales-border bg-sales-surface px-2 text-[13px]";

function human(value: string | null | undefined): string {
  return (value ?? "").replaceAll("_", " ");
}

function dateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function money(cents: unknown, currency = "USD"): string {
  return `${currency} ${(Number(cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function documentTone(status: string): "success" | "danger" | "warning" | "neutral" | "info" {
  if (status === "verified") return "success";
  if (status === "rejected") return "danger";
  if (status === "replacement_requested") return "warning";
  if (status === "under_review") return "info";
  return "neutral";
}

export function TransactionOperations({
  clientId,
  transactionId,
  tab,
  closed,
}: {
  clientId: string;
  transactionId: string;
  tab: OperationsTab;
  closed: boolean;
}) {
  const [data, setData] = useState<Operations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/agency?view=transaction&transactionId=${transactionId}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not load transaction operations.");
      setData(null);
      return;
    }
    setError(null);
    setData(json as Operations);
  }, [clientId, transactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setNotice(null);
    const res = await fetch(`/api/clients/${clientId}/agency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not save the change.");
      return false;
    }
    setError(null);
    setNotice(success);
    await load();
    return true;
  }

  if (!data) {
    return error ? <p className="text-[12px] text-sales-danger-fg">{error}</p> : <p className="text-[13px] text-sales-text-muted">Loading…</p>;
  }

  const name = (id: string | null | undefined) => (id ? data.names[id] ?? data.team.find((p) => p.id === id)?.name ?? "Team member" : "Unassigned");

  return (
    <div className="space-y-3">
      {error ? <p className="text-[12px] text-sales-danger-fg" role="alert">{error}</p> : null}
      {notice ? <p className="text-[12px] text-sales-text-secondary" role="status">{notice}</p> : null}
      {tab === "milestones" ? (
        <MilestonesTab data={data} closed={closed} busy={busy} name={name} act={act} />
      ) : tab === "documents" ? (
        <DocumentsTab clientId={clientId} transactionId={transactionId} data={data} busy={busy} name={name} act={act} reload={load} setError={setError} setNotice={setNotice} />
      ) : tab === "people" ? (
        <PeopleTab transactionId={transactionId} data={data} busy={busy} name={name} act={act} />
      ) : tab === "activities" ? (
        <ActivitiesTab data={data} name={name} />
      ) : (
        <CommissionTab data={data} name={name} />
      )}
    </div>
  );
}

type ActFn = (body: Record<string, unknown>, success: string) => Promise<boolean>;
type NameFn = (id: string | null | undefined) => string;

function MilestonesTab({ data, closed, busy, name, act }: { data: Operations; closed: boolean; busy: boolean; name: NameFn; act: ActFn }) {
  const manage = data.permissions.manageMilestones && !closed;
  if (data.milestones.length === 0) return <p className="text-[12px] text-sales-text-muted">No milestones on this transaction.</p>;
  return (
    <ul className="space-y-2">
      {data.milestones.map((milestone) => (
        <li key={milestone.id} className="space-y-1.5 rounded-[10px] border border-sales-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium capitalize text-sales-text-primary">{human(milestone.milestone_key)}</p>
            <Badge tone={milestone.status === "done" ? "success" : milestone.status === "blocked" ? "danger" : "neutral"} appearance="soft" size="sm">
              {human(milestone.status)}
            </Badge>
          </div>
          {manage ? (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              <select
                aria-label="Assigned to"
                className={selectClass}
                disabled={busy}
                value={milestone.assigned_to_id ?? ""}
                onChange={(event) => void act({ action: "assign_milestone", milestoneId: milestone.id, assignedToId: event.target.value || null }, "Milestone assignment saved.")}
              >
                <option value="">Unassigned</option>
                {data.team.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
              <input
                aria-label="Due date"
                type="date"
                className={selectClass}
                disabled={busy}
                defaultValue={dateInput(milestone.due_at)}
                onBlur={(event) => {
                  const value = event.target.value;
                  if (value === dateInput(milestone.due_at)) return;
                  void act(
                    { action: "assign_milestone", milestoneId: milestone.id, dueAt: value ? new Date(`${value}T12:00:00Z`).toISOString() : null },
                    "Due date saved."
                  );
                }}
              />
              <select
                aria-label="Status"
                className={selectClass}
                disabled={busy}
                value={milestone.status}
                onChange={(event) => void act({ action: "assign_milestone", milestoneId: milestone.id, status: event.target.value }, "Milestone status saved.")}
              >
                {MILESTONE_STATUSES.map((status) => <option key={status} value={status}>{human(status)}</option>)}
              </select>
            </div>
          ) : (
            <p className="text-[12px] text-sales-text-muted">
              {name(milestone.assigned_to_id)}
              {milestone.due_at ? ` · due ${new Date(milestone.due_at).toLocaleDateString()}` : ""}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function DocumentsTab({
  clientId,
  transactionId,
  data,
  busy,
  name,
  act,
  reload,
  setError,
  setNotice,
}: {
  clientId: string;
  transactionId: string;
  data: Operations;
  busy: boolean;
  name: NameFn;
  act: ActFn;
  reload: () => Promise<void>;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("sale_agreement");
  const [visibility, setVisibility] = useState("");
  const [replaces, setReplaces] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("category", category);
    if (visibility) form.append("visibility", visibility);
    if (replaces) form.append("replacesDocumentLinkId", replaces);
    const res = await fetch(`/api/clients/${clientId}/transactions/${transactionId}/documents`, { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(json.error ?? "Upload failed.");
      return;
    }
    setError(null);
    setNotice("Uploaded. It now awaits review; an upload is not verification.");
    setFile(null);
    setReplaces(null);
    await reload();
  }

  async function open(documentLinkId: string) {
    const res = await fetch(`/api/clients/${clientId}/transactions/${transactionId}/documents?documentLinkId=${documentLinkId}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not open the document.");
      return;
    }
    window.open(json.url as string, "_blank", "noopener,noreferrer");
  }

  const review = data.permissions.reviewDocuments;
  return (
    <div className="space-y-3">
      <form className="space-y-2 rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3" onSubmit={(event) => void upload(event)}>
        <p className="text-[12px] font-semibold">{replaces ? "Upload a replacement" : "Add a document"}</p>
        <input aria-label="File" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx" className="block w-full text-[12px]" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <select aria-label="Document type" className={selectClass} value={category} onChange={(event) => setCategory(event.target.value)}>
            {DOCUMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Who can see it" className={selectClass} value={visibility} onChange={(event) => setVisibility(event.target.value)}>
            <option value="">Default visibility</option>
            <option value="participants">Deal participants</option>
            <option value="managers">Managers and reviewers</option>
            <option value="finance">Finance only</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant="primary" disabled={!file || uploading}>{uploading ? "Uploading…" : "Upload"}</Button>
          {replaces ? <Button type="button" size="sm" variant="ghost" onClick={() => setReplaces(null)}>Cancel replacement</Button> : null}
        </div>
        <p className="text-[11px] text-sales-text-muted">PDF, image or Word file up to 4 MB. Uploaded files await review. A payment screenshot is not proof of payment.</p>
      </form>

      {data.documentsHidden > 0 ? (
        <p className="text-[11px] text-sales-text-muted">{data.documentsHidden} restricted documents are not shown to you.</p>
      ) : null}
      {data.documents.length === 0 ? <p className="text-[12px] text-sales-text-muted">No documents yet.</p> : null}
      <ul className="space-y-2">
        {data.documents.map((doc) => {
          const reason = reasons[doc.id] ?? "";
          const decided = doc.review_status === "verified";
          return (
            <li key={doc.id} className="space-y-1.5 rounded-[10px] border border-sales-border p-2.5 text-[12px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-sales-text-primary">{human(doc.category)}{doc.filename ? ` · ${doc.filename}` : ""}</p>
                <Badge tone={documentTone(doc.review_status)} appearance="soft" size="sm">{human(doc.review_status)}</Badge>
              </div>
              <p className="text-sales-text-muted">
                Uploaded by {name(doc.uploaded_by)} · {new Date(doc.created_at).toLocaleDateString()} · {human(doc.visibility)}
                {doc.reviewed_by ? ` · reviewed by ${name(doc.reviewed_by)}` : ""}
              </p>
              {doc.rejection_reason ? <p className="text-sales-danger-fg">{doc.rejection_reason}</p> : null}
              <div className="flex flex-wrap gap-1.5">
                {doc.has_file ? <Button type="button" size="sm" variant="secondary" onClick={() => void open(doc.id)}>View</Button> : null}
                {doc.review_status === "replacement_requested" || doc.review_status === "rejected" ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => { setReplaces(doc.id); setCategory(doc.category); }}>Upload replacement</Button>
                ) : null}
              </div>
              {review && !decided ? (
                <div className="space-y-1.5">
                  <input
                    aria-label="Reason"
                    className={selectClass}
                    placeholder="Reason (required to reject or request a replacement)"
                    value={reason}
                    onChange={(event) => setReasons({ ...reasons, [doc.id]: event.target.value })}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {doc.review_status !== "under_review" ? (
                      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void act({ action: "review_document", documentLinkId: doc.id, decision: "under_review" }, "Marked under review.")}>Under review</Button>
                    ) : null}
                    <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => void act({ action: "review_document", documentLinkId: doc.id, decision: "verified", notes: reason || null }, "Document verified.")}>Verify</Button>
                    <Button type="button" size="sm" variant="secondary" disabled={busy || !reason.trim()} onClick={() => void act({ action: "review_document", documentLinkId: doc.id, decision: "replacement_requested", reason }, "Replacement requested.")}>Request replacement</Button>
                    <Button type="button" size="sm" variant="danger" disabled={busy || !reason.trim()} onClick={() => void act({ action: "review_document", documentLinkId: doc.id, decision: "rejected", reason }, "Document rejected.")}>Reject</Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PeopleTab({ transactionId, data, busy, name, act }: { transactionId: string; data: Operations; busy: boolean; name: NameFn; act: ActFn }) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("transaction_coordinator");
  const [responsibilities, setResponsibilities] = useState("");
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {data.participants.length === 0 ? <li className="text-[12px] text-sales-text-muted">No additional participants. The listing and buyer agents always have access.</li> : null}
        {data.participants.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-sales-border px-2.5 py-2 text-[12px]">
            <span>
              <span className="font-medium text-sales-text-primary">{row.external_name ?? name(row.user_id)}</span> · {human(row.participant_role)}
              {row.responsibilities ? ` · ${row.responsibilities}` : ""}
              {row.ended_at ? ` · ended ${new Date(row.ended_at).toLocaleDateString()}` : ""}
            </span>
            {data.permissions.addParticipants && !row.ended_at ? (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void act({ action: "end_participant", participantId: row.id }, "Participation ended.")}>End</Button>
            ) : null}
          </li>
        ))}
      </ul>
      {data.permissions.addParticipants ? (
        <form
          className="space-y-1.5 rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void act({ action: "participant", transactionId, userId, role, responsibilities: responsibilities || null }, "Participant added.").then((ok) => {
              if (ok) {
                setUserId("");
                setResponsibilities("");
              }
            });
          }}
        >
          <p className="text-[12px] font-semibold">Add a participant</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <select aria-label="Team member" required className={selectClass} value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">Choose a team member</option>
              {data.team.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            <select aria-label="Role" className={selectClass} value={role} onChange={(event) => setRole(event.target.value)}>
              {PARTICIPANT_ROLES.map((item) => <option key={item} value={item}>{human(item)}</option>)}
            </select>
          </div>
          <input aria-label="Responsibilities" className={selectClass} placeholder="Responsibilities (optional)" value={responsibilities} onChange={(event) => setResponsibilities(event.target.value)} />
          <Button type="submit" size="sm" variant="primary" disabled={busy || !userId}>Add</Button>
          <p className="text-[11px] text-sales-text-muted">Participants see the deal according to their role. WhatsApp conversations are never shared.</p>
        </form>
      ) : null}
    </div>
  );
}

function ActivitiesTab({ data, name }: { data: Operations; name: NameFn }) {
  if (data.activities.length === 0) return <p className="text-[12px] text-sales-text-muted">No activities linked to this transaction.</p>;
  return (
    <ul className="space-y-1.5">
      {data.activities.map((activity) => (
        <li key={activity.id} className="rounded-[10px] border border-sales-border px-2.5 py-2 text-[12px]">
          <p className={activity.completed_at ? "text-sales-text-secondary line-through" : "font-medium text-sales-text-primary"}>{activity.title}</p>
          <p className="text-sales-text-muted">
            {name(activity.assigned_to_id)}
            {activity.due_at ? ` · due ${new Date(activity.due_at).toLocaleDateString()}` : ""} · {activity.priority}
          </p>
        </li>
      ))}
    </ul>
  );
}

function CommissionTab({ data, name }: { data: Operations; name: NameFn }) {
  if (!data.commission) return <p className="text-[12px] text-sales-text-muted">Commission details are visible to finance and to the people being paid.</p>;
  const { commissions, allocations } = data.commission;
  if (commissions.length === 0) return <p className="text-[12px] text-sales-text-muted">No commission has been projected for this transaction yet.</p>;
  return (
    <ul className="space-y-2">
      {commissions.map((row) => {
        const currency = String(row.currency ?? "USD");
        const lines = allocations.filter((line) => line.commission_id === row.id && line.approval_status !== "superseded");
        const legacy = row.provenance === "legacy_transaction_fields" || row.status === "unverified_legacy";
        return (
          <li key={String(row.id)} className="space-y-1 rounded-[10px] border border-sales-border p-2.5 text-[12px]">
            <p className="font-medium text-sales-text-primary">
              {row.grossCents != null ? money(row.grossCents, currency) : "Your allocation"} · {human(String(row.status ?? ""))}
            </p>
            {legacy ? <p className="text-amber-800">Copied from an older record. Not verified.</p> : null}
            {row.verifiedReceivedCents != null ? (
              <p className="text-sales-text-muted">Verified received {money(row.verifiedReceivedCents, currency)}</p>
            ) : null}
            <ul>
              {lines.map((line) => (
                <li key={String(line.id)}>
                  {name(line.beneficiary_id as string | null)} · {human(String(line.participant_role))} · {money(line.amount_cents, currency)} · {human(String(line.approval_status))} · paid {money(line.payout_cents, currency)}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
