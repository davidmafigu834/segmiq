import { ChevronRight, MessageCircle, Phone } from "lucide-react";
import { AvatarInitials, CrmCard } from "./crm";
import { leadDisplayName, timeAgo } from "../lib/format";
import { classifyLeadLane } from "../lib/lead-lanes";
import type { LeadRow } from "../lib/types";
import { buildOpenerMessage, dialPhone, openWhatsApp } from "../lib/whatsapp";

type Props = {
  lead: LeadRow;
  repName: string;
  companyName?: string;
  onOpen: (lead: LeadRow) => void;
  onLogCall: (lead: LeadRow, channel?: "call" | "whatsapp") => void;
};

export function LeadRowCard({ lead, repName, companyName, onOpen, onLogCall }: Props) {
  const name = leadDisplayName(lead.name);
  const firstName = name.split(/\s+/)[0] ?? name;
  const { lane } = classifyLeadLane(lead);
  const context =
    lane === "call_now"
      ? "Call now"
      : lane === "follow_ups" && lead.follow_up_date
        ? `Follow-up · ${timeAgo(lead.updated_at ?? lead.created_at)}`
        : timeAgo(lead.created_at);

  const score = lead.aiScore ?? lead.score ?? null;
  const heat = typeof score === "number" && score >= 60 ? "hot" : typeof score === "number" && score < 40 ? "cold" : "warm";

  return (
    <CrmCard className="flex w-full items-center gap-3 p-4" onClick={() => onOpen(lead)}>
      <AvatarInitials name={lead.name} heat={heat} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-ink-primary">{name}</p>
        <p className="truncate text-[13px] text-ink-tertiary">{context}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label={`WhatsApp ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            const msg = buildOpenerMessage({
              leadFirstName: firstName,
              repName,
              companyName,
            });
            if (openWhatsApp(lead.phone, msg)) onLogCall(lead, "whatsapp");
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366]/15 text-[#25D366]"
        >
          <MessageCircle size={20} />
        </button>
        <button
          type="button"
          aria-label={`Call ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            if (dialPhone(lead.phone)) onLogCall(lead, "call");
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-tertiary text-accent"
        >
          <Phone size={18} />
        </button>
        <ChevronRight size={18} className="text-ink-tertiary" />
      </div>
    </CrmCard>
  );
}
