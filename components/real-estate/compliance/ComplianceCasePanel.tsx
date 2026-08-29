"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, TextArea } from "@/components/sales/ui";
import { COMPLIANCE_RISK_LABEL } from "@/lib/real-estate/compliance";

type Detail = {
  canCollect: boolean;
  canReview: boolean;
  seeInternal: boolean;
  completeness: {
    completed: number;
    required: number;
    readyForReview: boolean;
    items: Array<{ id: string; label: string; met: boolean }>;
  };
  nextUpload: { type: string; label: string } | null;
  case: Record<string, unknown>;
  contact: { id: string; name?: string | null } | null;
  listingLabel: string | null;
  offer: { current_offer_amount?: number; currency?: string } | null;
  documents: Array<{
    id: string;
    documentType: string;
    label: string;
    status: string;
    required: boolean;
    originalFilename: string | null;
    uploadedAt: string | null;
    uploadedByName: string | null;
    hasFile: boolean;
    reviewNotes: string | null;
  }>;
  parties: Array<{
    id: string;
    full_name: string;
    relationship_type: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    summary: string | null;
    createdAt: string;
    createdByName: string | null;
    before: string | null;
    after: string | null;
  }>;
  priorApproved: Array<{ id: string; approvedAt: string | null }>;
};

function StatusPill({ status, label }: { status: string; label: string }) {
  const tone =
    status === "approved"
      ? "success"
      : status === "restricted" || status === "rejected"
        ? "danger"
        : status === "edd_required" || status === "more_information_required"
          ? "warning"
          : status === "ready_for_review" || status === "under_review"
            ? "brand"
            : "neutral";
  return (
    <Badge tone={tone} appearance="soft">
      {label}
    </Badge>
  );
}

