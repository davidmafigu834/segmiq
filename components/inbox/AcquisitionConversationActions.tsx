"use client";

import { useState } from "react";
import Link from "next/link";
import type { InboxConversation } from "@/lib/inbox/types";

export function AcquisitionConversationActions({
  clientId,
  conversation,
}: {
  clientId: string;
  conversation: InboxConversation;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [key] = useState(() => `wa-${conversation.id}`);

  async function createOpportunity() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/acquisitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({
        contactId: conversation.contactId,
        ownerName: conversation.name,
        ownerPhone: conversation.phone,
        suburb: conversation.location,
        locationNotes: conversation.location ? null : "Location still to confirm from the conversation",
        intent: "sale",
        source: "whatsapp",
        leadId: conversation.id,
        notes: conversation.lastMessage?.slice(0, 500) ?? null,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not create the opportunity");
      return;
    }
    setOpportunityId(json.opportunity.id as string);
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-sales-text-secondary">
        This conversation is not treated as a buyer. Create a property opportunity only when you confirm they want to sell or let.
      </p>
      {opportunityId ? (
        <Link href={`/sales/acquisitions/${opportunityId}`} className="inline-flex min-h-11 items-center text-[12px] font-medium underline">
          Open opportunity
        </Link>
      ) : (
        <button type="button" disabled={busy} onClick={() => void createOpportunity()} className="min-h-11 rounded-md border border-sales-border px-3 text-[12px]">
          {busy ? "Creating…" : "Create property opportunity"}
        </button>
      )}
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
