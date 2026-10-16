"use client";

import { useEffect, useState } from "react";
import type { InboxConversation } from "@/lib/inbox/types";
import { acqFieldClass } from "@/components/real-estate/acquisition/acquisition-ui";

type SearchRow = { id: string; intent: string; pipeline_stage: string | null; locations: string[] | null; budget_max: number | null };

export function BuyerConversationActions({
  clientId,
  conversation,
}: {
  clientId: string;
  conversation: InboxConversation;
}) {
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [selected, setSelected] = useState("");
  const [intent, setIntent] = useState<"purchase" | "rental">("purchase");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState(conversation.location ?? "");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

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
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not create the search");
      return;
    }
    setCreated(json.search.id as string);
  }

  async function linkSelected() {
    if (!selected) return;
    const res = await fetch(`/api/clients/${clientId}/buyer-sales/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link_enquiry", searchId: selected, leadId: conversation.id }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Could not link the enquiry");
    else setCreated(selected);
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] leading-snug text-sales-text-secondary">
        Choose the search this conversation is about. A customer can have more than one. Creating a search records it here and does not send a message.
      </p>
      {searches.length ? (
        <select className={acqFieldClass} value={selected} onChange={(event) => setSelected(event.target.value)}>
          {searches.map((search) => (
            <option key={search.id} value={search.id}>
              {search.intent === "rental" ? "Rent" : "Buy"} · {(search.locations ?? []).join(", ") || "Location open"}
            </option>
          ))}
        </select>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <select className={acqFieldClass} value={intent} onChange={(event) => setIntent(event.target.value as "purchase" | "rental")}>
          <option value="purchase">Buying</option>
          <option value="rental">Renting</option>
        </select>
        <input className={acqFieldClass} inputMode="decimal" placeholder="Budget" value={budget} onChange={(event) => setBudget(event.target.value)} />
      </div>
      <input className={acqFieldClass} placeholder="Preferred area" value={location} onChange={(event) => setLocation(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="re-focus min-h-11 rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold" onClick={() => void createSearch()}>Create search</button>
        {selected ? <button type="button" className="min-h-11 px-3 text-[12px]" onClick={() => void linkSelected()}>Link this enquiry</button> : null}
        {selected ? <a className="inline-flex min-h-11 items-center text-[12px] font-semibold" href={`/sales/matching`}>Find properties</a> : null}
      </div>
      {created ? <a className="text-[12px] font-semibold underline" href={`/sales/buyers/${created}`}>Open customer search</a> : null}
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
