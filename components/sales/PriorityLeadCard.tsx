"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  PhoneOff,
  Send,
  Activity,
  MessageCircle,
  Clock,
  AlertTriangle,
  MinusCircle,
} from "lucide-react";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import {
  classifyLeadLane,
  computeRulesScore,
  matchesQualifiers,
  HIGH_SCORE_THRESHOLD,
  type LeadLane,
} from "@/lib/lead-lanes";
import {
  type PriorityLead,
  timeAgo,
  formatFollowUpDate,
  daysSince,
  reasonSegments,
} from "@/lib/sales-priority-lead";

const SLA_TARGET_MS = 5 * 60 * 1000;

const LANE_META: Record<LeadLane, { accentBorder: string }> = {
  call_now: { accentBorder: "border-[var(--accent-border)]" },
  follow_ups: { accentBorder: "border-[var(--border)]" },
  recover: { accentBorder: "border-[var(--warning)]" },
  nurture: { accentBorder: "border-[var(--border)]" },
};

function SlaCountdown({ createdAt }: { createdAt: string }) {
  const [remainingMs, setRemainingMs] = useState(
    () => SLA_TARGET_MS - (Date.now() - new Date(createdAt).getTime())
  );

  useEffect(() => {
    const tick = () =>
      setRemainingMs(SLA_TARGET_MS - (Date.now() - new Date(createdAt).getTime()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  const breached = remainingMs <= 0;

  if (breached) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--warning)]">
        <Clock size={13} />
        SLA breached
      </span>
    );
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent)]">
      <Clock size={13} />
      SLA {mins}:{secs.toString().padStart(2, "0")} left
    </span>
  );
}

export function PriorityLeadCard({
  lead,
  lane,
  now,
  repName,
  onOpenLogSheet,
}: {
  lead: PriorityLead;
  lane: LeadLane;
  now: Date;
  repName: string;
  onOpenLogSheet: (leadId: string, channel?: "call" | "whatsapp") => void;
}) {
  const router = useRouter();
  const { tier } = classifyLeadLane(lead, now);
  const accent = LANE_META[lane].accentBorder;

  const aiScore = typeof lead.aiScore === "number" ? lead.aiScore : null;
  const showChip = aiScore !== null;
  const highScore = (aiScore ?? 0) >= HIGH_SCORE_THRESHOLD;

  const fit = matchesQualifiers(lead, lead.qualifiers ?? null);
  const rulesFactors = showChip
    ? []
    : computeRulesScore(lead, lead.qualifiers ?? null, now).factors;
  const reasonText =
    rulesFactors.length > 0
      ? rulesFactors.join(" · ")
      : reasonSegments(lead).join(" · ");

  return (
    <article className={`rounded-xl border ${accent} bg-[var(--surface-card)] p-5`}>
      <div
        className="cursor-pointer"
        onClick={() => router.push(`/sales/leads?lead=${lead.id}`)}
      >
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <p className="font-medium text-[var(--text-primary)] text-[15px] truncate">
            {lead.name ?? "Unknown"}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {fit.matched && (
              <span className="inline-flex items-center h-6 px-2 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-[var(--accent)] text-[var(--accent-foreground)]">
                Campaign fit
              </span>
            )}
            {showChip ? (
              <span
                className={`inline-flex items-center justify-center h-7 min-w-[28px] px-2 rounded-lg text-[15px] leading-none ${
                  highScore
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)]"
                }`}
                style={{ fontFamily: "var(--font-instrument-serif)" }}
                aria-label={`AI lead score ${aiScore}`}
              >
                {aiScore}
              </span>
            ) : (
              <span className="text-[12px] text-[var(--text-tertiary)]">
                {timeAgo(lead.created_at)}
              </span>
            )}
          </div>
        </div>

        <p className="text-[13px] text-[var(--text-secondary)] mb-4">{reasonText}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {lane === "call_now" && tier === "hot" ? (
            <SlaCountdown createdAt={lead.created_at} />
          ) : lane === "call_now" ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
              <Clock size={13} />
              Awaiting first call
            </span>
          ) : lane === "follow_ups" ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--warning)]">
              <Clock size={13} />
              Promised callback
              {lead.follow_up_date
                ? ` · ${formatFollowUpDate(lead.follow_up_date)}`
                : ""}
            </span>
          ) : lane === "recover" ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--warning)]">
              <AlertTriangle size={13} />
              Slipped {daysSince(lead.created_at)} days
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
              <MinusCircle size={13} />
              {lead.is_stale ? "Going cold" : "Low intent"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 sm:gap-2">
          {lead.phone ? (
            <a
              href={`tel:${lead.phone}`}
              className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--border-hover)] transition-colors"
            >
              <Phone size={15} className="text-[var(--success)]" />
            </a>
          ) : (
            <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center opacity-30">
              <PhoneOff size={15} className="text-[var(--text-disabled)]" />
            </div>
          )}

          {lead.phone ? (
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--border-hover)] transition-colors"
              onClick={() => {
                openWhatsAppAndLog({
                  leadId: lead.id,
                  clientId: lead.client_id,
                  leadName: lead.name,
                  leadPhone: lead.phone,
                  repName,
                  formData: undefined,
                  tier: "neutral",
                });
                onOpenLogSheet(lead.id, "whatsapp");
              }}
              aria-label="Message on WhatsApp"
            >
              <MessageCircle size={15} className="text-[var(--success)]" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center opacity-30">
              <MessageCircle size={15} className="text-[var(--text-disabled)]" />
            </div>
          )}

          <button
            type="button"
            onClick={() => onOpenLogSheet(lead.id)}
            className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors text-[var(--text-secondary)]"
          >
            <Activity size={14} />
          </button>

          <button
            type="button"
            onClick={() => router.push(`/sales/leads?lead=${lead.id}&tab=send`)}
            className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-colors text-[var(--text-secondary)]"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
