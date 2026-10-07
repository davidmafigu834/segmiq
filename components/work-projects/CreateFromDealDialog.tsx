"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WORK_PROJECT_WORKFLOWS, workProjectWorkflowLabel } from "@/lib/work-projects/constants";

type Draft = {
  title: string;
  workflowKey: "GENERAL_TRADES" | "SOLAR_INSTALLATION";
  customerName: string;
  siteAddress: string | null;
  projectValue: number | null;
  currency: string;
  quotation: { id: string; number: string | null; status: string; total: number | null; currency: string | null; accepted: boolean } | null;
  solar: { systemSize: string | null } | null;
  service: string | null;
  ownerId: string | null;
  existingProjectId: string | null;
  salesAssessment?: { visitId: string; completedAt: string | null; summary: string | null; site: string | null } | null;
};

function money(value: number | null, currency: string) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function CreateFromDealDialog({
  dealId,
  projectBasePath,
  existingProjectId,
  owners,
  onClose,
  onOpen,
}: {
  dealId: string;
  projectBasePath: "/sales/projects" | "/client/projects";
  existingProjectId: string | null;
  owners: Array<{ id: string; name: string | null }>;
  onClose: () => void;
  onOpen?: (projectId: string) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [workflowKey, setWorkflowKey] = useState<"GENERAL_TRADES" | "SOLAR_INSTALLATION">("GENERAL_TRADES");
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/work-projects/deal-preview?dealId=${dealId}`);
      const json = (await res.json().catch(() => ({}))) as { draft?: Draft; error?: string };
      if (cancelled) return;
      setLoading(false);
      if (!res.ok || !json.draft) {
        setError(json.error || "Could not prepare the project.");
        return;
      }
      setDraft(json.draft);
      setWorkflowKey(json.draft.workflowKey);
      setTitle(json.draft.title);
      setOwnerId(json.draft.ownerId ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const openId = existingProjectId || draft?.existingProjectId || null;

  async function create() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/work-projects/from-deal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId,
        workflowKey,
        title,
        ownerId: ownerId || null,
        targetCompletionDate: target || null,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { project?: { id: string }; error?: string };
    setSaving(false);
    if (!res.ok || !json.project) {
      setError(json.error || "Could not create the project.");
      return;
    }
    onOpen?.(json.project.id);
    router.push(`${projectBasePath}/${json.project.id}`);
  }

  const solar = workflowKey === "SOLAR_INSTALLATION";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-sales-xl bg-sales-surface p-5 sm:rounded-sales-xl">
        <p className="text-[13px] font-medium text-sales-text-secondary">Deal won</p>
        <h2 className="mt-1 text-[1.75rem] font-semibold leading-tight text-sales-text-primary">
          {solar ? "Create Solar Project" : draft?.customerName || "Ready to deliver the work?"}
        </h2>
        <p className="mt-1 text-[15px] text-sales-text-secondary">{solar ? "Create the solar delivery project." : "Create a project to manage delivery from assessment to handover."}</p>
        {loading ? <p className="mt-4 text-[13px] text-sales-text-secondary">Loading the won deal…</p> : null}
        {draft ? (
          <div className="mt-4 space-y-2 text-[13px] text-sales-text-secondary">
            <p>Customer. {draft.customerName}</p>
            {draft.salesAssessment ? (
              <p>Sales site assessment. Completed {draft.salesAssessment.completedAt ? new Date(draft.salesAssessment.completedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}</p>
            ) : null}
            {draft.quotation ? (
              <p>
                {draft.quotation.accepted ? "Accepted quote" : "Quotation"}. {draft.quotation.number || "Quotation"} — {money(draft.quotation.total, draft.quotation.currency || draft.currency)}
              </p>
            ) : null}
            {draft.siteAddress ? <p>Site. {draft.siteAddress}</p> : null}
            {solar && draft.solar?.systemSize ? <p>System. {draft.solar.systemSize}</p> : null}
            {draft.service && !solar ? <p>Work. {draft.service}</p> : null}
          </div>
        ) : null}
        {openId ? (
          <button
            type="button"
            className="mt-5 min-h-11 w-full rounded-sales-md bg-segmiq-lime text-[15px] font-semibold text-sales-text-primary"
            onClick={() => router.push(`${projectBasePath}/${openId}`)}
          >
            Open project
          </button>
        ) : (
          <>
            <label className="mt-4 block text-[12px] font-medium">
              Workflow
              <select value={workflowKey} onChange={(e) => setWorkflowKey(e.target.value as typeof workflowKey)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]">
                {WORK_PROJECT_WORKFLOWS.map((item) => (
                  <option key={item} value={item}>{workProjectWorkflowLabel(item)}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-[12px] font-medium">
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]" />
            </label>
            <label className="mt-3 block text-[12px] font-medium">
              Project owner
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]">
                <option value="">Deal owner</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>{owner.name || "Team member"}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-[12px] font-medium">
              Target completion
              <input type="date" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]" />
            </label>
            {error ? <p className="mt-3 text-[13px] text-sales-danger-fg">{error}</p> : null}
            <button type="button" disabled={saving || !title.trim()} onClick={() => void create()} className="mt-5 min-h-11 w-full rounded-sales-md bg-segmiq-lime text-[15px] font-semibold text-sales-text-primary disabled:opacity-50">
              {saving ? "Creating…" : solar ? "Create Project" : "Create project"}
            </button>
          </>
        )}
        <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full text-[13px] font-semibold text-sales-text-secondary">
          Not now
        </button>
      </div>
    </div>
  );
}
