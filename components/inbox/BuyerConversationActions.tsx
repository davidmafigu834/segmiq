"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { InboxConversation } from "@/lib/inbox/types";
import { acqFieldClass } from "@/components/real-estate/acquisition/acquisition-ui";

type SearchRow = { id: string; intent: string; pipeline_stage: string | null; locations: string[] | null; budget_max: number | null };

export function BuyerConversationActions({
  clientId,
  conversation,
  intentLocked = null,
}: {
  clientId: string;
  conversation: InboxConversation;
  intentLocked?: "purchase" | "rental" | null;
}) {
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [selected, setSelected] = useState("");
  const [intent, setIntent] = useState<"purchase" | "rental">(intentLocked ?? "purchase");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState(conversation.location ?? "");
  const [busy, setBusy] = useState<"create" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    if (intentLocked) setIntent(intentLocked);
  }, [intentLocked]);

  useEffect(() => {
    if (!conversation.contactId) return;
    void fetch(`/api/clients/${clientId}/buyer-searches?contactId=${conversation.contactId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const rows = (json?.searches as SearchRow[] | undefined) ?? [];
        setSearches(rows);
        if (rows[0]) setSelected(rows[0].id);
      })
      .catch(() => setSearches([]));
  }, [clientId, conversation.contactId]);

  async function createSearch() {
    setError(null);
    setBusy("create");
    const res = await fetch(`/api/clients/${clientId}/buyer-searches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactId: conversation.contactId,
        name: conversation.name,
        phone: conversation.phone,
        intent,
        locations: location ? [location] : [],
        budgetMax: budget ? Number(budget) : null,
        leadId: conversation.id,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Could not create the search");
      return;
    }
    const id = json.search?.id;
    if (typeof id !== "string" || !id) {
      setError("The search was saved, but it did not come back. Open buyers and tenants to check.");
      return;
    }
    setCreated(id);
  }

  async function linkSelected() {
    if (!selected) return;
    setError(null);
    setBusy("link");
    const res = await fetch(`/api/clients/${clientId}/buyer-sales/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link_enquiry", searchId: selected, leadId: conversation.id }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(json.error ?? "Could not link the enquiry");
    else setCreated(selected);
  }

  const rental = intent === "rental";

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-5 text-sales-text-secondary">
        {rental
          ? "This is a rental enquiry. Creating or linking a search records it here and does not send a message."
          : "This is a purchase enquiry. Creating or linking a search records it here and does not send a message."}
      </p>
      {searches.length ? (
        <div className="space-y-1">
          <p className="text-[12px] font-medium text-sales-text-muted">Existing searches</p>
          {searches.map((search) => {
            const active = selected === search.id;
            const places = (search.locations ?? []).join(", ") || "Location open";
            return (
              <button
                key={search.id}
                type="button"
                onClick={() => setSelected(search.id)}
                className={`flex min-h-11 w-full flex-col items-start rounded-[8px] border px-3 py-2 text-left ${
                  active ? "border-sales-text-primary bg-sales-surface-hover" : "border-sales-border"
                }`}
              >
                <span className="text-[13px] font-semibold text-sales-text-primary">
                  {search.intent === "rental" ? "Rent" : "Buy"} · {places}
                </span>
                <span className="text-[12px] text-sales-text-secondary">
                  {search.pipeline_stage ?? "Stage not set"}
                  {search.budget_max != null ? ` · ${search.budget_max.toLocaleString()}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[13px] text-sales-text-secondary">No search is linked to this customer yet.</p>
      )}
      {!intentLocked ? (
        <select className={acqFieldClass} value={intent} onChange={(event) => setIntent(event.target.value as "purchase" | "rental")}>
          <option value="purchase">Buying</option>
          <option value="rental">Renting</option>
        </select>
      ) : null}
      <input className={acqFieldClass} inputMode="decimal" placeholder={rental ? "Monthly budget" : "Budget"} value={budget} onChange={(event) => setBudget(event.target.value)} />
      <input className={acqFieldClass} placeholder="Preferred area" value={location} onChange={(event) => setLocation(event.target.value)} />
      <div className="flex flex-col gap-1">
        <button type="button" disabled={busy != null} className="re-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface disabled:opacity-50" onClick={() => void createSearch()}>
          {busy === "create" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {busy === "create" ? "Saving…" : rental ? "Create rental search" : "Create buyer search"}
        </button>
        {selected ? (
          <button type="button" disabled={busy != null} className="min-h-11 px-3 text-left text-[13px] font-semibold text-sales-text-primary disabled:opacity-50" onClick={() => void linkSelected()}>
            {busy === "link" ? "Linking…" : "Link this enquiry"}
          </button>
        ) : null}
        {selected ? (
          <a className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-text-primary" href="/sales/matching">
            {rental ? "Find rental properties" : "Find matching properties"}
          </a>
        ) : null}
      </div>
      {created ? <a className="inline-flex min-h-11 items-center text-[13px] font-semibold underline" href={`/sales/buyers/${created}`}>Open customer search</a> : null}
      {error ? <p className="text-[12px] text-sales-danger">{error}</p> : null}
    </div>
  );
}
