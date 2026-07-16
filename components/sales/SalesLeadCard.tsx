"use client";

import { isFacebookInstantFormLead } from "@/lib/leads/facebook-lead-display";
import { isContactLeadCardSource } from "@/lib/leads/contact-lead-display";
import { isWhatsAppInboundLead } from "@/lib/leads/whatsapp-lead-display";
import { WhatsAppLeadCard } from "@/components/sales/WhatsAppLeadCard";
import { FacebookLeadCard } from "@/components/sales/FacebookLeadCard";
import { ContactLeadCard } from "@/components/sales/ContactLeadCard";
import type { LeadLane } from "@/lib/lead-lanes";
import type { SalesLeadCardLead } from "@/lib/sales-priority-lead";

export function SalesLeadCard({
  lead,
  lane,
  now = new Date(),
  repName,
  intentScore,
  clientSlaHours,
  onOpenLogSheet,
  onOpenLead,
  onOpenSend,
  compact = false,
  className = "",
}: {
  lead: SalesLeadCardLead;
  lane?: LeadLane;
  now?: Date;
  repName: string;
  intentScore?: number | null;
  clientSlaHours?: number | null;
  onOpenLogSheet: (leadId: string, channel?: "call" | "whatsapp") => void;
  onOpenLead: (leadId: string) => void;
  onOpenSend: (leadId: string) => void;
  compact?: boolean;
  className?: string;
}) {
  if (isFacebookInstantFormLead(lead.source)) {
    return (
      <FacebookLeadCard
        lead={lead}
        lane={lane}
        now={now}
        repName={repName}
        intentScore={intentScore}
        clientSlaHours={clientSlaHours}
        onOpenLogSheet={onOpenLogSheet}
        onOpenLead={onOpenLead}
        onOpenSend={onOpenSend}
        compact={compact}
        className={className}
      />
    );
  }

  if (isWhatsAppInboundLead(lead.source)) {
    return (
      <WhatsAppLeadCard
        lead={lead}
        lane={lane}
        now={now}
        intentScore={intentScore}
        clientSlaHours={clientSlaHours}
        onOpenLogSheet={onOpenLogSheet}
        onOpenLead={onOpenLead}
        compact={compact}
        className={className}
      />
    );
  }

  if (isContactLeadCardSource(lead.source)) {
    return (
      <ContactLeadCard
        lead={lead}
        lane={lane}
        now={now}
        repName={repName}
        intentScore={intentScore}
        clientSlaHours={clientSlaHours}
        onOpenLogSheet={onOpenLogSheet}
        onOpenLead={onOpenLead}
        onOpenSend={onOpenSend}
        compact={compact}
        className={className}
      />
    );
  }

  return (
    <ContactLeadCard
      lead={lead}
      lane={lane}
      now={now}
      repName={repName}
      intentScore={intentScore}
      clientSlaHours={clientSlaHours}
      onOpenLogSheet={onOpenLogSheet}
      onOpenLead={onOpenLead}
      onOpenSend={onOpenSend}
      compact={compact}
      className={className}
    />
  );
}
