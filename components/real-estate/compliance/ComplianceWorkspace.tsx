"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { SearchInput } from "@/components/sales/ui";
import { EmptyState } from "@/components/ui";
import { Badge } from "@/components/sales/ui";
import { WorkspaceUnderlineTabs } from "@/components/real-estate/workspace-chrome";
import { CompanyKpiCard } from "@/components/dashboard/company/CompanyKpiCard";
import { COMPLIANCE_RISK_LABEL, type ComplianceSettings } from "@/lib/real-estate/compliance";
import { ComplianceCasePanel } from "./ComplianceCasePanel";

type Tab = "attention" | "under_review" | "edd" | "approved" | "restricted" | "all";

type Row = {
  id: string;
  contactName: string;
  entityType: string;
  propertyLabel: string | null;
  agentName: string | null;
  reviewerName: string | null;
  docsReceived: number;
  docsRequired: number;
  riskLevel: string;
  status: string;
  statusLabel: string;
  submittedAt: string | null;
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "attention", label: "Needs attention" },
  { id: "under_review", label: "Under review" },
  { id: "edd", label: "Enhanced review" },
  { id: "approved", label: "Approved" },
  { id: "restricted", label: "Restricted" },
  { id: "all", label: "All" },
];

export function ComplianceWorkspace({
  clientId,
  initialTab = "attention",
}: {
  clientId: string;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState<Row[]>([]);
  const [summary, setSummary] = useState({
    needsReview: 0,
    awaitingDocuments: 0,
    enhancedReview: 0,
    restricted: 0,
    approvedThisMonth: 0,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [entityType, setEntityType] = useState("");
  const [risk, setRisk] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ tab });
    if (q.trim()) params.set("q", q.trim());
    if (entityType) params.set("entity_type", entityType);
    if (risk) params.set("risk", risk);
    const res = await fetch(`/api/clients/${clientId}/compliance/cases?${params.toString()}`);
    const j = (await res.json()) as { cases?: Row[]; summary?: typeof summary; canReview?: boolean };
    setCases(j.cases ?? []);
    if (j.summary) setSummary(j.summary);
    setCanReview(Boolean(j.canReview));
    setLoading(false);
  }, [clientId, tab, q, entityType, risk]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = [
    { label: "Needs review", value: summary.needsReview },
    { label: "Awaiting documents", value: summary.awaitingDocuments },
    { label: "Enhanced review", value: summary.enhancedReview },
    { label: "Restricted", value: summary.restricted },
    { label: "Approved this month", value: summary.approvedThisMonth },
  ];

  return (
    <div className="min-w-0 w-full max-w-full space-y-3">
      <div className="dashboard-group grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <CompanyKpiCard
            key={c.label}
            item={{
              id: c.label,
              label: c.label,
              value: String(c.value),
              supporting: "Live",
              icon: c.label.includes("Restricted") ? "followups" : "deals",
            }}
          />
        ))}
      </div>

      <section className="overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface shadow-sales-card">
      <WorkspaceUnderlineTabs items={TABS} value={tab} onChange={setTab} />

      <div className="flex flex-col gap-2 border-b border-sales-border-subtle px-4 py-3 sm:flex-row sm:px-5">
        <SearchInput value={q} onChange={setQ} placeholder="Search client, property, agent" />
        <select
          className="h-10 rounded-[10px] border border-sales-border bg-sales-surface px-2 text-[13px]"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="">All entities</option>
          <option value="individual">Individual</option>
          <option value="corporate">Corporate</option>
        </select>
        <select
          className="h-10 rounded-[10px] border border-sales-border bg-sales-surface px-2 text-[13px]"
          value={risk}
          onChange={(e) => setRisk(e.target.value)}
        >
          <option value="">All risk</option>
          <option value="unclassified">Unclassified</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {loading ? (
        <p className="px-4 py-8 text-[13px] text-sales-text-muted sm:px-5">Loading…</p>
      ) : cases.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No compliance cases yet"
          description="Cases appear here when an accepted offer starts client due diligence."
        />
      ) : (
        <ul className="divide-y divide-sales-border-subtle">
          {cases.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="w-full p-4 text-left hover:bg-sales-surface-hover"
                onClick={() => setOpenId(row.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">{row.contactName}</p>
                    <p className="text-[12px] capitalize text-sales-text-secondary">
                      {row.entityType}
                      {row.propertyLabel ? ` · ${row.propertyLabel}` : ""}
                    </p>
                  </div>
                  <Badge tone="neutral" appearance="soft">
                    {row.statusLabel}
                  </Badge>
                </div>
                <p className="mt-2 text-[12px] text-sales-text-secondary">
                  Documents {row.docsReceived} / {row.docsRequired}
                  {" · "}
                  Risk {COMPLIANCE_RISK_LABEL[row.riskLevel as "low"] ?? row.riskLevel}
                  {row.agentName ? ` · ${row.agentName}` : ""}
                </p>
                <p className="mt-2 text-[12px] font-medium">Review case</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      </section>

      {openId ? (
        <ComplianceCasePanel
          clientId={clientId}
          caseId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => void load()}
        />
      ) : null}

      {canReview ? <ComplianceSettingsPanel clientId={clientId} /> : null}
    </div>
  );
}

function ComplianceSettingsPanel({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ComplianceSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetch(`/api/clients/${clientId}/compliance/settings`)
      .then((r) => r.json())
      .then((j: { settings?: ComplianceSettings }) => setSettings(j.settings ?? null));
  }, [clientId, open]);

  async function save(next: Partial<ComplianceSettings>) {
    if (!settings) return;
    setSaving(true);
    const merged = { ...settings, ...next };
    const res = await fetch(`/api/clients/${clientId}/compliance/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(merged),
    });
    const j = (await res.json()) as { settings?: ComplianceSettings };
    if (j.settings) setSettings(j.settings);
    setSaving(false);
  }

  return (
    <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4">
      <button type="button" className="text-[13px] font-semibold" onClick={() => setOpen((v) => !v)}>
        Compliance settings
      </button>
      <p className="mt-1 text-[12px] text-sales-text-secondary">
        Workflow switches for LJP. These are not legal rules.
      </p>
      {open && settings ? (
        <div className="mt-3 space-y-2 text-[13px]">
          {(
            [
              ["require_cdd_after_accepted_offer", "Require CDD after an accepted offer"],
              ["require_approval_before_progression", "Require approval before a sale can complete"],
              ["allow_agents_to_start_cdd", "Allow agents to start CDD"],
              ["restrict_review_to_flagged_users", "Limit review to flagged compliance users"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                disabled={saving}
                onChange={(e) => void save({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
