"use client";

import { useState } from "react";
import Link from "next/link";
import type { InboxConversation } from "@/lib/inbox/types";

export function AcquisitionConversationActions({
  clientId,
  conversation,
  intent = "sale",
}: {
  clientId: string;
  conversation: InboxConversation;
  intent?: "sale" | "rent";
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [key] = useState(() => `wa-${conversation.id}-${intent}`);
  const letting = intent === "rent";

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
        intent,
        source: "whatsapp",
        leadId: conversation.id,
        notes: conversation.lastMessage?.slice(0, 500) ?? null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not create the opportunity");
      return;
    }
    setOpportunityId(json.opportunity.id as string);
    setConfirming(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-5 text-sales-text-secondary">
        {letting
          ? "This conversation is about a property to let. Creating an opportunity records it here and does not send a message."
          : "This conversation is about a property to sell. Creating an opportunity records it here and does not send a message."}
      </p>
      {opportunityId ? (
        <Link href={`/sales/acquisitions/${opportunityId}`} className="inline-flex min-h-11 items-center text-[13px] font-semibold underline">
          Open opportunity
        </Link>
      ) : confirming ? (
        <div className="space-y-2 border-t border-sales-border-subtle pt-3">
          <p className="text-[13px] font-medium text-sales-text-primary">
            {letting ? "Create a letting opportunity for this customer?" : "Create a sale opportunity for this customer?"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void createOpportunity()} className="min-h-11 rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface disabled:opacity-50">
              {busy ? "Creating…" : "Confirm opportunity"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="min-h-11 px-3 text-[13px] font-semibold text-sales-text-secondary">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="min-h-11 rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold text-sales-text-primary">
          {letting ? "Create letting opportunity" : "Create property opportunity"}
        </button>
      )}
      {error ? <p className="text-[12px] text-sales-danger">{error}</p> : null}
    </div>
  );
}
