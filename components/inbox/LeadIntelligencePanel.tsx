"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ChevronDown,
  DollarSign,
  MapPin,
  Phone,
  Sparkles,
  Tag,
  Target,
  Zap,
} from "lucide-react";
import { formatSource } from "@/lib/inbox/fetch-conversations";
import { scoreColor, scoreLabel } from "@/lib/inbox/scoring";
import type { InboxConversation } from "@/lib/inbox/types";
import { ScoreBreakdownBar } from "./ScoreBreakdownBar";

type Props = {
  conversation: InboxConversation | null;
  canReassign: boolean;
  salespeople: { id: string; name: string }[];
  onReassigned: () => void;
  open: boolean;
};

export function LeadIntelligencePanel({
  conversation,
  canReassign,
  salespeople,
  onReassigned,
  open,
}: Props) {
  const [briefing, setBriefing] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    if (!conversation?.id) return;
    let cancelled = false;
    setBriefing("");
    setSuggestion("");
    fetch(`/api/leads/${conversation.id}/briefing`)
      .then((r) => r.json())
      .then((d: { briefing?: string; suggestion?: string }) => {
        if (cancelled) return;
        if (d.briefing) setBriefing(d.briefing);
        if (d.suggestion) setSuggestion(d.suggestion);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversation?.id]);

  async function handleReassign(assigneeId: string | null) {
    if (!conversation) return;
    setReassigning(true);
    try {
      const res = await fetch("/api/leads/bulk/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: [conversation.id],
          assigned_to_id: assigneeId,
        }),
      });
      if (res.ok) {
        setReassignOpen(false);
        onReassigned();
      }
    } finally {
      setReassigning(false);
    }
  }

  if (!conversation) {
    return (
      <div
        id="intelPanel"
        className="flex w-[360px] shrink-0 items-center justify-center border-l border-[var(--border)] bg-[var(--bg-tertiary)] p-6 text-sm text-[var(--text-tertiary)] max-[1180px]:fixed max-[1180px]:bottom-0 max-[1180px]:right-0 max-[1180px]:top-16 max-[1180px]:z-40 max-[1180px]:w-[340px] max-[1180px]:shadow-[-12px_0_30px_rgba(0,0,0,0.6)] max-[1180px]:transition-transform max-[1180px]:duration-200 max-[1180px]:translate-x-full"
      >
        Select a conversation
      </div>
    );
  }

  const color = scoreColor(conversation.score);
  const label = scoreLabel(conversation.score);
  const summary = conversation.leadSummary || briefing;
  const nextAction = suggestion || "Review lead details and take the next step.";
  const slaActive =
    conversation.status === "NEW" &&
    Date.now() - new Date(conversation.createdAt).getTime() < 5 * 60 * 1000;

  return (
    <div
      id="intelPanel"
      className={[
        "w-[360px] shrink-0 overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-tertiary)]",
        "max-[1180px]:fixed max-[1180px]:bottom-0 max-[1180px]:right-0 max-[1180px]:top-16 max-[1180px]:z-40 max-[1180px]:w-[340px] max-[1180px]:shadow-[-12px_0_30px_rgba(0,0,0,0.6)] max-[1180px]:transition-transform max-[1180px]:duration-200",
        open ? "max-[1180px]:translate-x-0" : "max-[1180px]:translate-x-full",
      ].join(" ")}
    >
      <div className="ag-fade-in flex flex-col gap-5 p-5">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5 text-center">
          <div className="mb-2 text-xs uppercase tracking-wide text-[var(--text-tertiary)]">
            Lead Intent Score
          </div>
          <div
            className="text-5xl font-normal"
            style={{ fontFamily: "var(--font-instrument-serif)", color }}
          >
            {conversation.score}
          </div>
          <div
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: `${color}22`, color }}
          >
            {label} Lead
          </div>
          {slaActive ? (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[var(--error)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--error)]" />
              5-min SLA active
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Score Breakdown
          </div>
          <ScoreBreakdownBar label="Urgency" value={conversation.breakdown.urgency} max={25} icon={Zap} />
          <ScoreBreakdownBar label="Budget" value={conversation.breakdown.budget} max={25} icon={DollarSign} />
          <ScoreBreakdownBar label="Location" value={conversation.breakdown.location} max={15} icon={MapPin} />
          <ScoreBreakdownBar
            label="Product Interest"
            value={conversation.breakdown.productInterest}
            max={20}
            icon={Target}
          />
          <ScoreBreakdownBar
            label="Engagement"
            value={conversation.breakdown.engagement}
            max={15}
            icon={Activity}
          />
        </div>

        {summary ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              <Sparkles size={14} />
              AI Qualification
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{summary}</p>
          </div>
        ) : null}

        <div
          className="rounded-xl p-5"
          style={{
            background: "rgba(212,255,79,0.08)",
            border: "1px solid rgba(212,255,79,0.25)",
          }}
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            Suggested Next Action
          </div>
          <p className="mb-3 text-sm text-[var(--text-primary)]">{nextAction}</p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Assignment
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--text-primary)]">
              {conversation.assignee?.name ?? "Unassigned"}
            </span>
            {canReassign ? (
              <button
                type="button"
                onClick={() => setReassignOpen((v) => !v)}
                className="flex cursor-pointer items-center gap-1 text-xs text-[var(--text-tertiary)]"
              >
                Reassign
                <ChevronDown size={14} />
              </button>
            ) : null}
          </div>
          {reassignOpen && canReassign ? (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                disabled={reassigning}
                onClick={() => void handleReassign(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
              >
                Unassigned (pool)
              </button>
              {salespeople.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  disabled={reassigning}
                  onClick={() => void handleReassign(sp.id)}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-left text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                >
                  {sp.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Contact Details
          </div>
          {conversation.phone ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Phone size={14} />
              {conversation.phone}
            </div>
          ) : null}
          {conversation.location ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <MapPin size={14} />
              {conversation.location}
            </div>
          ) : null}
          {conversation.projectType ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Target size={14} />
              {conversation.projectType}
            </div>
          ) : null}
          <div className="text-sm text-[var(--text-secondary)]">
            Source: {formatSource(conversation.source as string)}
          </div>
        </div>

        {conversation.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {conversation.tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-full bg-[var(--bg-quaternary)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
              >
                <Tag size={10} />
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
