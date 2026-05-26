"use client";

import { useEffect, useState } from "react";
import {
  Zap,
  Clock,
  DollarSign,
  MapPin,
  Target,
  Tag,
  RefreshCw,
  User,
} from "lucide-react";

type Intelligence = {
  intent_category: string;
  intent_subcategory: string | null;
  urgency_level: string;
  budget_confidence: string;
  budget_estimate_usd: number | null;
  project_specificity: string;
  is_likely_decision_maker: boolean;
  property_type: string | null;
  location_extracted: string | null;
  tags: string[];
  intent_score: number;
  lead_summary: string;
  processed_at: string;
};

type Props = {
  leadId: string;
  canReprocess?: boolean;
};

const URGENCY_LABELS: Record<string, { label: string; colour: string }> = {
  immediate: { label: "Immediate", colour: "var(--error)" },
  soon: { label: "Soon", colour: "var(--warning)" },
  planning: { label: "Planning", colour: "#60a5fa" },
  exploring: { label: "Exploring", colour: "var(--text-tertiary)" },
  unknown: { label: "Unknown", colour: "var(--text-disabled)" },
};

const SPECIFICITY_LABELS: Record<string, { label: string; colour: string }> = {
  high: { label: "High specificity", colour: "var(--success)" },
  medium: { label: "Medium specificity", colour: "var(--warning)" },
  low: { label: "Low specificity", colour: "var(--text-tertiary)" },
  unknown: { label: "Unknown", colour: "var(--text-disabled)" },
};

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatTag(tag: string): string {
  return tag.replace(/_/g, " ");
}

function IntentScoreBar({ score }: { score: number }) {
  const colour =
    score >= 70
      ? "var(--success)"
      : score >= 40
      ? "var(--warning)"
      : "var(--error)";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-[5px] rounded-full bg-[var(--bg-quaternary)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${score}%`, background: colour }}
        />
      </div>
      <span
        className="text-[15px] font-semibold w-8 text-right shrink-0"
        style={{
          fontFamily: "var(--font-instrument-serif)",
          color: colour,
        }}
      >
        {score}
      </span>
    </div>
  );
}

export function LeadIntelligenceCard({ leadId, canReprocess = false }: Props) {
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leads/${leadId}/intelligence`)
      .then((r) => r.json())
      .then((data: { intelligence?: Intelligence | null }) => {
        if (cancelled) return;
        setIntelligence(data.intelligence ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function handleReprocess() {
    setReprocessing(true);
    try {
      await fetch(`/api/leads/${leadId}/intelligence`, { method: "POST" });
      const res = await fetch(`/api/leads/${leadId}/intelligence`);
      const data = (await res.json()) as { intelligence?: Intelligence | null };
      setIntelligence(data.intelligence ?? null);
    } catch {
      // silent
    } finally {
      setReprocessing(false);
    }
  }

  if (error) return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-[var(--bg-quaternary)] animate-pulse" />
          <div className="h-3 w-24 rounded bg-[var(--bg-quaternary)] animate-pulse" />
        </div>
        <div className="space-y-2">
          {[80, 60, 70].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded bg-[var(--bg-quaternary)] animate-pulse"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!intelligence) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[var(--text-disabled)]" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
              Lead intelligence
            </p>
          </div>
          {canReprocess && (
            <button
              onClick={() => void handleReprocess()}
              disabled={reprocessing}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={11}
                className={reprocessing ? "animate-spin" : ""}
              />
              {reprocessing ? "Processing..." : "Process now"}
            </button>
          )}
        </div>
        <p className="text-[12px] text-[var(--text-tertiary)]">
          Intelligence not yet processed. Will be available shortly.
        </p>
      </div>
    );
  }

  const urgency =
    URGENCY_LABELS[intelligence.urgency_level] ?? URGENCY_LABELS.unknown;
  const specificity =
    SPECIFICITY_LABELS[intelligence.project_specificity] ??
    SPECIFICITY_LABELS.unknown;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-[rgba(212,255,79,0.1)] border border-[rgba(212,255,79,0.2)] flex items-center justify-center">
            <Zap size={11} className="text-[var(--accent)]" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Lead intelligence
          </p>
        </div>
        {canReprocess && (
          <button
            onClick={() => void handleReprocess()}
            disabled={reprocessing}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={11}
              className={reprocessing ? "animate-spin" : ""}
            />
            {reprocessing ? "Reprocessing..." : "Reprocess"}
          </button>
        )}
      </div>

      {/* AI Summary */}
      {intelligence.lead_summary && (
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
          {intelligence.lead_summary}
        </p>
      )}

      {/* Intent score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
            Intent score
          </p>
        </div>
        <IntentScoreBar score={intelligence.intent_score} />
      </div>

      {/* Signal pills row */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Intent category */}
        {intelligence.intent_category &&
          intelligence.intent_category !== "unknown" && (
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[11px] font-semibold text-[var(--text-secondary)]">
              <Target size={10} className="text-[var(--accent)]" />
              {formatCategory(intelligence.intent_category)}
            </span>
          )}

        {/* Urgency */}
        {intelligence.urgency_level !== "unknown" && (
          <span
            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[11px] font-semibold"
            style={{
              color: urgency.colour,
              borderColor: `color-mix(in srgb, ${urgency.colour} 35%, transparent)`,
              background: `color-mix(in srgb, ${urgency.colour} 10%, transparent)`,
            }}
          >
            <Clock size={10} />
            {urgency.label}
          </span>
        )}

        {/* Specificity */}
        {intelligence.project_specificity !== "unknown" && (
          <span
            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[11px] font-semibold"
            style={{
              color: specificity.colour,
              borderColor: `color-mix(in srgb, ${specificity.colour} 35%, transparent)`,
              background: `color-mix(in srgb, ${specificity.colour} 10%, transparent)`,
            }}
          >
            <Target size={10} />
            {specificity.label}
          </span>
        )}

        {/* Decision maker */}
        {intelligence.is_likely_decision_maker && (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-[rgba(212,255,79,0.3)] bg-[rgba(212,255,79,0.08)] text-[11px] font-semibold text-[var(--accent)]">
            <User size={10} />
            Decision maker
          </span>
        )}

        {/* Budget */}
        {intelligence.budget_estimate_usd && (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[11px] font-semibold text-[var(--text-secondary)]">
            <DollarSign size={10} className="text-[var(--success)]" />
            ~${intelligence.budget_estimate_usd.toLocaleString()}
          </span>
        )}

        {/* Location */}
        {intelligence.location_extracted && (
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[11px] font-semibold text-[var(--text-secondary)]">
            <MapPin size={10} style={{ color: "#60a5fa" }} />
            {intelligence.location_extracted}
          </span>
        )}
      </div>

      {/* Tags */}
      {intelligence.tags && intelligence.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {intelligence.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[var(--bg-quaternary)] text-[10px] font-medium text-[var(--text-tertiary)]"
            >
              <Tag size={8} />
              {formatTag(tag)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
