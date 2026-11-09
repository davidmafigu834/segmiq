"use client";

import { useEffect, useRef, useState } from "react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button, Field, Input } from "@/components/sales/ui";
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
  buyerSearchId?: string | null;
};

export function CreateOfferSheet({
  clientId,
  prefill,
  onClose,
}: {
  clientId: string;
  prefill?: CreateOfferPrefill;
  onClose: () => void;
  onCreated?: (offerId: string, submitted: boolean) => void;
}) {
  const [listings, setListings] = useState<ListingOpt[]>([]);
  const [contacts, setContacts] = useState<ContactOpt[]>([]);
  const [listingId, setListingId] = useState(prefill?.listingId ?? "");
  const [contactId, setContactId] = useState(prefill?.contactId ?? "");
  const [contactQuery, setContactQuery] = useState(prefill?.contactName ?? "");
  const [saving, setSaving] = useState(Boolean(prefill?.listingId && prefill?.contactId));
  const issued = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function createLink() {
    setError(null);
    if (!listingId) {
      setError("Select a property.");
      setSaving(false);
      return;
    }
    if (!contactId) {
      setError("Select a buyer.");
      setSaving(false);
      return;
    }
    if (listing && !listingOpen) {
      setError("This listing is not open to offers.");
      setSaving(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/workflow/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          contactId,
          buyerSearchId: prefill?.buyerSearchId ?? null,
          leadId: prefill?.leadId ?? null,
          templateKey: "synthetic-offer-to-purchase",
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; path?: string };
      if (!res.ok || !j.path) {
        setError(j.error ?? "The buyer form was not created.");
        return;
      }
      const url = `${window.location.origin}${j.path}`;
      setLink(url);
      const copied = await navigator.clipboard?.writeText(url).then(() => true).catch(() => false);
      setNotice(copied ? "Buyer form link copied." : "Copy this link and send it to the buyer.");
    } finally {
      setSaving(false);
    }
  }

  // The buyer and property are already chosen, so opening this sheet creates the link.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (issued.current || !prefill?.listingId || !prefill.contactId) return;
    issued.current = true;
    void createLink();
  }, [prefill?.listingId, prefill?.contactId]);

  return (
    <PremiumSheet
      title="Generate offer letter"
      description="The buyer enters the amount, conditions, and signature. Send them this link."
      onClose={onClose}
      size="md"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {link ? "Done" : "Cancel"}
          </Button>
          {link ? (
            <Button
              variant="primary"
              onClick={() => {
                void navigator.clipboard?.writeText(link).then(() => setNotice("Buyer form link copied.")).catch(() => setNotice("Copy the link below."));
              }}
            >
              Copy link
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void createLink()} loading={saving} disabled={saving}>
              {saving ? "Creating…" : "Create buyer link"}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}
        {notice ? <p className="text-[13px] text-sales-text-secondary">{notice}</p> : null}
        {link ? <p className="break-all text-[14px] font-medium text-sales-text-primary">{link}</p> : null}

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
              disabled={Boolean(link)}
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
            {listing?.price != null ? formatOfferMoney(Number(listing.price), "USD") : "—"}
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
                disabled={Boolean(link)}
              />
              {contacts.length > 0 && !link ? (
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
      </div>
    </PremiumSheet>
  );
}
