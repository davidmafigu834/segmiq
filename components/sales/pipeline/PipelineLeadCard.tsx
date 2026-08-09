"use client";

import { useState } from "react";
import { ArrowRightLeft, ChevronRight, CircleUserRound, Phone, Plus, Star } from "lucide-react";
import type { MouseEvent } from "react";
import { SiFacebook, SiWhatsapp } from "react-icons/si";
import { isFacebookInstantFormLead } from "@/lib/leads/facebook-lead-display";
import { isWhatsAppInboundLead, whatsappInboxHref } from "@/lib/leads/whatsapp-lead-display";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import {
  budgetDisplayText,
  serviceDisplayText,
  timeAgo,
  type SalesLeadCardLead,
} from "@/lib/sales-priority-lead";
import { getLeadSubtitle } from "@/lib/sales/sales-dashboard-display";
import {
  PIPELINE_ACTIVE_STAGES,
  PIPELINE_STAGE_LABEL,
  formatLeadIntent,
  type PipelineActiveStage,
} from "@/lib/sales/pipeline-display";
import { useRouter } from "next/navigation";
import { isActiveConvertLaterPick } from "@/lib/convert-later-picks";
import type { LeadRow } from "@/types";

function sourceMeta(lead: SalesLeadCardLead): {
  kind: "whatsapp" | "facebook" | "contact";
  label: string;
} {
  if (isWhatsAppInboundLead(lead.source)) return { kind: "whatsapp", label: "WA" };
  if (isFacebookInstantFormLead(lead.source)) return { kind: "facebook", label: "FB Form" };
  return { kind: "contact", label: "Contact" };
}

