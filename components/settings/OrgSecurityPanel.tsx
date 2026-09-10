"use client";

import { useCallback, useEffect, useState } from "react";
import { SettingsSectionCard } from "@/components/dashboard/company/settings/SettingsSectionCard";
import { Button, Field } from "@/components/sales/ui";
import { usePermissions } from "@/hooks/usePermissions";
import { P } from "@/lib/auth/rbac/permissions";
import type { OrgMfaRequirement, OrgSecurityPolicy } from "@/lib/auth/org-security-policy";

type AuditItem = {
  id: string;
  type: string;
  createdAt: string;
  summary: string;
};

export function OrgSecurityPanel({
  toast,
}: {
  toast: (opts: { title: string; tone?: "success" | "error" }) => void;
}) {
  const { can, ready } = usePermissions();
  const canManage = can(P.SECURITY_SETTINGS_MANAGE);
  const canAudit = can(P.SECURITY_AUDIT_READ);

  const [policy, setPolicy] = useState<OrgSecurityPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<AuditItem[]>([]);
  const [stepUpHint, setStepUpHint] = useState("");

  const load = useCallback(async () => {
    if (!canManage && !canAudit) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (canManage || canAudit) {
        const pRes = await fetch("/api/org/security-policy", { cache: "no-store" });
        if (pRes.ok) {
          const j = (await pRes.json()) as { policy: OrgSecurityPolicy };
          setPolicy(j.policy);
        }
      }
      if (canAudit) {
        const aRes = await fetch("/api/org/security-audit?limit=20", { cache: "no-store" });
        if (aRes.ok) {
          const j = (await aRes.json()) as { events?: AuditItem[] };
          setEvents(j.events ?? []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [canManage, canAudit]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function savePolicy() {
    if (!policy || !canManage) return;
    setSaving(true);
    setStepUpHint("");
    try {
      const res = await fetch("/api/org/security-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; policy?: OrgSecurityPolicy };
      if (res.status === 403 && data.error?.toLowerCase().includes("elevat")) {
        setStepUpHint("Confirm your identity in Security (step-up), then try again.");
        toast({ title: "Security verification required", tone: "error" });
        return;
      }
      if (!res.ok) {
        toast({ title: data.error || "Could not save policy", tone: "error" });
        return;
      }
      if (data.policy) setPolicy(data.policy);
      toast({ title: "Organisation security policy saved", tone: "success" });
      void load();
    } finally {
      setSaving(false);
    }
  }

  async function exportAudit() {
    setStepUpHint("");
    const res = await fetch("/api/org/security-audit?format=csv&limit=100", { cache: "no-store" });
    if (res.status === 403) {
      setStepUpHint("Confirm your identity (step-up), then export again.");
      toast({ title: "Security verification required", tone: "error" });
      return;
    }
    if (!res.ok) {
      toast({ title: "Export failed", tone: "error" });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "org-security-audit.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready || loading) {
    return (
      <SettingsSectionCard title="Organisation security" description="Loading…">
        <p className="text-[13px] text-sales-text-secondary">Loading organisation controls…</p>
      </SettingsSectionCard>
    );
  }

  if (!canManage && !canAudit) return null;

  return (
    <div className="space-y-8">
      {canManage && policy ? (
        <SettingsSectionCard
          title="Organisation policy"
          description="Require MFA, session lifetimes, and export controls for this company."
        >
          <div className="space-y-4">
            <Field label="Two-step verification requirement">
              <select
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px]"
                value={policy.mfaRequirement}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    mfaRequirement: e.target.value as OrgMfaRequirement,
                  })
                }
              >
                <option value="off">Off (recommended defaults only)</option>
                <option value="managers">Managers required</option>
                <option value="all">Everyone required</option>
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Idle timeout (hours, 1–24)">
                <input
                  type="number"
                  min={1}
                  max={24}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px]"
                  value={policy.idleTtlHours ?? ""}
                  placeholder="Default"
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setPolicy({
                      ...policy,
                      idleTtlHours: v === "" ? null : Number(v),
                    });
                  }}
                />
              </Field>
              <Field label="Absolute session (hours, 8–168)">
                <input
                  type="number"
                  min={8}
                  max={168}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px]"
                  value={policy.absoluteTtlHours ?? ""}
                  placeholder="Default"
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setPolicy({
                      ...policy,
                      absoluteTtlHours: v === "" ? null : Number(v),
                    });
                  }}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-sales-text-primary">
              <input
                type="checkbox"
                checked={policy.allowDataExports}
                onChange={(e) =>
                  setPolicy({ ...policy, allowDataExports: e.target.checked })
                }
              />
              Allow data exports
            </label>
            {stepUpHint ? (
              <p className="text-[12px] text-amber-700">{stepUpHint}</p>
            ) : null}
            <Button size="sm" onClick={() => void savePolicy()} disabled={saving}>
              {saving ? "Saving…" : "Save organisation policy"}
            </Button>
          </div>
        </SettingsSectionCard>
      ) : null}

      {canAudit ? (
        <SettingsSectionCard
          title="Organisation audit log"
          description="Admin and security events for this company. Employee device IPs are not shown."
        >
          <ul className="space-y-3">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-sales-text-primary">{ev.summary}</span>
                <span className="shrink-0 text-[12px] text-sales-text-muted">
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
            {events.length === 0 ? (
              <li className="text-[13px] text-sales-text-secondary">No organisation audit events yet.</li>
            ) : null}
          </ul>
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={() => void exportAudit()}>
              Export CSV
            </Button>
          </div>
        </SettingsSectionCard>
      ) : null}
    </div>
  );
}