export function ComplianceCasePanel({
  clientId,
  caseId,
  onClose,
  onChanged,
}: {
  clientId: string;
  caseId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [section, setSection] = useState<"overview" | "cdd" | "documents" | "risk" | "review" | "activity">(
    "overview"
  );
  const [reason, setReason] = useState("");
  const [risk, setRisk] = useState("low");
  const [partyName, setPartyName] = useState("");
  const [partyType, setPartyType] = useState("director");
  const [confirmApprove, setConfirmApprove] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/compliance/cases/${caseId}`);
    const j = (await res.json()) as Detail & { error?: string };
    if (!res.ok) {
      setError(j.error ?? "Could not load case.");
      return;
    }
    setData(j);
    setError(null);
  }, [clientId, caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/compliance/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast(j.error ?? "Update failed.");
        return;
      }
      setReason("");
      setConfirmApprove(false);
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function upload(docId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/compliance/cases/${caseId}/documents/${docId}`,
        { method: "POST", body: form }
      );
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setToast(res.ok ? "Document received." : j.error ?? "Upload failed.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function openFile(docId: string) {
    const res = await fetch(`/api/clients/${clientId}/compliance/cases/${caseId}/documents/${docId}`);
    const j = (await res.json()) as { url?: string; error?: string };
    if (j.url) window.open(j.url, "_blank", "noopener");
    else setToast(j.error ?? "Could not open file.");
  }

  const c = data?.case;
  const status = String(c?.status ?? "");

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-sales-bg sm:items-end">
      <button type="button" className="absolute inset-0 bg-[var(--sales-overlay)]" aria-label="Close" onClick={onClose} />
      <div className="relative z-[96] flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border-l border-sales-border bg-sales-surface shadow-sales-modal sm:max-w-[640px]">
        <header className="border-b border-sales-border-subtle px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
                {String(c?.entity_type ?? "individual") === "corporate" ? "Organisation" : "Individual"}
              </p>
              <h2 className="truncate text-[18px] font-semibold tracking-[-0.03em]">
                {data?.contact?.name ?? "Compliance case"}
              </h2>
              <p className="text-[13px] text-sales-text-secondary">{data?.listingLabel ?? "No property linked"}</p>
            </div>
            <button type="button" className="text-[12px] text-sales-text-muted" onClick={onClose}>
              Close
            </button>
          </div>
          {c ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill status={status} label={String(c.status_label ?? status)} />
              <Badge tone="neutral" appearance="outline">
                Risk {COMPLIANCE_RISK_LABEL[(c.risk_level as "low") ?? "unclassified"] ?? String(c.risk_level)}
              </Badge>
            </div>
          ) : null}
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-sales-border-subtle px-3">
          {(
            [
              ["overview", "Overview"],
              ["cdd", "CDD"],
              ["documents", "Documents"],
              ["risk", "Risk"],
              ["review", "Review"],
              ["activity", "Activity"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`relative h-10 shrink-0 px-2.5 text-[12px] font-medium ${
                section === id ? "text-sales-text-primary" : "text-sales-text-secondary"
              }`}
            >
              {label}
              {section === id ? <span className="absolute inset-x-1 -bottom-px h-[2px] bg-sales-brand" /> : null}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}
          {toast ? <p className="mb-3 text-[13px] text-sales-text-secondary">{toast}</p> : null}
          {!data ? <p className="text-[13px] text-sales-text-muted">Loading…</p> : null}

          {data && section === "overview" ? (
            <div className="space-y-4 text-[13px]">
              {data.priorApproved.length > 0 ? (
                <div className="rounded-[12px] border border-sales-border p-3">
                  <p className="font-medium">Previous CDD available</p>
                  <p className="mt-1 text-sales-text-secondary">
                    Last approved:{" "}
                    {data.priorApproved[0]?.approvedAt
                      ? new Date(data.priorApproved[0].approvedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                    . This does not approve the current transaction.
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
                  CDD completeness
                </p>
                <p className="mt-1 text-[16px] font-semibold">
                  {data.completeness.completed} / {data.completeness.required} required items completed
                </p>
                <ul className="mt-2 space-y-1">
                  {data.completeness.items.map((i) => (
                    <li key={i.id} className="flex gap-2">
                      <span>{i.met ? "✓" : "○"}</span>
                      {i.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-medium">
                  {data.completeness.readyForReview ? "Ready for review" : "Not ready for review"}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-sales-text-muted">Agent</dt>
                  <dd>{String(c?.buyer_agent_name ?? "—")}</dd>
                </div>
                <div>
                  <dt className="text-sales-text-muted">Reviewer</dt>
                  <dd>{String(c?.reviewer_name ?? "—")}</dd>
                </div>
                {data.offer?.current_offer_amount != null ? (
                  <div>
                    <dt className="text-sales-text-muted">Offer</dt>
                    <dd className="tabular-nums">
                      US${Number(data.offer.current_offer_amount).toLocaleString("en-US")}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {status === "restricted" || status === "rejected" ? (
                <p className="rounded-[10px] border border-sales-border p-3">
                  {data.seeInternal
                    ? String(c?.restriction_reason || c?.rejection_reason || "")
                    : "Compliance review required before this transaction can proceed."}
                </p>
              ) : null}
              {data.canCollect && !data.completeness.readyForReview && data.nextUpload ? (
                <p className="text-sales-text-secondary">Next step: {data.nextUpload.label}</p>
              ) : null}
            </div>
          ) : null}

          {data && section === "cdd" ? (
            <CddForm
              data={data}
              busy={busy}
              partyName={partyName}
              partyType={partyType}
              setPartyName={setPartyName}
              setPartyType={setPartyType}
              onSave={(profile, entity) => void mutate("update_profile", { cdd_profile: profile, entity_type: entity })}
              onAddParty={() => {
                void mutate("add_party", { full_name: partyName, relationship_type: partyType });
                setPartyName("");
              }}
              onRemoveParty={(id) => void mutate("remove_party", { party_id: id })}
            />
          ) : null}

          {data && section === "documents" ? (
            <ul className="space-y-2">
              {data.documents.map((d) => (
                <li key={d.id} className="rounded-[12px] border border-sales-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-medium">{d.label}</p>
                      <p className="text-[12px] capitalize text-sales-text-secondary">{d.status.replace(/_/g, " ")}</p>
                      {d.originalFilename ? (
                        <p className="mt-1 text-[12px] text-sales-text-muted">
                          {d.originalFilename}
                          {d.uploadedAt
                            ? ` · ${new Date(d.uploadedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                          {d.uploadedByName ? ` · ${d.uploadedByName}` : ""}
                        </p>
                      ) : null}
                    </div>
                    {d.required ? (
                      <span className="text-[10px] font-semibold uppercase text-sales-text-muted">Required</span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.canCollect ? (
                      <label className="inline-flex h-10 cursor-pointer items-center rounded-[10px] border border-sales-border px-3 text-[12px] font-medium">
                        {d.hasFile ? "Replace" : "Upload document"}
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={busy}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void upload(d.id, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    ) : null}
                    {d.hasFile ? (
                      <Button variant="secondary" size="sm" onClick={() => void openFile(d.id)}>
                        Open
                      </Button>
                    ) : null}
                    {data.canReview && d.hasFile ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void mutate("review_document", { document_id: d.id, decision: "accepted" })}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void mutate("review_document", { document_id: d.id, decision: "rejected" })}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {data && section === "risk" ? (
            <div className="space-y-3">
              <p className="text-[16px] font-semibold">
                {COMPLIANCE_RISK_LABEL[(c?.risk_level as "low") ?? "unclassified"] ?? "Unclassified"}
              </p>
              <p className="text-[12px] text-sales-text-secondary">
                Risk is set by authorised compliance staff. SegmiQ does not score clients automatically.
              </p>
              {data.canReview ? (
                <>
                  <select
                    className="h-11 w-full rounded-[10px] border border-sales-border px-3 text-[13px]"
                    value={risk}
                    onChange={(e) => setRisk(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <TextArea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason required when setting High, or lowering High"
                  />
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void mutate("set_risk", { risk_level: risk, reason })}
                  >
                    Save risk classification
                  </Button>
                </>
              ) : (
                <p className="text-[13px] text-sales-text-muted">Only compliance reviewers can change risk.</p>
              )}
            </div>
          ) : null}

          {data && section === "review" ? (
            <div className="space-y-3">
              {data.canCollect && data.completeness.readyForReview && ["in_progress", "awaiting_documents", "more_information_required"].includes(status) ? (
                <Button variant="primary" disabled={busy} onClick={() => void mutate("submit_review")}>
                  Submit for review
                </Button>
              ) : null}
              {data.canReview && status === "ready_for_review" ? (
                <Button variant="primary" disabled={busy} onClick={() => void mutate("start_review")}>
                  Start review
                </Button>
              ) : null}
              {data.canReview && (status === "under_review" || status === "edd_required") ? (
                <>
                  <TextArea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (required for more information, enhanced review, restrict, not approve)"
                  />
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" disabled={busy} onClick={() => setConfirmApprove(true)}>
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void mutate("request_info", { reason })}
                    >
                      Request more information
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void mutate("require_edd", { reason })}
                    >
                      Require enhanced review
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => void mutate("restrict", { reason })}>
                      Restrict
                    </Button>
                    <Button variant="danger" disabled={busy} onClick={() => void mutate("reject", { reason })}>
                      Not approve
                    </Button>
                  </div>
                </>
              ) : null}
              {!data.canReview ? (
                <p className="text-[13px] text-sales-text-secondary">
                  Approval is limited to authorised compliance staff.
                </p>
              ) : null}
              {confirmApprove ? (
                <div className="rounded-[12px] border border-sales-border p-3">
                  <p className="text-[14px] font-semibold">Approve CDD?</p>
                  <p className="mt-1 text-[13px] text-sales-text-secondary">
                    Client: {data.contact?.name}
                    <br />
                    Property: {data.listingLabel ?? "—"}
                    <br />
                    Risk: {String(c?.risk_level ?? "unclassified")}
                    <br />
                    Required items: {data.completeness.readyForReview ? "Complete" : "Incomplete"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" onClick={() => setConfirmApprove(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" disabled={busy} onClick={() => void mutate("approve")}>
                      Approve
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {data && section === "activity" ? (
            <ol className="space-y-3 border-l border-sales-border-subtle pl-4">
              {data.events.map((ev) => (
                <li key={ev.id}>
                  <p className="text-[11px] text-sales-text-muted">
                    {new Date(ev.createdAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {ev.createdByName ? ` · ${ev.createdByName}` : ""}
                  </p>
                  <p className="text-[13px] font-medium">{ev.summary}</p>
                  {ev.after ? <p className="text-[12px] text-sales-text-secondary">{ev.after}</p> : null}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CddForm({
  data,
  busy,
  partyName,
  partyType,
  setPartyName,
  setPartyType,
  onSave,
  onAddParty,
  onRemoveParty,
}: {
  data: Detail;
  busy: boolean;
  partyName: string;
  partyType: string;
  setPartyName: (v: string) => void;
  setPartyType: (v: string) => void;
  onSave: (profile: Record<string, string>, entity: string) => void;
  onAddParty: () => void;
  onRemoveParty: (id: string) => void;
}) {
  const profile = (data.case.cdd_profile as Record<string, string | null>) ?? {};
  const [entity, setEntity] = useState(String(data.case.entity_type ?? "individual"));
  const [fields, setFields] = useState(profile);

  useEffect(() => {
    setFields((data.case.cdd_profile as Record<string, string | null>) ?? {});
    setEntity(String(data.case.entity_type ?? "individual"));
  }, [data.case]);

  const individual = [
    ["legal_name", "Full legal name"],
    ["date_of_birth", "Date of birth"],
    ["nationality", "Nationality"],
    ["identification_type", "Identification type"],
    ["identification_reference", "ID / passport reference"],
    ["identification_expiry", "Identification expiry"],
    ["residential_address", "Residential address"],
    ["occupation", "Occupation"],
    ["source_of_funds_status", "Source of funds status"],
  ] as const;
  const corporate = [
    ["registered_name", "Registered company name"],
    ["trading_name", "Trading name"],
    ["registration_number", "Registration number"],
    ["jurisdiction", "Jurisdiction"],
    ["registered_address", "Registered address"],
  ] as const;

  return (
    <div className="space-y-3">
      {data.canCollect ? (
        <select
          className="h-11 w-full rounded-[10px] border border-sales-border px-3 text-[13px]"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
        >
          <option value="individual">Individual</option>
          <option value="corporate">Organisation</option>
        </select>
      ) : null}
      {(entity === "corporate" ? corporate : individual).map(([key, label]) => (
        <label key={key} className="block text-[12px]">
          <span className="text-sales-text-muted">{label}</span>
          <Input
            className="mt-1"
            value={fields[key] ?? ""}
            disabled={!data.canCollect}
            onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
          />
        </label>
      ))}
      {data.canCollect ? (
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => onSave(fields as Record<string, string>, entity)}
        >
          Save information
        </Button>
      ) : null}

      {entity === "corporate" ? (
        <div className="pt-2">
          <p className="text-[13px] font-semibold">Directors and beneficial owners</p>
          <ul className="mt-2 space-y-1 text-[13px]">
            {data.parties.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-[8px] border border-sales-border-subtle px-3 py-2">
                <span>
                  {p.full_name}
                  <span className="text-sales-text-muted"> · {p.relationship_type.replace(/_/g, " ")}</span>
                </span>
                {data.canCollect ? (
                  <button type="button" className="text-[12px]" onClick={() => onRemoveParty(p.id)}>
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {data.canCollect ? (
            <div className="mt-2 space-y-2">
              <Input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Full name" />
              <select
                className="h-11 w-full rounded-[10px] border border-sales-border px-3 text-[13px]"
                value={partyType}
                onChange={(e) => setPartyType(e.target.value)}
              >
                <option value="director">Director</option>
                <option value="beneficial_owner">Beneficial owner</option>
                <option value="authorised_representative">Authorised representative</option>
                <option value="other">Other</option>
              </select>
              <Button variant="secondary" disabled={busy || !partyName.trim()} onClick={onAddParty}>
                Add party
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
