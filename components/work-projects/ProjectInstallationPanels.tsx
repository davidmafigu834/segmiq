"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalAccessPanel } from "@/components/portal/PortalAccessPanel";
import { uploadCompanyDocument } from "@/lib/documents/client-upload";
import type { InstallationSnapshot } from "@/lib/work-projects/installation-service";
import {
  INSTALLATION_PHOTO_CATEGORIES,
  SOLAR_HANDOVER_CHECKS,
  SOLAR_INSTALLATION_CHECKLIST,
  SOLAR_QA_CHECKS,
} from "@/lib/work-projects/installation-rules";

const STEPS = ["Preparation", "Equipment", "Installation", "QA", "Commissioning", "Handover"] as const;

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

async function postInstallation(projectId: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/work-projects/${projectId}/installation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Installation could not be updated.");
  return data as InstallationSnapshot;
}

export function ProjectInstallationPanel({
  projectId,
  clientId,
  workflow,
  installation,
  members,
  locations,
  canManage,
  documentsEnabled,
}: {
  projectId: string;
  clientId: string;
  workflow: string;
  installation: InstallationSnapshot;
  members: Array<{ userId: string; name: string | null; role: string }>;
  locations: Array<{ id: string; name: string }>;
  canManage: boolean;
  documentsEnabled: boolean;
}) {
  const router = useRouter();
  const [snap, setSnap] = useState(installation);
  useEffect(() => { setSnap(installation); }, [installation]);
  const [step, setStep] = useState(0);
  const actionKeys = useRef<Record<string, string>>({});
  function actionKey(name: string) {
    if (!actionKeys.current[name]) actionKeys.current[name] = crypto.randomUUID();
    return actionKeys.current[name];
  }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [assignees, setAssignees] = useState<string[]>(snap.assignees.map((row) => row.user_id));
  const [acknowledge, setAcknowledge] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>(snap.checklist?.data ?? {});
  const [qa, setQa] = useState<Record<string, boolean>>({});
  const [handoverChecks, setHandoverChecks] = useState<Record<string, boolean>>(snap.handover?.checklist ?? {});
  const [customerName, setCustomerName] = useState(snap.handover?.customer_name ?? "");
  const [ack, setAck] = useState(false);
  const [category, setCategory] = useState<(typeof INSTALLATION_PHOTO_CATEGORIES)[number]>("COMPLETED_INSTALLATION");
  const [serials, setSerials] = useState<Record<string, string>>({});
  const [installedQty, setInstalledQty] = useState<Record<string, string>>({});
  const [issueQty, setIssueQty] = useState<Record<string, string>>({});
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("Unused equipment returned");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [commission, setCommission] = useState({ manufacturerMonths: "", workmanshipMonths: "", monitoringId: "" });
  const record = snap.installation;
  const solar = workflow === "SOLAR_INSTALLATION";

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const next = await postInstallation(projectId, body);
      if (next.installation || next.attention) setSnap(next);
      actionKeys.current = {};
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Installation could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
      {snap.attention.length ? (
        <ul className="space-y-1 rounded-sales-md border border-sales-border px-3 py-2 text-[13px]">
          {snap.attention.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
      {!record ? (
        <button type="button" disabled={busy || !snap.canOperate} onClick={() => void run({ action: "create", installationType: "PRIMARY" })} className="inline-flex min-h-11 items-center rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white">
          Schedule installation
        </button>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto">
            {STEPS.map((label, index) => (
              <button key={label} type="button" onClick={() => setStep(index)} className={`min-h-11 shrink-0 rounded-full border px-3 text-[12px] ${step === index ? "border-sales-text-primary bg-sales-text-primary text-white" : "border-sales-border"}`}>
                {index + 1}. {label}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-sales-text-secondary">{record.installation_number} · {record.status.replaceAll("_", " ")} · {record.site_name || "Site"} {record.site_address || ""}</p>

          {step === 0 ? (
            <div className="space-y-3">
              {snap.warnings.length ? (
                <div className="rounded-sales-md border border-sales-border px-3 py-2 text-[13px]">
                  <p className="font-medium">Readiness</p>
                  {snap.warnings.map((line) => <p key={line}>{line}</p>)}
                  <label className="mt-2 flex min-h-11 items-center gap-2"><input type="checkbox" checked={acknowledge} onChange={(e) => setAcknowledge(e.target.checked)} /> Proceed and record these exceptions</label>
                </div>
              ) : <p className="text-[13px]">Payment, assessment, and equipment reservations are ready.</p>}
              <label className="block text-[12px]">Start
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1 min-h-11 w-full rounded-sales-md border border-sales-border px-3" />
              </label>
              <div className="space-y-1">
                {members.map((member) => (
                  <label key={member.userId} className="flex min-h-11 items-center gap-2 text-[13px]">
                    <input type="checkbox" checked={assignees.includes(member.userId)} onChange={(e) => setAssignees((current) => e.target.checked ? [...current, member.userId] : current.filter((id) => id !== member.userId))} />
                    {member.name || "Team member"} · {member.role}
                  </label>
                ))}
              </div>
              {canManage ? (
                <button type="button" disabled={busy || !startAt || (snap.warnings.length > 0 && !acknowledge)} onClick={() => void run({ action: "schedule", installationId: record.id, startAt: new Date(startAt).toISOString(), assigneeIds: assignees, acknowledgeExceptions: acknowledge })} className="inline-flex min-h-11 items-center rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white">
                  Save schedule
                </button>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              {snap.equipment.map((line) => (
                <article key={line.id} className="rounded-sales-md border border-sales-border p-3 text-[13px]">
                  <h3 className="font-medium">{line.description}</h3>
                  <p>Required {line.quantity_required} · Reserved {line.quantity_reserved} · Issued {line.quantity_issued} · Installed {line.quantity_installed}</p>
                  {line.serials.map((unit) => <p key={unit.id}>Serial {unit.serial_number || "—"} · {unit.status}</p>)}
                  {snap.canOperate && line.track_inventory ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input inputMode="decimal" value={issueQty[line.id] ?? ""} onChange={(e) => setIssueQty({ ...issueQty, [line.id]: e.target.value })} placeholder="Issue quantity" className="min-h-11 rounded-sales-md border border-sales-border px-3" />
                      <button type="button" disabled={busy} onClick={() => void run({ action: "issue", installationId: record.id, equipmentId: line.id, quantity: Number(issueQty[line.id] || line.quantity_reserved), idempotencyKey: actionKey(`issue-${line.id}`) })} className="min-h-11 rounded-sales-md border border-sales-border px-3">Issue</button>
                      <input value={serials[line.id] ?? ""} onChange={(e) => setSerials({ ...serials, [line.id]: e.target.value })} placeholder="Serial number" autoComplete="off" className="min-h-11 rounded-sales-md border border-sales-border px-3" />
                      <button type="button" disabled={busy} onClick={() => void run({ action: "serial", installationId: record.id, equipmentId: line.id, serialNumber: serials[line.id] || "" })} className="min-h-11 rounded-sales-md border border-sales-border px-3">Save serial</button>
                      <input inputMode="decimal" value={installedQty[line.id] ?? ""} onChange={(e) => setInstalledQty({ ...installedQty, [line.id]: e.target.value })} placeholder="Installed quantity" className="min-h-11 rounded-sales-md border border-sales-border px-3" />
                      <button type="button" disabled={busy} onClick={() => void run({ action: "installed", installationId: record.id, equipmentId: line.id, quantity: Number(installedQty[line.id] || 0) })} className="min-h-11 rounded-sales-md border border-sales-border px-3">Mark installed</button>
                      {line.serials.filter((unit) => unit.status === "RECORDED").map((unit) => (
                        <button key={unit.id} type="button" disabled={busy} onClick={() => void run({ action: "installed", installationId: record.id, equipmentId: line.id, quantity: 1, unitId: unit.id })} className="min-h-11 rounded-sales-md border border-sales-border px-3">Install {unit.serial_number}</button>
                      ))}
                      <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3">
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                      </select>
                      <input inputMode="decimal" value={returnQty[line.id] ?? ""} onChange={(e) => setReturnQty({ ...returnQty, [line.id]: e.target.value })} placeholder="Return quantity" className="min-h-11 rounded-sales-md border border-sales-border px-3" />
                      <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="min-h-11 rounded-sales-md border border-sales-border px-3" />
                      <button type="button" disabled={busy} onClick={() => void run({ action: "return", installationId: record.id, equipmentId: line.id, locationId, quantity: Number(returnQty[line.id] || 0), reason: returnReason, idempotencyKey: actionKey(`return-${line.id}`) })} className="min-h-11 rounded-sales-md border border-sales-border px-3">Return unused</button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || !snap.canOperate} onClick={() => void run({ action: "start", installationId: record.id })} className="min-h-11 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white">Start installation</button>
                <button type="button" disabled={busy || !snap.canOperate} onClick={() => void run({ action: "pause", installationId: record.id })} className="min-h-11 rounded-sales-md border border-sales-border px-4 text-[13px]">Pause</button>
                <button type="button" disabled={busy || !snap.canOperate} onClick={() => void run({ action: "complete_work", installationId: record.id, summary: "Physical installation work completed." })} className="min-h-11 rounded-sales-md border border-sales-border px-4 text-[13px]">Installation work complete</button>
              </div>
              {solar ? SOLAR_INSTALLATION_CHECKLIST.map((item) => (
                <label key={item.key} className="flex min-h-11 items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={Boolean(checks[item.key])} onChange={(e) => setChecks({ ...checks, [item.key]: e.target.checked })} />
                  <span><span className="text-sales-text-muted">{item.section}. </span>{item.label}</span>
                </label>
              )) : <p className="text-[13px] text-sales-text-secondary">Record the work completed on site. This checklist is not an electrical certificate.</p>}
              {snap.canOperate ? <button type="button" disabled={busy} onClick={() => void run({ action: "checklist", installationId: record.id, checklist: checks, completed: true })} className="min-h-11 rounded-sales-md border border-sales-border px-4 text-[13px]">Save checklist</button> : null}
              {documentsEnabled ? (
                <>
                  <label className="block text-[13px]">Photo category
                    <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="mt-1 min-h-11 w-full rounded-sales-md border border-sales-border px-3">
                      {INSTALLATION_PHOTO_CATEGORIES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
                    </select>
                  </label>
                  <InstallationPhoto clientId={clientId} projectId={projectId} installationId={record.id} category={category} onDone={(message) => { setError(message); setBusy(false); }} onStart={() => { setBusy(true); setError(""); }} />
                </>
              ) : null}
            </div>
          ) : null}

          {step === 3 && canManage ? (
            <div className="space-y-2">
              <p className="text-[12px] text-sales-text-muted">Record the contractor result. This is not an independent electrical certificate.</p>
              {(solar ? SOLAR_QA_CHECKS : []).map((item) => (
                <label key={item.key} className="flex min-h-11 items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={Boolean(qa[item.key])} onChange={(e) => setQa({ ...qa, [item.key]: e.target.checked })} />{item.label}
                </label>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void run({ action: "qa", installationId: record.id, outcome: "PASS", checklist: qa })} className="min-h-11 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white">Pass QA</button>
                <button type="button" disabled={busy} onClick={() => void run({ action: "qa", installationId: record.id, outcome: "PASS_WITH_NOTES", checklist: qa })} className="min-h-11 rounded-sales-md border border-sales-border px-4 text-[13px]">Pass with notes</button>
                <button type="button" disabled={busy} onClick={() => void run({ action: "qa", installationId: record.id, outcome: "REQUIRES_REWORK", checklist: qa })} className="min-h-11 rounded-sales-md border border-sales-border px-4 text-[13px]">Requires rework</button>
                <button type="button" disabled={busy} onClick={() => void run({ action: "rework", installationId: record.id, title: "Installation rework" })} className="min-h-11 rounded-sales-md border border-sales-border px-4 text-[13px]">Create rework task</button>
              </div>
              {snap.qualityChecks.map((row) => <p key={row.id} className="text-[13px]">{row.outcome} · {new Date(row.checked_at).toLocaleString()}{row.internal_notes ? ` · ${row.internal_notes}` : ""}</p>)}
            </div>
          ) : null}

          {step === 4 && canManage ? (
            <div className="space-y-2 text-[13px]">
              <label className="block">Manufacturer warranty months
                <input inputMode="numeric" value={commission.manufacturerMonths} onChange={(e) => setCommission({ ...commission, manufacturerMonths: e.target.value })} className="mt-1 min-h-11 w-full rounded-sales-md border border-sales-border px-3" />
              </label>
              <label className="block">Workmanship warranty months
                <input inputMode="numeric" value={commission.workmanshipMonths} onChange={(e) => setCommission({ ...commission, workmanshipMonths: e.target.value })} className="mt-1 min-h-11 w-full rounded-sales-md border border-sales-border px-3" />
              </label>
              <label className="block">Monitoring identifier
                <input value={commission.monitoringId} onChange={(e) => setCommission({ ...commission, monitoringId: e.target.value })} className="mt-1 min-h-11 w-full rounded-sales-md border border-sales-border px-3" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void run({ action: "commissioning", installationId: record.id, outcome: "PASSED", idempotencyKey: actionKey("commission-pass"), data: commission })} className="min-h-11 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white">Complete commissioning</button>
                <button type="button" disabled={busy} onClick={() => void run({ action: "commissioning", installationId: record.id, outcome: "FAILED", idempotencyKey: actionKey("commission-fail"), internalNotes: "Commissioning failed", data: commission })} className="min-h-11 rounded-sales-md border border-sales-border px-4 text-[13px]">Commissioning failed</button>
              </div>
              {snap.commissioning ? <p>{snap.commissioning.status}{snap.commissioning.internal_notes ? ` · ${snap.commissioning.internal_notes}` : ""}</p> : null}
            </div>
          ) : null}

          {step === 5 && canManage ? (
            <div className="space-y-2 text-[13px]">
              {SOLAR_HANDOVER_CHECKS.map((item) => (
                <label key={item.key} className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" checked={Boolean(handoverChecks[item.key])} onChange={(e) => setHandoverChecks({ ...handoverChecks, [item.key]: e.target.checked })} />{item.label}
                </label>
              ))}
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className="min-h-11 w-full rounded-sales-md border border-sales-border px-3" />
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Customer acknowledged the handover</label>
              {snap.showBalance && (snap.outstanding ?? 0) > 0 ? <p>Customer still owes {money(snap.outstanding || 0, snap.currency)}.</p> : null}
              <button type="button" disabled={busy} onClick={() => void run({ action: "handover", installationId: record.id, customerName, acknowledged: ack, checklist: handoverChecks, trainingCompleted: Boolean(handoverChecks.operation), documentsProvided: Boolean(handoverChecks.manuals) })} className="min-h-11 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white">Complete handover</button>
              <PortalAccessPanel projectId={projectId} contactId={null} />
              <div className="rounded-sales-md border border-sales-border p-3">
                <p className="font-medium">Complete project</p>
                {snap.completion.blockers.map((line) => <p key={line}>{line}</p>)}
                {snap.completion.warnings.map((line) => <p key={line}>{line}</p>)}
                <button type="button" disabled={busy || !snap.completion.canComplete} onClick={() => void fetch(`/api/work-projects/${projectId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "COMPLETED" }) }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Project could not be completed."); router.refresh(); }).catch((err) => setError(err.message))} className="mt-2 min-h-11 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white">Complete project</button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function InstallationPhoto({ clientId, projectId, installationId, category, onDone, onStart }: { clientId: string; projectId: string; installationId: string; category: string; onDone: (message: string) => void; onStart: () => void }) {
  return (
    <input type="file" accept="image/*" capture="environment" className="block w-full text-[13px]" onChange={(event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      onStart();
      void uploadCompanyDocument(clientId, file).then(async (uploaded) => {
        if (!uploaded.ok) { onDone(uploaded.error); return; }
        const response = await fetch(`/api/work-projects/${projectId}/installation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "evidence", installationId, documentId: uploaded.documentId, category, label: file.name }),
        });
        onDone(response.ok ? "" : "Photo could not be linked.");
      });
    }} />
  );
}

export function ProjectAssetsPanel({ projectId, installation, canManage }: { projectId: string; installation: InstallationSnapshot; canManage: boolean }) {
  const router = useRouter();
  const systems = installation.assets.filter((asset) => !asset.parent_asset_id);
  const children = installation.assets.filter((asset) => asset.parent_asset_id);
  return (
    <div className="space-y-3">
      {installation.assets.length === 0 ? <p className="text-[13px] text-sales-text-secondary">Installed assets appear after commissioning confirms the equipment was installed.</p> : null}
      {systems.map((asset) => (
        <article key={asset.id} className="rounded-sales-md border border-sales-border p-3 text-[13px]">
          <h3 className="font-medium">{asset.name}</h3>
          <p>{asset.asset_type} · {asset.status} · {asset.quantity}{asset.serial_number ? ` · ${asset.serial_number}` : ""}</p>
          <p>{asset.site_name || ""}</p>
          {children.filter((child) => child.parent_asset_id === asset.id).map((child) => <p key={child.id}>{child.quantity} × {child.name} · {child.status}</p>)}
          {canManage && asset.status === "ACTIVE" ? (
            <button type="button" className="mt-2 min-h-11 rounded-sales-md border border-sales-border px-3" onClick={() => void fetch(`/api/work-projects/${projectId}/installation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "asset_status", installationId: installation.installation?.id, assetId: asset.id, assetStatus: "REPLACED" }) }).then(() => router.refresh())}>Mark replaced</button>
          ) : null}
          {installation.warranties.filter((warranty) => warranty.installed_asset_id === asset.id).map((warranty) => (
            <p key={warranty.id}>{warranty.warranty_type} · {warranty.status}</p>
          ))}
        </article>
      ))}
    </div>
  );
}
