"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */
/* Hallmark · pre-emit critique: P4 H4 E4 S4 R4 V4 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import {
  ReEmptyState,
  ReErrorState,
  RePageHeader,
  RePartialNotice,
  ReSection,
  ReSheet,
  ReStatusBadge,
} from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass } from "@/components/real-estate/acquisition/acquisition-ui";

type Assignment = { recordType: string; recordId: string; label: string };
type SourceTotal = { type: string; label: string; count: number; incomplete: boolean; unavailable: boolean };
type Preview = {
  fromUser: { id: string; name: string; active: boolean };
  assignments: Assignment[];
  totals: SourceTotal[];
  total: number;
  fingerprint: string;
  incomplete: boolean;
  unavailable: string[];
  unchanged: string[];
};
type StaffMember = { id: string; name: string; role: string };
type HandoverRow = {
  id: string;
  status: string;
  summary: string | null;
  created_at: string;
  total_items?: number | null;
  applied_items?: number | null;
  failed_items?: number | null;
  skipped_items?: number | null;
};

function keyOf(row: Assignment): string {
  return `${row.recordType}:${row.recordId}`;
}

export function HandoverWorkspace({ clientId }: { clientId: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [fromUserId, setFromUserId] = useState("");
  const [replacementId, setReplacementId] = useState("");
  const [byType, setByType] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drift, setDrift] = useState<{ currentTotal: number; selectedNoLongerAssigned: number | null } | null>(null);
  const [history, setHistory] = useState<HandoverRow[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/agency?view=handovers`);
    if (!res.ok) return;
    const json = await res.json();
    setHistory(json.handovers ?? []);
  }, [clientId]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/clients/${clientId}/agency?view=staff`);
      if (res.ok) setStaff((await res.json()).staff ?? []);
    })();
    void loadHistory();
  }, [clientId, loadHistory]);

  async function loadPreview() {
    if (!fromUserId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setDrift(null);
    const res = await fetch(`/api/clients/${clientId}/agency?view=handover&fromUserId=${fromUserId}`);
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not review assignments.");
      return;
    }
    const next = json as Preview;
    setPreview(next);
    setSelected(new Set(next.assignments.map(keyOf)));
  }

  async function run(acceptChanges = false) {
    if (!preview) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/agency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "handover",
        fromUserId,
        defaultReplacementId: replacementId,
        replacementByType: Object.fromEntries(Object.entries(byType).filter(([, id]) => id)),
        selectedKeys: [...selected],
        expectedFingerprint: preview.fingerprint,
        acceptChanges,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 409 && json.drift) {
      setDrift(json.drift);
      setError(json.error);
      return;
    }
    if (!res.ok) {
      setError(json.error ?? "Handover failed.");
      return;
    }
    setDrift(null);
    setResult(
      `Moved ${json.applied}. Skipped ${json.skipped} that were no longer assigned. Failed ${json.failed}.` +
        (json.notSelected ? ` ${json.notSelected} records were left with the departing person.` : "") +
        " Sourcing credit, commission beneficiaries and WhatsApp sessions were not changed."
    );
    setPreview(null);
    await loadHistory();
  }

  async function retry(handoverId: string) {
    setBusy(true);
    const res = await fetch(`/api/clients/${clientId}/agency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "handover_retry", handoverId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(json.error ?? "Retry failed.");
    else setResult(`Retry moved ${json.applied}, skipped ${json.skipped}, failed ${json.failed}.`);
    await loadHistory();
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const row of preview?.assignments ?? []) map.set(row.recordType, [...(map.get(row.recordType) ?? []), row]);
    return map;
  }, [preview]);

  const others = staff.filter((member) => member.id !== fromUserId);

  function toggleType(type: string, on: boolean) {
    const next = new Set(selected);
    for (const row of grouped.get(type) ?? []) {
      if (on) next.add(keyOf(row));
      else next.delete(keyOf(row));
    }
    setSelected(next);
  }

  const fromName = staff.find((member) => member.id === fromUserId)?.name ?? "Selected person";
  const toName = staff.find((member) => member.id === replacementId)?.name ?? "Selected replacement";

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <RePageHeader
        title="Staff handover"
        description="Transfer active responsibilities while preserving the original history. WhatsApp sessions, sourcing credit and commission beneficiaries stay where they are."
      />
      <ReSection id="handover-people" title="1. Choose the people">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={acqLabelClass} htmlFor="handover-from">Person handing work over</label>
            <select id="handover-from" className={acqFieldClass} value={fromUserId} onChange={(event) => { setFromUserId(event.target.value); setPreview(null); }}>
              <option value="">Choose a person</option>
              {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </div>
          <div>
            <label className={acqLabelClass} htmlFor="handover-to">Default replacement</label>
            <select id="handover-to" className={acqFieldClass} value={replacementId} onChange={(event) => setReplacementId(event.target.value)}>
              <option value="">Choose a replacement</option>
              {others.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} disabled={!fromUserId || busy} onClick={() => void loadPreview()}>
            {busy ? "Reviewing…" : "Review assignments"}
          </button>
          <Link className="re-focus inline-flex min-h-11 items-center text-[13px] font-semibold" href="/client/team">Open team directory</Link>
        </div>
      </ReSection>
      {error ? <ReErrorState title="Handover" description={error} /> : null}
      {result ? <p className="text-[13px] text-sales-text-secondary" role="status">{result}</p> : null}

      {preview ? (
        <ReSection id="handover-preview" title="2. Review active work" description={`${preview.total} current assignments for ${preview.fromUser.name}. ${selected.size} selected.`}>
          {preview.incomplete ? (
            <RePartialNotice>Some lists were too large to load completely. This is not every assignment. Review again after the handover for anything left behind.</RePartialNotice>
          ) : null}
          {preview.unavailable.length ? (
            <RePartialNotice>Not available until the latest database update is applied: {preview.unavailable.map((type) => type.replaceAll("_", " ")).join(", ")}.</RePartialNotice>
          ) : null}
          <ul className="space-y-2">
            {preview.totals.filter((row) => row.count > 0).map((row) => {
              const items = grouped.get(row.type) ?? [];
              const chosen = items.filter((item) => selected.has(keyOf(item))).length;
              return (
                <li key={row.type} className="rounded-[10px] border border-sales-border-subtle p-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex min-h-11 items-center gap-2 font-semibold">
                      <input type="checkbox" checked={chosen === items.length && items.length > 0} onChange={(event) => toggleType(row.type, event.target.checked)} />
                      {row.label} ({chosen} of {row.count})
                    </label>
                    <select
                      aria-label={`Replacement for ${row.label}`}
                      className={cn(acqFieldClass, "w-auto min-w-[180px]")}
                      value={byType[row.type] ?? ""}
                      onChange={(event) => setByType({ ...byType, [row.type]: event.target.value })}
                    >
                      <option value="">Default replacement</option>
                      {others.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                    <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => setExpanded(expanded === row.type ? null : row.type)}>
                      {expanded === row.type ? "Hide records" : "Show records"}
                    </button>
                  </div>
                  {expanded === row.type ? (
                    <ul className="mt-1 max-h-64 overflow-y-auto">
                      {items.map((item) => (
                        <li key={keyOf(item)}>
                          <label className="flex min-h-11 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected.has(keyOf(item))}
                              onChange={(event) => {
                                const next = new Set(selected);
                                if (event.target.checked) next.add(keyOf(item));
                                else next.delete(keyOf(item));
                                setSelected(next);
                              }}
                            />
                            {item.label}
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
            {preview.total === 0 ? <li><ReEmptyState compact title="No current assignments" description="This person has no active work the handover can move." /></li> : null}
          </ul>
          <p className="mt-3 text-[12px] text-sales-text-muted">Left unchanged: {preview.unchanged.join(" · ") || "Nothing listed"}.</p>
          {drift ? (
            <div className="mt-3 rounded-[10px] border border-sales-warning/40 bg-sales-warning-soft px-3 py-2 text-[13px] text-sales-warning-fg" role="alert">
              <p className="font-semibold">Handover preview is out of date</p>
              <p className="mt-1">
                Assignments changed after the preview. {drift.currentTotal} are assigned now
                {drift.selectedNoLongerAssigned ? `. ${drift.selectedNoLongerAssigned} you selected are no longer assigned and will be skipped` : ""}.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" onClick={() => void loadPreview()}>Refresh preview</button>
                <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" disabled={busy} onClick={() => void run(true)}>Continue with my selection</button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "mt-3 min-h-11")}
            disabled={busy || !replacementId || selected.size === 0}
            onClick={() => setConfirming(true)}
          >
            Confirm handover
          </button>
        </ReSection>
      ) : null}

      {history.length ? (
        <ReSection id="handover-history" title="Recent handovers" count={history.length}>
          <ul className="space-y-2">
            {history.map((row) => {
              const failed = row.failed_items ?? 0;
              return (
                <li key={row.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ReStatusBadge label={row.status.replaceAll("_", " ")} tone={failed > 0 || row.status === "partial" ? "warning" : row.status === "completed" || row.status === "applied" ? "success" : "neutral"} />
                      <span className="text-[12px] text-sales-text-muted">{new Date(row.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-1 text-[13px] text-sales-text-secondary [overflow-wrap:anywhere]">
                      {row.total_items != null
                        ? `${row.applied_items ?? 0} moved, ${row.skipped_items ?? 0} skipped, ${failed} failed of ${row.total_items}`
                        : row.summary || "No item counts recorded"}
                    </p>
                  </div>
                  {row.status === "partial" || row.status === "in_progress" ? (
                    <button type="button" className="re-focus min-h-11 text-[13px] font-semibold" disabled={busy} onClick={() => void retry(row.id)}>Retry failed items</button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </ReSection>
      ) : null}

      {confirming && preview ? (
        <ReSheet
          title="Confirm handover"
          description="This moves the selected live assignments. It does not delete the person or rewrite history."
          onClose={() => { if (!busy) setConfirming(false); }}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="re-focus min-h-11 px-3 text-[14px] font-semibold" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
              <button type="button" className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11")} disabled={busy} onClick={() => { setConfirming(false); void run(false); }}>
                {busy ? "Working…" : "Confirm handover"}
              </button>
            </div>
          }
        >
          <dl className="space-y-2 text-[14px]">
            <div><dt className="text-[12px] text-sales-text-muted">From</dt><dd className="font-semibold">{fromName}</dd></div>
            <div><dt className="text-[12px] text-sales-text-muted">Default replacement</dt><dd className="font-semibold">{toName}</dd></div>
            <div><dt className="text-[12px] text-sales-text-muted">Selected assignments</dt><dd className="font-semibold tabular-nums">{selected.size}</dd></div>
          </dl>
          {preview.incomplete ? <p className="mt-3 text-[13px] text-sales-warning-fg">The preview is incomplete. Records that did not load will stay with the current person.</p> : null}
        </ReSheet>
      ) : null}
    </div>
  );
}