export function PipelineLeadCard({
  lead,
  repName,
  intentScore,
  compact = false,
  onOpenLogSheet,
  onOpenLead,
  onLeadUpdated,
}: {
  lead: SalesLeadCardLead & {
    is_convert_later_pick?: boolean | null;
    email?: string | null;
    updated_at?: string;
  };
  repName: string;
  intentScore?: number | null;
  compact?: boolean;
  onOpenLogSheet: (leadId: string, channel?: "call" | "whatsapp") => void;
  onOpenLead: (leadId: string) => void;
  onLeadUpdated?: (lead: SalesLeadCardLead & { is_convert_later_pick?: boolean | null }) => void;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const source = sourceMeta(lead);
  const name = lead.name?.trim() || "Unnamed lead";
  const phone = lead.phone?.trim() ?? "";
  const subtitle = getLeadSubtitle(lead);
  const budget = budgetDisplayText(lead);
  const service = serviceDisplayText(lead);
  const score = intentScore ?? lead.aiScore ?? null;
  const intent = formatLeadIntent(score);
  const picked = isActiveConvertLaterPick(lead as LeadRow);
  const relative = timeAgo(lead.updated_at || lead.created_at);

  const budgetIntentLine = [budget, intent?.label].filter(Boolean).join(" · ");
  const sourceTimeLine = `${source.label} · ${relative}`;

  async function togglePick(e: MouseEvent) {
    e.stopPropagation();
    if (picking || !onLeadUpdated) return;
    setPicking(true);
    const next = !picked;
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_convert_later_pick: next }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        lead?: SalesLeadCardLead & { is_convert_later_pick?: boolean | null };
      };
      if (res.ok && json.lead) onLeadUpdated(json.lead);
    } finally {
      setPicking(false);
    }
  }

  async function handleWhatsApp(e: MouseEvent) {
    e.stopPropagation();
    if (source.kind === "whatsapp") {
      router.push(whatsappInboxHref(lead.id));
      return;
    }
    if (!phone) return;
    await openWhatsAppAndLog({
      leadId: lead.id,
      clientId: lead.client_id,
      leadName: lead.name,
      leadPhone: phone,
      repName,
      formData: lead.form_data,
      tier: "neutral",
    });
    onOpenLogSheet(lead.id, "whatsapp");
  }

  async function handleMoveStage(e: MouseEvent, next: PipelineActiveStage) {
    e.stopPropagation();
    if (moving || !onLeadUpdated || next === lead.status) {
      setMoveOpen(false);
      return;
    }
    setMoving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        lead?: SalesLeadCardLead & { is_convert_later_pick?: boolean | null };
      };
      if (res.ok && json.lead) onLeadUpdated(json.lead);
    } finally {
      setMoving(false);
      setMoveOpen(false);
    }
  }

  const btn =
    "inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#E4E7EC] bg-white text-[#667085] transition-colors duration-150 hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF4F] disabled:opacity-40";

  const moveTargets = PIPELINE_ACTIVE_STAGES.filter((s) => s !== lead.status);

  return (
    <article
      className={`group relative overflow-hidden rounded-[12px] border border-[#E4E7EC] bg-white transition-[border-color,box-shadow] duration-150 hover:border-[#D0D5DD] hover:shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${
        compact ? "p-3" : "p-3.5"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#F8F9FB]">
          {source.kind === "whatsapp" ? (
            <SiWhatsapp size={14} color="#25D366" aria-hidden />
          ) : source.kind === "facebook" ? (
            <SiFacebook size={14} color="#1877F2" aria-hidden />
          ) : (
            <CircleUserRound size={14} strokeWidth={1.8} className="text-[#667085]" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => onOpenLead(lead.id)}
              className="min-w-0 flex-1 text-left"
            >
              <h3 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#101828]" title={name}>
                {name}
              </h3>
              {phone ? (
                <p className="mt-0.5 truncate font-mono text-[11px] text-[#98A2B3]">{phone}</p>
              ) : null}
            </button>
            {onLeadUpdated ? (
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-[#98A2B3] transition-colors hover:text-[#F59E0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF4F]"
                aria-label={picked ? `Remove ${name} from picks` : `Save ${name} to picks`}
                disabled={picking}
                onClick={togglePick}
              >
                <Star
                  size={15}
                  strokeWidth={1.8}
                  className={picked ? "text-[#F59E0B]" : undefined}
                  fill={picked ? "currentColor" : "none"}
                />
              </button>
            ) : null}
          </div>

          {subtitle ? (
            <p className="mt-1.5 truncate text-[12px] text-[#667085]" title={subtitle}>
              {subtitle}
            </p>
          ) : service ? (
            <p className="mt-1.5 truncate text-[12px] text-[#667085]">{service}</p>
          ) : null}

          {budgetIntentLine ? (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[#667085]">
              {budget ? <span className="tabular-nums">{budget}</span> : null}
              {budget && intent ? <span className="text-[#D0D5DD]">·</span> : null}
              {intent ? (
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: intent.dot }}
                    aria-hidden
                  />
                  {intent.label}
                </span>
              ) : null}
            </p>
          ) : null}

          <p className="mt-1 text-[11px] text-[#98A2B3]">{sourceTimeLine}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-[#E4E7EC] pt-2.5">
        <button
          type="button"
          className={btn}
          aria-label={`Message ${name} on WhatsApp`}
          title="Message on WhatsApp"
          disabled={source.kind !== "whatsapp" && !phone}
          onClick={handleWhatsApp}
        >
          <SiWhatsapp size={15} color="#25D366" aria-hidden />
        </button>
        {phone ? (
          <a
            href={`tel:${phone}`}
            className={btn}
            aria-label={`Call ${name}`}
            title="Call customer"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone size={15} strokeWidth={1.8} aria-hidden />
          </a>
        ) : (
          <button type="button" className={btn} disabled aria-label="No phone number">
            <Phone size={15} strokeWidth={1.8} aria-hidden />
          </button>
        )}
        <button
          type="button"
          className={btn}
          aria-label={`Log call for ${name}`}
          title="Log call"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLogSheet(lead.id, "call");
          }}
        >
          <Plus size={15} strokeWidth={1.8} aria-hidden />
        </button>
        {onLeadUpdated && moveTargets.length > 0 ? (
          <div className="relative layout:hidden">
            <button
              type="button"
              className={btn}
              aria-label={`Move ${name} to another stage`}
              title="Move stage"
              aria-expanded={moveOpen}
              disabled={moving}
              onClick={(e) => {
                e.stopPropagation();
                setMoveOpen((v) => !v);
              }}
            >
              <ArrowRightLeft size={15} strokeWidth={1.8} aria-hidden />
            </button>
            {moveOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-20"
                  aria-label="Close move menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMoveOpen(false);
                  }}
                />
                <div
                  role="menu"
                  className="absolute bottom-full left-0 z-30 mb-1.5 w-44 overflow-hidden rounded-[10px] border border-[#E4E7EC] bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.1)]"
                >
                  <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#98A2B3]">
                    Move to
                  </p>
                  {moveTargets.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      role="menuitem"
                      className="flex w-full px-3 py-2 text-left text-[13px] text-[#101828] hover:bg-[#F9FAFB]"
                      disabled={moving}
                      onClick={(e) => void handleMoveStage(e, stage)}
                    >
                      {PIPELINE_STAGE_LABEL[stage]}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          className={`${btn} ml-auto`}
          aria-label={`Open ${name}`}
          title="Open lead"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLead(lead.id);
          }}
        >
          <ChevronRight size={15} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </article>
  );
}
