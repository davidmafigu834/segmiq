"use client";

import { useRouter } from "next/navigation";
import type { LeadLane } from "@/lib/lead-lanes";
import type { PriorityLead } from "@/lib/sales-priority-lead";
import { SalesLeadCard } from "@/components/sales/SalesLeadCard";

/** @deprecated Use SalesLeadCard — thin wrapper for dashboard lane pages. */
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

  return (
    <SalesLeadCard
      lead={lead}
      lane={lane}
      now={now}
      repName={repName}
      intentScore={lead.aiScore ?? null}
      onOpenLogSheet={onOpenLogSheet}
      onOpenLead={(id) => router.push(`/sales/leads?lead=${id}`)}
      onOpenSend={(id) => router.push(`/sales/leads?lead=${id}&tab=send`)}
    />
  );
}
