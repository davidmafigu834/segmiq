"use client";

import { useEffect, useMemo, useState } from "react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button, Field, Input, Select } from "@/components/sales/ui";
import {
  CALLBACK_SCHEDULE_LABELS,
  CALLBACK_SCHEDULE_OPTIONS,
  resolveCallbackAt,
  type CallbackScheduleOption,
} from "@/lib/call-log-constants";
import { listingLabel } from "@/lib/real-estate/helpers";
import { cn } from "@/lib/ui/cn";
import type { ViewingAgentOption, ViewingListingOption } from "./types";

type ContactOpt = { id: string; name: string | null; phone?: string | null };

function todayLocalISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function ScheduleViewingSheet({
  clientId,
  listings,
  agents,
  onClose,
  onCreated,
}: {
  clientId: string;
  listings: ViewingListingOption[];
  agents: ViewingAgentOption[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [listingId, setListingId] = useState(listings.length === 1 ? listings[0].id : "");
  const [contactId, setContactId] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState<ContactOpt[]>([]);
  const [agentId, setAgentId] = useState("");
  const [scheduleOption, setScheduleOption] = useState<CallbackScheduleOption | "">("");
  const [customCallback, setCustomCallback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduledAt = useMemo(() => {
    if (!scheduleOption) return null;
    if (scheduleOption === "pick" && !customCallback.trim()) return null;
    return resolveCallbackAt(scheduleOption, customCallback || undefined)?.toISOString() ?? null;
  }, [scheduleOption, customCallback]);

  useEffect(() => {
    const q = contactQuery.trim();
    if (q.length < 2) {
      setContacts([]);
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/contacts/list?q=${encodeURIComponent(q)}&limit=12`)
        .then((res) => res.json())
        .then((json: { contacts?: ContactOpt[] }) => setContacts(json.contacts ?? []))
        .catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [contactQuery]);

  async function save() {
    setError(null);
    if (!contactId) {
      setError("Select a buyer.");
      return;
    }
    if (!listingId) {
      setError("Select a property.");
      return;
    }
    if (!scheduledAt) {
      setError("Pick a date and time.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/viewings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          listing_id: listingId,
          scheduled_at: scheduledAt,
          agent_id: agentId || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; viewing?: { id: string } };
      if (!res.ok || !json.viewing?.id) {
        setError(json.error ?? "Could not schedule this viewing.");
        return;
      }
      onCreated(json.viewing.id);
    } finally {
      setSaving(false);
    }
  }

  const selectedContact = contacts.find((contact) => contact.id === contactId);

  return (
    <PremiumSheet
      title="Schedule viewing"
      description="Book a property appointment and keep it on the company diary."
      onClose={onClose}
      size="md"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving} disabled={saving}>
            Confirm viewing
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Buyer" htmlFor="viewing-buyer">
          {contactId && selectedContact ? (
            <div className="flex items-center justify-between rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2">
              <p className="text-[13px] font-medium text-sales-text-primary">
                {selectedContact.name ?? "Buyer"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setContactId("");
                  setContactQuery("");
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <>
              <Input
                id="viewing-buyer"
                value={contactQuery}
                onChange={(event) => setContactQuery(event.target.value)}
                placeholder="Search by name or phone…"
              />
              {contacts.length > 0 ? (
                <ul className="mt-1 max-h-40 overflow-y-auto rounded-[10px] border border-sales-border bg-sales-surface py-1 shadow-sales-dropdown">
                  {contacts.map((contact) => (
                    <li key={contact.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-sales-surface-hover"
                        onClick={() => {
                          setContactId(contact.id);
                          setContactQuery(contact.name ?? "");
                        }}
                      >
                        <span className="font-medium text-sales-text-primary">{contact.name ?? "Buyer"}</span>
                        <span className="text-[11px] text-sales-text-muted">{contact.phone ?? ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </Field>

        <Field
          label="Property"
          htmlFor="viewing-listing"
          hint={listings.length === 0 ? "Add a listing before scheduling a viewing." : undefined}
        >
          <Select
            id="viewing-listing"
            value={listingId}
            onChange={(event) => setListingId(event.target.value)}
            disabled={listings.length === 0}
          >
            <option value="">{listings.length === 0 ? "No listings yet" : "Select a listing…"}</option>
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listingLabel(listing)}
              </option>
            ))}
          </Select>
        </Field>

        {agents.length > 0 ? (
          <Field label="Agent" htmlFor="viewing-agent">
            <Select
              id="viewing-agent"
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
            >
              <option value="">Assign to me</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="When">
          <div className="flex flex-wrap gap-2">
            {CALLBACK_SCHEDULE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setScheduleOption(option)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-medium",
                  scheduleOption === option
                    ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                    : "border-sales-border text-sales-text-secondary hover:text-sales-text-primary"
                )}
              >
                {CALLBACK_SCHEDULE_LABELS[option]}
              </button>
            ))}
          </div>
          {scheduleOption === "pick" ? (
            <Input
              type="datetime-local"
              min={`${todayLocalISO()}T00:00`}
              className="mt-2"
              value={customCallback}
              onChange={(event) => setCustomCallback(event.target.value)}
            />
          ) : null}
        </Field>

        {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}
      </div>
    </PremiumSheet>
  );
}
