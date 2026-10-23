"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { CommercialLaunchMode } from "@/lib/commercial-launch/types";

export function LaunchModeForm({
  currentMode,
  version,
  writesEnabled,
}: {
  currentMode: CommercialLaunchMode;
  version: number;
  writesEnabled: boolean;
}) {
  const router = useRouter();
  const [targetMode, setTargetMode] = useState<CommercialLaunchMode>("OFF");
  const [reason, setReason] = useState("");
  const [decisionOwner, setDecisionOwner] = useState("");
  const [rollbackOwner, setRollbackOwner] = useState("");
  const [pilotIds, setPilotIds] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/commercial/launch-control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetMode,
          expectedVersion: version,
          reason,
          evidenceRefs: [],
          decisionOwner,
          rollbackOwner,
          pilotClientIds: pilotIds
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          idempotencyKey: `launch:${crypto.randomUUID()}`,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Release decision failed.");
      setMessage(
        `Recorded ${body.mode}. No feature was automatically enabled.`,
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Release decision failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[var(--text-primary)]">
            Release decision
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Current mode: {currentMode.replaceAll("_", " ")}. GA requires all
            current evidence gates to pass inside the database transaction.
          </p>
        </div>
        {!writesEnabled ? (
          <span className="rounded-full border border-[var(--warning)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
            Writes disabled
          </span>
        ) : null}
      </div>
      <fieldset
        disabled={!writesEnabled || busy}
        className="mt-4 grid gap-3 md:grid-cols-2"
      >
        <label className="space-y-1 text-sm text-[var(--text-secondary)]">
          <span>Requested mode</span>
          <select
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 text-[var(--text-primary)]"
            value={targetMode}
            onChange={(event) =>
              setTargetMode(event.target.value as CommercialLaunchMode)
            }
          >
            <option value="OFF">Off</option>
            <option value="INTERNAL_ONLY">Internal only</option>
            <option value="PILOT_ALLOWLIST">Pilot allowlist</option>
            <option value="GENERAL_AVAILABILITY">General availability</option>
          </select>
        </label>
        <label className="space-y-1 text-sm text-[var(--text-secondary)]">
          <span>Pilot client UUIDs, comma separated</span>
          <Input
            value={pilotIds}
            onChange={(event) => setPilotIds(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-[var(--text-secondary)]">
          <span>Decision owner</span>
          <Input
            value={decisionOwner}
            onChange={(event) => setDecisionOwner(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-[var(--text-secondary)]">
          <span>Rollback owner</span>
          <Input
            value={rollbackOwner}
            onChange={(event) => setRollbackOwner(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-[var(--text-secondary)] md:col-span-2">
          <span>Decision reason</span>
          <textarea
            className="min-h-24 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-primary)]"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <Button
          className="min-h-11 md:col-span-2"
          disabled={
            reason.trim().length < 10 ||
            !decisionOwner.trim() ||
            !rollbackOwner.trim()
          }
          onClick={submit}
        >
          {busy ? "Recording…" : "Record release decision"}
        </Button>
      </fieldset>
      {message ? (
        <p
          role="status"
          aria-atomic="true"
          className="mt-3 text-sm text-[var(--text-secondary)]"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
