"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

const fieldClass = "min-h-11 w-full rounded-md border border-sales-border bg-sales-surface px-3 text-sm";

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

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Staff handover</h2>
      <p className="text-xs text-sales-text-secondary">
        Current assignments move to the people you choose. Original sourcing credit, offer history and commission rows stay. WhatsApp sessions are not transferred. No account is deleted.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs font-medium">
          Departing person
          <select className={`${fieldClass} mt-1`} value={fromUserId} onChange={(event) => { setFromUserId(event.target.value); setPreview(null); }}>
            <option value="">Choose a person</option>
            {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium">
          Default replacement
          <select className={`${fieldClass} mt-1`} value={replacementId} onChange={(event) => setReplacementId(event.target.value)}>
            <option value="">Choose a replacement</option>
            {others.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="min-h-11 rounded-md border border-sales-border px-3 text-sm" disabled={!fromUserId || busy} onClick={() => void loadPreview()}>
          Review assignments
        </button>
        <Link className="inline-flex min-h-11 items-center text-sm" href="/client/team">Open team directory</Link>
      </div>
      {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
      {result ? <p className="text-sm" role="status">{result}</p> : null}

      {preview ? (
        <section className="space-y-2 rounded-lg border border-sales-border p-3">
          <p className="text-sm font-semibold">
            {preview.total} current assignments for {preview.fromUser.name} · {selected.size} selected
          </p>
          {preview.incomplete ? (
            <p className="text-xs text-amber-800">Some lists were too large to load completely. Run the handover, then review again for the remainder.</p>
          ) : null}
          {preview.unavailable.length ? (
            <p className="text-xs text-amber-800">Not available until the latest database update is applied: {preview.unavailable.map((type) => type.replaceAll("_", " ")).join(", ")}.</p>
          ) : null}
          <ul className="space-y-2">
            {preview.totals.filter((row) => row.count > 0).map((row) => {
              const items = grouped.get(row.type) ?? [];
              const chosen = items.filter((item) => selected.has(keyOf(item))).length;
              return (
                <li key={row.type} className="rounded border border-sales-border/70 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex min-h-9 items-center gap-2 font-semibold">
                      <input type="checkbox" checked={chosen === items.length && items.length > 0} onChange={(event) => toggleType(row.type, event.target.checked)} />
                      {row.label} ({chosen} of {row.count})
                    </label>
                    <select
                      aria-label={`Replacement for ${row.label}`}
                      className="min-h-9 rounded-md border border-sales-border bg-sales-surface px-2"
                      value={byType[row.type] ?? ""}
                      onChange={(event) => setByType({ ...byType, [row.type]: event.target.value })}
                    >
                      <option value="">Default replacement</option>
                      {others.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                    <button type="button" className="min-h-9 text-xs underline" onClick={() => setExpanded(expanded === row.type ? null : row.type)}>
                      {expanded === row.type ? "Hide records" : "Show records"}
                    </button>
                  </div>
                  {expanded === row.type ? (
                    <ul className="mt-1 max-h-64 overflow-y-auto">
                      {items.map((item) => (
                        <li key={keyOf(item)}>
                          <label className="flex min-h-9 items-center gap-2">
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
            {preview.total === 0 ? <li className="text-sm">No current assignments for this person.</li> : null}
          </ul>
          <p className="text-xs text-sales-text-muted">Not changed: {preview.unchanged.join(" · ")}.</p>
          {drift ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p>
                Assignments changed after the preview. {drift.currentTotal} are assigned now
                {drift.selectedNoLongerAssigned ? `; ${drift.selectedNoLongerAssigned} you selected are no longer assigned and will be skipped` : ""}.
              </p>
              <div className="mt-1 flex gap-2">
                <button type="button" className="min-h-9 font-semibold underline" onClick={() => void loadPreview()}>Review again</button>
                <button type="button" className="min-h-9 font-semibold underline" disabled={busy} onClick={() => void run(true)}>Continue with my selection</button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="min-h-11 rounded-md bg-sales-text-primary px-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy || !replacementId || selected.size === 0}
            onClick={() => void run(false)}
          >
            Hand over {selected.size} records
          </button>
        </section>
      ) : null}

      {history.length ? (
        <section className="space-y-1">
          <h3 className="text-xs font-semibold">Recent handovers</h3>
          <ul className="space-y-1 text-xs">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-sales-border/70 px-2 py-1.5">
                <span>
                  {new Date(row.created_at).toLocaleDateString()} · {row.status.replaceAll("_", " ")}
                  {row.total_items != null
                    ? ` · ${row.applied_items ?? 0} moved, ${row.skipped_items ?? 0} skipped, ${row.failed_items ?? 0} failed of ${row.total_items}`
                    : row.summary ? ` · ${row.summary}` : ""}
                </span>
                {row.status === "partial" || row.status === "in_progress" ? (
                  <button type="button" className="min-h-9 font-semibold underline" disabled={busy} onClick={() => void retry(row.id)}>Retry failed items</button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
