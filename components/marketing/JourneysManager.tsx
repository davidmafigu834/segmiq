"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Route, Zap } from "lucide-react";
import { MarketingHubTabs } from "./MarketingHubTabs";

type Journey = {
  id: string;
  name: string;
  description: string | null;
  template_key: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: { type: string; config?: Record<string, unknown> }[];
  template_name: string | null;
  template_language: string;
  is_active: boolean;
  stats: {
    enrolled: number;
    completed: number;
    cancelled: number;
    messages_sent: number;
  };
};

type MetaTemplate = {
  name: string;
  language: string;
};

const TRIGGER_LABELS: Record<string, string> = {
  quotation_no_response: "Quotation sent, no reply",
  dormant_lead: "Dormant pipeline lead",
  customer_anniversary: "Customer anniversary",
  lost_deal_funds: "Lost deal — waiting on funds",
};

export function JourneysManager({ clientId }: { clientId: string }) {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [journeysRes, templatesRes] = await Promise.all([
        fetch(`/api/clients/${clientId}/marketing/journeys`),
        fetch(`/api/clients/${clientId}/marketing/templates`),
      ]);
      const journeysData = await journeysRes.json();
      const templatesData = await templatesRes.json();

      if (!journeysRes.ok) {
        setError(journeysData.error ?? "Failed to load journeys");
        return;
      }

      setJourneys(journeysData.journeys ?? []);
      setTemplates(templatesData.templates ?? []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateJourney(
    journeyId: string,
    patch: {
      is_active?: boolean;
      template_name?: string | null;
      template_language?: string;
    }
  ) {
    setSavingId(journeyId);
    setError(null);

    const res = await fetch(`/api/clients/${clientId}/marketing/journeys/${journeyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Update failed");
      setSavingId(null);
      return;
    }

    setJourneys((prev) =>
      prev.map((j) => (j.id === journeyId ? { ...j, ...data.journey } : j))
    );
    setSavingId(null);
  }

  function handleTemplateChange(journey: Journey, templateName: string) {
    const tpl = templates.find((t) => t.name === templateName);
    updateJourney(journey.id, {
      template_name: templateName || null,
      template_language: tpl?.language ?? journey.template_language,
    });
  }

  const activeCount = journeys.filter((j) => j.is_active).length;

  return (
    <div>
      <MarketingHubTabs />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">SegmiQ Journeys</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            Automated WhatsApp sequences triggered by CRM events — quotation follow-ups, dormant
            leads, anniversaries, and lost-deal recovery.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
          <span className="text-[var(--text-tertiary)]">Active journeys</span>
          <span className="ml-2 font-semibold text-[var(--text-primary)]">{activeCount}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="shimmer h-48 rounded-xl" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {journeys.map((journey) => (
            <JourneyCard
              key={journey.id}
              journey={journey}
              templates={templates}
              saving={savingId === journey.id}
              onToggle={(active) => updateJourney(journey.id, { is_active: active })}
              onTemplateChange={(name) => handleTemplateChange(journey, name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JourneyCard({
  journey,
  templates,
  saving,
  onToggle,
  onTemplateChange,
}: {
  journey: Journey;
  templates: MetaTemplate[];
  saving: boolean;
  onToggle: (active: boolean) => void;
  onTemplateChange: (name: string) => void;
}) {
  const stats = journey.stats ?? {
    enrolled: 0,
    completed: 0,
    cancelled: 0,
    messages_sent: 0,
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-[rgba(212,255,79,0.12)] p-2">
            <Route className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">{journey.name}</h3>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              {TRIGGER_LABELS[journey.trigger_type] ?? journey.trigger_type}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => onToggle(!journey.is_active)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
            journey.is_active
              ? "bg-[rgba(212,255,79,0.15)] text-[var(--accent)]"
              : "bg-[var(--surface-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          }`}
        >
          {journey.is_active ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active
            </>
          ) : (
            <>
              <Circle className="h-3.5 w-3.5" />
              Inactive
            </>
          )}
        </button>
      </div>

      {journey.description && (
        <p className="mb-4 text-sm text-[var(--text-secondary)]">{journey.description}</p>
      )}

      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-[var(--text-tertiary)]">
          WhatsApp template
        </label>
        <select
          value={journey.template_name ?? ""}
          disabled={saving}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="">Select approved template…</option>
          {templates.map((t) => (
            <option key={`${t.name}-${t.language}`} value={t.name}>
              {t.name} ({t.language})
            </option>
          ))}
        </select>
        {!journey.template_name && (
          <p className="mt-1.5 text-xs text-[var(--warning)]">
            Assign a template before activating this journey.
          </p>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {journey.steps.map((step, i) => (
          <span
            key={`${step.type}-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-elevated)] px-2 py-1 text-xs text-[var(--text-secondary)]"
          >
            {step.type === "send_whatsapp" && <Zap className="h-3 w-3" />}
            {formatStepLabel(step)}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 border-t border-[var(--border)] pt-4 text-center">
        <Stat label="Enrolled" value={stats.enrolled} />
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Cancelled" value={stats.cancelled} />
        <Stat label="Messages" value={stats.messages_sent} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-semibold text-[var(--text-primary)]">{value}</div>
      <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    </div>
  );
}

function formatStepLabel(step: { type: string; config?: Record<string, unknown> }): string {
  switch (step.type) {
    case "send_whatsapp":
      return "Send WhatsApp";
    case "wait_days":
      return `Wait ${step.config?.days ?? 1}d`;
    case "check_still_eligible":
      return "Check eligibility";
    case "notify_assignee":
      return "Notify salesperson";
    case "complete":
      return "Complete";
    default:
      return step.type;
  }
}
