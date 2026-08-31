"use client";

import { useEffect, useState } from "react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button, Field, Input, TextArea } from "@/components/sales/ui";
import { formatOfferMoney, listingAllowsOffer } from "@/lib/real-estate/offers";
import { listingLabel } from "@/lib/real-estate/helpers";

type ListingOpt = {
  id: string;
  address?: string | null;
  suburb?: string | null;
  price?: number | null;
  status?: string;
};

type ContactOpt = { id: string; name: string | null; phone?: string | null };

export type CreateOfferPrefill = {
  listingId?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  leadId?: string | null;
};

export function CreateOfferSheet({
  clientId,
  prefill,
  onClose,
  onCreated,
}: {
  clientId: string;
  prefill?: CreateOfferPrefill;
  onClose: () => void;
  onCreated: (offerId: string, submitted: boolean) => void;
}) {
  const [listings, setListings] = useState<ListingOpt[]>([]);
  const [contacts, setContacts] = useState<ContactOpt[]>([]);
  const [listingId, setListingId] = useState(prefill?.listingId ?? "");
  const [contactId, setContactId] = useState(prefill?.contactId ?? "");
  const [contactQuery, setContactQuery] = useState(prefill?.contactName ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [conditions, setConditions] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/listings?limit=80`)
      .then((r) => r.json())
      .then((j: { listings?: ListingOpt[] }) => {
        if (!cancelled) setListings(j.listings ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!prefill?.listingId) return;
    let cancelled = false;
    fetch(`/api/clients/${clientId}/listings/${prefill.listingId}`)
      .then((r) => r.json())
      .then((j: { listing?: ListingOpt }) => {
        if (cancelled || !j.listing) return;
        setListings((prev) => (prev.some((l) => l.id === j.listing!.id) ? prev : [j.listing!, ...prev]));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [clientId, prefill?.listingId]);

  useEffect(() => {
    if (prefill?.contactId) return;
    const q = contactQuery.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/contacts/list?q=${encodeURIComponent(q)}&limit=12`)
        .then((r) => r.json())
        .then((j: { contacts?: ContactOpt[] }) => setContacts(j.contacts ?? []))
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [contactQuery, prefill?.contactId]);

  const listing = listings.find((l) => l.id === listingId) ?? null;
  const listingOpen = listing ? listingAllowsOffer(listing.status) : true;

  async function save(submit: boolean) {
    setError(null);
    const n = Number(amount);
    if (!listingId) {
      setError("Select a property.");
      return;
    }
    if (!contactId) {
      setError("Select a buyer.");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter an offer amount greater than 0.");
      return;
    }
    setSaving(submit ? "submit" : "draft");
    try {
      const res = await fetch(`/api/clients/${clientId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          contact_id: contactId,
          lead_id: prefill?.leadId ?? null,
          amount: n,
          currency,
          conditions: conditions.trim() || null,
          expiry_date: expiry || null,
          notes: notes.trim() || null,
          submit,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; offer?: { id: string } };
      if (!res.ok || !j.offer?.id) {
        setError(j.error ?? "Could not save offer.");
        return;
      }
      onCreated(j.offer.id, submit);
    } finally {
      setSaving(null);
    }
  }

  return (
    <PremiumSheet
      title="Create offer"
      description="Record a structured offer. Drafts are not presented to the seller."
      onClose={onClose}
      size="md"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving != null}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => void save(false)} disabled={saving != null}>
            {saving === "draft" ? "Saving…" : "Save draft"}
          </Button>
          <Button variant="primary" onClick={() => void save(true)} disabled={saving != null}>
            {saving === "submit" ? "Submitting…" : "Submit offer"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}

        <Field label="Property">
          {prefill?.listingId ? (
            <p className="text-[14px] font-medium text-sales-text-primary">
              {listing ? listingLabel(listing) : "Selected listing"}
            </p>
          ) : (
            <select
              className="h-11 w-full rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[13px]"
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
            >
              <option value="">Select listing</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {listingLabel(l)}
                  {l.status ? ` · ${l.status.replace(/_/g, " ")}` : ""}
                </option>
              ))}
            </select>
          )}
          {listing && !listingOpen ? (
            <p className="mt-1 text-[12px] text-sales-danger">This listing is not open to offers.</p>
          ) : null}
        </Field>

        <Field label="Listing price">
          <p className="text-[18px] font-semibold tabular-nums text-sales-text-primary">
            {listing?.price != null ? formatOfferMoney(Number(listing.price), currency) : "—"}
          </p>
        </Field>

        <Field label="Buyer">
          {prefill?.contactId ? (
            <p className="text-[14px] font-medium">{prefill.contactName ?? "Selected buyer"}</p>
          ) : (
            <>
              <Input
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Search contacts"
              />
              {contacts.length > 0 ? (
                <ul className="mt-2 max-h-36 overflow-y-auto rounded-[10px] border border-sales-border-subtle">
                  {contacts.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`block w-full px-3 py-2 text-left text-[13px] ${
                          contactId === c.id ? "bg-sales-brand-soft font-medium" : ""
                        }`}
                        onClick={() => {
                          setContactId(c.id);
                          setContactQuery(c.name ?? "");
                        }}
                      >
                        {c.name ?? "Unnamed"}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </Field>

        <div className="grid grid-cols-3 gap-2">
          <Field label="Offer amount" className="col-span-2">
            <Input
              className="h-12 text-[18px] font-semibold tabular-nums"
              inputMode="decimal"
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="145000"
            />
          </Field>
          <Field label="Currency">
            <select
              className="h-12 w-full rounded-[10px] border border-sales-border bg-sales-surface px-2 text-[13px]"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {["USD", "ZAR", "GBP", "EUR", "ZWG"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Conditions">
          <TextArea
            rows={3}
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            placeholder="e.g. Cash purchase."
          />
        </Field>

        <Field label="Expiry">
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </Field>

        <Field label="Internal note">
          <TextArea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Visible to your team only."
          />
        </Field>
      </div>
    </PremiumSheet>
  );
}
