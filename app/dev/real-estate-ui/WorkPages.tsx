"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Plus } from "lucide-react";
import type { OfferId } from "./OfferRecord";
import { ViewingRecord, type ViewingStatus } from "./ViewingRecord";

const rowBtn = "h-9 shrink-0 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover";
const solidBtn = "re-fill inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-text-primary px-4 text-[14px] font-semibold text-sales-surface";
const lineBtn = "re-fill inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-bg px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover";
const limeBtn = "re-fill inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text";
const backBtn = "inline-flex h-9 items-center rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover";
const field = "mt-1.5 h-11 w-full min-w-0 max-w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px]";

function useTop(key: string | null) {
  useEffect(() => {
    if (!key) return;
    document.querySelector(".re-mock")?.scrollTo({ top: 0 });
  }, [key]);
}

export function BuyersPage({ loading, focus, onOpenOffer }: { loading: boolean; focus: string | null; onOpenOffer: (id: OfferId, buyerId: string) => void }) {
  const [rows, setRows] = useState(BUYERS);
  const [openId, setOpenId] = useState<string | null>(focus && BUYERS.some((row) => row.id === focus) ? focus : null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", intent: "Buying", area: "", budget: "" });
  const open = rows.find((row) => row.id === openId) ?? null;
  useTop(openId);

  function add(event: FormEvent) {
    event.preventDefault();
    const name = draft.name.trim();
    const area = draft.area.trim();
    if (!name || !area) return;
    const id = `buyer-${name.toLowerCase().replace(/\s+/g, "-")}`;
    setRows((current) => [{ id, name, intent: draft.intent, area, budget: draft.budget.trim() || "Budget open", beds: "Any", next: "No property matched yet.", offer: null, viewing: null }, ...current.filter((row) => row.id !== id)]);
    setOpenId(id);
    setAdding(false);
    setDraft({ name: "", intent: "Buying", area: "", budget: "" });
  }

  if (open) {
    return (
      <BuyerRecord
        buyer={open}
        onClose={() => setOpenId(null)}
        onOpenOffer={(id) => onOpenOffer(id, open.id)}
        onBook={(when) => setRows((current) => current.map((row) => row.id === open.id ? { ...row, viewing: when, next: `Viewing booked · ${when}` } : row))}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Head kicker="Buyer and tenant sales" title="Buyers" detail="People who want to buy or rent, and the search you are working." action={adding ? undefined : "Add buyer"} onAction={() => setAdding(true)} />
      {adding ? (
        <form onSubmit={add} className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <h2 className="text-[15px] font-semibold">Add a buyer</h2>
          <p className="mt-1 text-[13px] text-sales-text-secondary">A search starts with the area and whether they are buying or renting.</p>
          <label className="mt-4 block"><span className="text-[13px] font-medium">Name</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={field} /></label>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="text-[13px] font-medium">Intent</span>
              <select value={draft.intent} onChange={(event) => setDraft({ ...draft, intent: event.target.value })} className={field}>
                <option>Buying</option>
                <option>Renting</option>
              </select>
            </label>
            <label className="block"><span className="text-[13px] font-medium">Area</span><input required value={draft.area} onChange={(event) => setDraft({ ...draft, area: event.target.value })} className={field} /></label>
            <label className="block"><span className="text-[13px] font-medium">Budget</span><input value={draft.budget} onChange={(event) => setDraft({ ...draft, budget: event.target.value })} className={field} /></label>
          </div>
          <div className="re-actions mt-4 flex gap-2">
            <button type="submit" className={solidBtn}>Start the search</button>
            <button type="button" onClick={() => setAdding(false)} className={lineBtn}>Close</button>
          </div>
        </form>
      ) : null}
      <List title="Searches" count={loading ? undefined : rows.length}>
        {loading ? <Bones /> : rows.map((row) => (
          <Line key={row.id} name={row.name} meta={`${row.intent} · ${row.area}`} detail={row.next} action="Open" onAction={() => setOpenId(row.id)} />
        ))}
      </List>
    </div>
  );
}

function BuyerRecord({ buyer, onClose, onOpenOffer, onBook }: { buyer: Buyer; onClose: () => void; onOpenOffer: (id: OfferId) => void; onBook: (when: string) => void }) {
  const [when, setWhen] = useState("2026-11-16T10:00");
  const [booking, setBooking] = useState(false);
  const [viewingOpen, setViewingOpen] = useState(false);
  const match = MATCHES.find((item) => item.area === buyer.area) ?? MATCHES[0];
  if (viewingOpen && buyer.id === "rudo") {
    return (
      <ViewingRecord
        name={buyer.name}
        place="4 Borrowdale Brooke"
        when="Monday 9 November · 09:30"
        status="scheduled"
        note=""
        onClose={() => setViewingOpen(false)}
        onSave={() => setViewingOpen(false)}
        onCancel={() => setViewingOpen(false)}
      />
    );
  }
  return (
    <div className="re-in space-y-5">
      <button type="button" onClick={onClose} className={backBtn}>Back</button>
      <header>
        <p className="text-[13px] font-medium text-sales-text-muted">{buyer.intent}</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{buyer.name}</h1>
        <p className="mt-2 text-[14px] text-sales-text-secondary">{buyer.area} · {buyer.budget}</p>
      </header>
      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <div className="px-4 pb-2 pt-4">
          <h2 className="text-[15px] font-semibold">Looking for</h2>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{buyer.beds} in {buyer.area}, up to {buyer.budget}.</p>
        </div>
        <dl className="grid gap-x-6 gap-y-3 border-t border-sales-border-subtle px-4 py-3 sm:grid-cols-2">
          {[["Area", buyer.area], ["Budget", buyer.budget], ["Bedrooms", buyer.beds], ["Intent", buyer.intent]].map(([label, value]) => (
            <div key={label}><dt className="text-[12px] text-sales-text-muted">{label}</dt><dd className="text-[14px] font-medium">{value}</dd></div>
          ))}
        </dl>
      </section>
      <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
        <h2 className="text-[15px] font-semibold">Next</h2>
        <p className="mt-2 text-[14px] text-sales-text-secondary">{buyer.next}</p>
        {buyer.offer ? (
          <button type="button" onClick={() => onOpenOffer(buyer.offer as OfferId)} className={`${solidBtn} mt-4`}>Open offer</button>
        ) : buyer.id === "rudo" ? (
          <button type="button" onClick={() => setViewingOpen(true)} className={`${solidBtn} mt-4`}>Open viewing</button>
        ) : buyer.viewing ? (
          <p className="mt-3 text-[13px] text-sales-text-muted">{buyer.viewing}</p>
        ) : (
          <div className="mt-4 border-t border-sales-border-subtle pt-4">
            <p className="text-[14px] font-semibold">{match.place}</p>
            <p className="mt-1 text-[13px] text-sales-text-secondary">{match.line}</p>
            {booking ? (
              <form className="mt-3" onSubmit={(event) => { event.preventDefault(); onBook(when.replace("T", " · ")); setBooking(false); }}>
                <label className="block"><span className="text-[13px] font-medium">When</span><input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} className={field} /></label>
                <div className="re-actions mt-3 flex gap-2">
                  <button type="submit" className={solidBtn}>Book the viewing</button>
                  <button type="button" onClick={() => setBooking(false)} className={lineBtn}>Close</button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setBooking(true)} className={`${solidBtn} mt-3`}>Book a viewing</button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export function InspectionsPage({ loading }: { loading: boolean }) {
  const [rows, setRows] = useState(VISITS);
  const [filter, setFilter] = useState("To record");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((row) => row.id === openId) ?? null;
  useTop(openId);
  const visible = rows.filter((row) => filter === "All" || (filter === "To record" ? row.status !== "recorded" : row.status === "recorded"));

  if (open) {
    return (
      <InspectionRecord
        visit={open}
        onClose={() => setOpenId(null)}
        onBook={(when) => setRows((current) => current.map((row) => row.id === open.id ? { ...row, status: "booked", when } : row))}
        onRecord={(note) => setRows((current) => current.map((row) => row.id === open.id ? { ...row, status: "recorded", note } : row))}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Head kicker="Property acquisition" title="Inspections" detail="Visits to prepare a property for the market." />
      <Filters value={filter} options={["To record", "Recorded", "All"]} onChange={setFilter} />
      <List title="Inspections" count={loading ? undefined : visible.length}>
        {loading ? <Bones /> : visible.length === 0 ? <Empty title="Nothing to record" detail="Book an inspection from the seller’s property." /> : visible.map((row) => (
          <Line key={row.id} name={row.place} meta={row.seller} detail={row.status === "unbooked" ? "Not booked" : row.status === "recorded" ? "Recorded" : row.when} action={row.status === "unbooked" ? "Book" : row.status === "recorded" ? "Open" : "Record"} onAction={() => setOpenId(row.id)} />
        ))}
      </List>
    </div>
  );
}

function InspectionRecord({ visit, onClose, onBook, onRecord }: { visit: Visit; onClose: () => void; onBook: (when: string) => void; onRecord: (note: string) => void }) {
  const [when, setWhen] = useState("2026-11-12T09:00");
  const [note, setNote] = useState(visit.note ?? "");
  return (
    <div className="re-in space-y-5">
      <button type="button" onClick={onClose} className={backBtn}>Back</button>
      <header>
        <p className="text-[13px] font-medium text-sales-text-muted">{visit.seller}</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{visit.place}</h1>
        <p className="mt-2 text-[14px] text-sales-text-secondary">{visit.status === "recorded" ? "Inspection recorded" : visit.status === "booked" ? visit.when : "Not booked"}</p>
      </header>
      <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
        {visit.status === "recorded" ? (
          <>
            <h2 className="text-[15px] font-semibold">Recorded</h2>
            <p className="mt-2 text-[14px] text-sales-text-secondary">The visit is on file. The property can go on the market.</p>
            {visit.note ? <p className="mt-3 text-[14px]">{visit.note}</p> : null}
          </>
        ) : visit.status === "unbooked" ? (
          <form onSubmit={(event) => { event.preventDefault(); onBook(when.replace("T", " · ")); }}>
            <h2 className="text-[15px] font-semibold">Book the inspection</h2>
            <p className="mt-2 text-[14px] text-sales-text-secondary">A visit with {visit.seller} at the property.</p>
            <label className="mt-4 block"><span className="text-[13px] font-medium">When</span><input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} className={field} /></label>
            <button type="submit" className={`${solidBtn} mt-4`}>Book the inspection</button>
          </form>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); onRecord(note.trim()); }}>
            <h2 className="text-[15px] font-semibold">Record the visit</h2>
            <p className="mt-2 text-[14px] text-sales-text-secondary">What you saw, and what is still to prepare.</p>
            <label className="mt-4 block"><span className="text-[13px] font-medium">What you saw</span><textarea required value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1.5 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2 text-[14px]" /></label>
            <button type="submit" className={`${solidBtn} mt-4`}>Save the inspection</button>
          </form>
        )}
      </section>
    </div>
  );
}

export function MandatesPage({ loading, onOpenSeller }: { loading: boolean; onOpenSeller: () => void }) {
  const [rows, setRows] = useState(MANDATES);
  const [filter, setFilter] = useState("Waiting");
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const open = rows.find((row) => row.id === openId) ?? null;
  useTop(openId);
  const visible = rows.filter((row) => filter === "All" || (filter === "Waiting" ? row.status !== "accepted" : row.status === "accepted"));

  if (open) {
    return (
      <div className="re-in space-y-5">
        <button type="button" onClick={() => setOpenId(null)} className={backBtn}>Back</button>
        <header>
          <p className="text-[13px] font-medium text-sales-text-muted">Mandate</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{open.name}</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{open.place}</p>
        </header>
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <h2 className="text-[15px] font-semibold">{open.status === "accepted" ? "Accepted" : open.status === "prepared" ? "Form prepared" : "Waiting for the form"}</h2>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{open.detail}</p>
          <div className="re-actions re-stack mt-4 flex flex-wrap gap-2">
            {open.status === "waiting" ? (
              <button type="button" onClick={() => setRows((current) => current.map((row) => row.id === open.id ? { ...row, status: "prepared", detail: "The form asks the seller to accept the mandate. Send the link." } : row))} className={limeBtn}>
                <Plus size={16} strokeWidth={1.75} aria-hidden />
                Prepare a form
              </button>
            ) : null}
            {open.status === "prepared" ? (
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(`${window.location.origin}/f/${open.id}`).catch(() => undefined); setCopied(true); }} className={lineBtn}>{copied ? "Link copied" : "Copy link"}</button>
            ) : null}
            {open.status === "accepted" ? <button type="button" onClick={onOpenSeller} className={solidBtn}>Open seller</button> : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Head kicker="Property acquisition" title="Mandates" detail="Forms returned by sellers, and the mandates on file." />
      <Filters value={filter} options={["Waiting", "Accepted", "All"]} onChange={setFilter} />
      <List title="Mandates" count={loading ? undefined : visible.length}>
        {loading ? <Bones /> : visible.map((row) => (
          <Line key={row.id} name={row.name} meta={row.place} detail={row.status === "accepted" ? "Accepted" : row.status === "prepared" ? "Form prepared" : "Waiting for the form"} action="Open" onAction={() => { setCopied(false); setOpenId(row.id); }} />
        ))}
      </List>
    </div>
  );
}

export function ViewingsPage({ loading }: { loading: boolean }) {
  const [rows, setRows] = useState(VIEWINGS);
  const [filter, setFilter] = useState("Today");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((row) => row.id === openId) ?? null;
  useTop(openId);
  const visible = rows.filter((row) => filter === "All" || row.group === filter);

  if (open) {
    return (
      <ViewingRecord
        name={open.name}
        place={open.place}
        when={open.when}
        phone={open.phone}
        status={open.status}
        note={open.note}
        onClose={() => setOpenId(null)}
        onSave={(note) => { setRows((current) => current.map((row) => row.id === open.id ? { ...row, status: "recorded", note, group: "Completed" } : row)); }}
        onCancel={() => setRows((current) => current.map((row) => row.id === open.id ? { ...row, status: "cancelled", group: "Cancelled" } : row))}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Head kicker="Buyer and tenant sales" title="Viewings" detail="Appointments today, and outcomes still to record." />
      <Filters value={filter} options={["Today", "Upcoming", "Completed", "All"]} onChange={setFilter} />
      <List title="Viewings" count={loading ? undefined : visible.length}>
        {loading ? <Bones /> : visible.length === 0 ? <Empty title="Nothing in this list" detail="Book a viewing from a buyer’s search." /> : visible.map((row) => (
          <Line key={row.id} name={row.name} meta={row.place} detail={row.status === "recorded" ? "Outcome recorded" : row.status === "cancelled" ? "Cancelled" : row.when} action="Open" onAction={() => setOpenId(row.id)} />
        ))}
      </List>
    </div>
  );
}

const SALE_STEPS = [
  { title: "Agreement to sign", line: "The buyer and the seller sign the agreement.", action: "Mark the agreement signed" },
  { title: "Conveyancing", line: "The transfer is with the conveyancer.", action: "Mark conveyancing complete" },
  { title: "Keys to hand over", line: "The buyer can take the keys.", action: "Hand over the keys" },
  { title: "Sale complete", line: "The sale is complete.", action: "" },
];

export function SalesPage({ loading }: { loading: boolean }) {
  const [rows, setRows] = useState(SALES);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((row) => row.id === openId) ?? null;
  useTop(openId);
  if (open) {
    const step = SALE_STEPS[open.step];
    return (
      <div className="re-in space-y-5">
        <button type="button" onClick={() => setOpenId(null)} className={backBtn}>Back</button>
        <header>
          <p className="text-[13px] font-medium text-sales-text-muted">{open.name}</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{open.place}</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{open.price}</p>
        </header>
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <h2 className="text-[15px] font-semibold">{step.title}</h2>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{step.line}</p>
          {step.action ? (
            <button type="button" onClick={() => setRows((current) => current.map((row) => row.id === open.id ? { ...row, step: Math.min(3, row.step + 1) as Sale["step"] } : row))} className={`${solidBtn} mt-4`}>{step.action}</button>
          ) : null}
        </section>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Head kicker="After the offer" title="Sales" detail="Sales moving through to completion." />
      <List title="In progress" count={loading ? undefined : rows.length}>
        {loading ? <Bones /> : rows.map((row) => (
          <Line key={row.id} name={row.name} meta={row.place} detail={SALE_STEPS[row.step].title} action="Open" onAction={() => setOpenId(row.id)} />
        ))}
      </List>
    </div>
  );
}

export function InquiriesPage({ loading, onOpenBuyer, onOpenSeller }: { loading: boolean; onOpenBuyer: () => void; onOpenSeller: () => void }) {
  const [rows, setRows] = useState(INQUIRIES);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const open = rows.find((row) => row.id === openId) ?? null;
  useTop(openId);
  if (open) {
    return (
      <div className="re-in space-y-5">
        <button type="button" onClick={() => setOpenId(null)} className={backBtn}>Back</button>
        <header>
          <p className="text-[13px] font-medium text-sales-text-muted">Inquiry</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{open.name}</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{open.channel}</p>
        </header>
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <p className="text-[14px] text-sales-text-secondary">{open.detail}</p>
          {open.done ? <p className="mt-3 text-[14px] font-semibold">{open.done}</p> : open.kind === "reply" ? (
            <form className="mt-4" onSubmit={(event) => { event.preventDefault(); setRows((current) => current.map((row) => row.id === open.id ? { ...row, done: "Reply sent." } : row)); }}>
              <label className="block"><span className="text-[13px] font-medium">Reply</span><textarea required value={reply} onChange={(event) => setReply(event.target.value)} rows={3} className="mt-1.5 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2 text-[14px]" /></label>
              <button type="submit" className={`${solidBtn} mt-3`}>Send</button>
            </form>
          ) : (
            <button type="button" onClick={() => setRows((current) => current.map((row) => row.id === open.id ? { ...row, done: open.kind === "buyer" ? `${open.name} is now a buyer.` : `${open.name} is now a seller.` } : row))} className={`${solidBtn} mt-4`}>
              {open.kind === "buyer" ? "Make a buyer" : "Make a seller"}
            </button>
          )}
          {open.done && open.kind === "buyer" ? <button type="button" onClick={onOpenBuyer} className={`${lineBtn} mt-3`}>Open buyers</button> : null}
          {open.done && open.kind === "seller" ? <button type="button" onClick={onOpenSeller} className={`${lineBtn} mt-3`}>Open sellers</button> : null}
        </section>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Head kicker="Follow-up" title="Inquiries" detail="New people, before they are a buyer or a seller." />
      <List title="New" count={loading ? undefined : rows.filter((row) => !row.done).length}>
        {loading ? <Bones /> : rows.map((row) => (
          <Line key={row.id} name={row.name} meta={row.channel} detail={row.done || row.detail} action="Open" onAction={() => { setReply(""); setOpenId(row.id); }} />
        ))}
      </List>
    </div>
  );
}

export function SellersPage({ loading, focus, onOpenDavid, onNewMandate }: { loading: boolean; focus: string | null; onOpenDavid: () => void; onNewMandate?: () => void }) {
  const [openId, setOpenId] = useState<string | null>(focus === "amina" ? "amina" : null);
  const [booked, setBooked] = useState<string | null>(null);
  const [when, setWhen] = useState("2026-11-12T09:00");
  useTop(openId);
  if (openId === "amina") {
    return (
      <div className="re-in space-y-5">
        <button type="button" onClick={() => setOpenId(null)} className={backBtn}>Back</button>
        <header>
          <p className="text-[13px] font-medium text-sales-text-muted">Sellers</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Amina Cruz</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">8 Stonechat Lane, Mount Pleasant</p>
        </header>
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <h2 className="text-[15px] font-semibold">{booked ? "Inspection booked" : "Inspection to book"}</h2>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{booked ? `The visit is set for ${booked}. Record it from Inspections.` : "The property is in preparation. The inspection has not been booked."}</p>
          {booked ? null : (
            <form className="mt-4" onSubmit={(event) => { event.preventDefault(); setBooked(when.replace("T", " · ")); }}>
              <label className="block"><span className="text-[13px] font-medium">When</span><input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} className={field} /></label>
              <button type="submit" className={`${solidBtn} mt-4`}>Book the inspection</button>
            </form>
          )}
        </section>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Head kicker="Property acquisition" title="Sellers" detail="People with a property on file." action="New seller form" onAction={onNewMandate} />
      <List title="Sellers" count={loading ? undefined : 2}>
        {loading ? <Bones /> : (
          <>
            <Line name="David Mafigu" meta="2 Baines Avenue" detail="Mandate accepted" action="Open" onAction={onOpenDavid} />
            <Line name="Amina Cruz" meta="8 Stonechat Lane" detail="Inspection to book" action="Open" onAction={() => setOpenId("amina")} />
          </>
        )}
      </List>
    </div>
  );
}

export function PeoplePage({ onOpen }: { onOpen: (screen: "sellers" | "buyers", id: string) => void }) {
  return (
    <div className="space-y-5">
      <Head kicker="Main" title="People" detail="Sellers, buyers, and tenants. Open the person and you are in their record." />
      <List title="Sellers">
        <Line name="David Mafigu" meta="Seller" detail="2 Baines Avenue" action="Open" onAction={() => onOpen("sellers", "david")} />
        <Line name="Amina Cruz" meta="Seller" detail="8 Stonechat Lane" action="Open" onAction={() => onOpen("sellers", "amina")} />
      </List>
      <List title="Buyers and tenants">
        {BUYERS.map((row) => (
          <Line key={row.id} name={row.name} meta={row.intent} detail={row.area} action="Open" onAction={() => onOpen("buyers", row.id)} />
        ))}
      </List>
    </div>
  );
}

export function InboxPage({ loading }: { loading: boolean }) {
  const [rows, setRows] = useState(THREADS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const open = rows.find((row) => row.id === openId) ?? null;
  useTop(openId);
  if (open) {
    return (
      <div className="re-in space-y-5">
        <button type="button" onClick={() => setOpenId(null)} className={backBtn}>Back</button>
        <header>
          <p className="text-[13px] font-medium text-sales-text-muted">WhatsApp</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{open.name}</h1>
        </header>
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <p className="text-[14px]">{open.preview}</p>
          {open.sent ? <p className="mt-4 text-[14px] font-semibold">Reply sent.</p> : (
            <form className="mt-4" onSubmit={(event) => { event.preventDefault(); setRows((current) => current.map((row) => row.id === open.id ? { ...row, sent: reply.trim() } : row)); }}>
              <label className="block"><span className="text-[13px] font-medium">Reply</span><textarea required value={reply} onChange={(event) => setReply(event.target.value)} rows={3} className="mt-1.5 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2 text-[14px]" /></label>
              <button type="submit" className={`${solidBtn} mt-3`}>Send</button>
            </form>
          )}
          {open.sent ? <p className="mt-2 text-[14px] text-sales-text-secondary">{open.sent}</p> : null}
        </section>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Head kicker="Follow-up" title="Sales Inbox" detail="Conversations waiting for a reply." />
      <List title="Waiting" count={loading ? undefined : rows.filter((row) => !row.sent).length}>
        {loading ? <Bones /> : rows.map((row) => (
          <Line key={row.id} name={row.name} meta="WhatsApp" detail={row.sent ? "Reply sent" : row.preview} action="Reply" onAction={() => { setReply(""); setOpenId(row.id); }} />
        ))}
      </List>
    </div>
  );
}

export function ActivitiesPage({ loading }: { loading: boolean }) {
  const [rows, setRows] = useState(JOBS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const open = rows.find((row) => row.id === openId) ?? null;
  useTop(openId);
  if (open) {
    return (
      <div className="re-in space-y-5">
        <button type="button" onClick={() => setOpenId(null)} className={backBtn}>Back</button>
        <header>
          <p className="text-[13px] font-medium text-sales-text-muted">Follow-up</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{open.name}</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{open.detail}</p>
        </header>
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          {open.logged ? <p className="text-[14px] font-semibold">Call logged. {open.logged}</p> : (
            <form onSubmit={(event) => { event.preventDefault(); setRows((current) => current.map((row) => row.id === open.id ? { ...row, logged: note.trim() || "No note added." } : row)); }}>
              <h2 className="text-[15px] font-semibold">Log the call</h2>
              <label className="mt-4 block"><span className="text-[13px] font-medium">What was said</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1.5 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2 text-[14px]" /></label>
              <button type="submit" className={`${solidBtn} mt-4`}>Save</button>
            </form>
          )}
        </section>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Head kicker="Follow-up" title="My activities" detail="Follow-ups and calls still to do." />
      <List title="Due" count={loading ? undefined : rows.filter((row) => !row.logged).length}>
        {loading ? <Bones /> : rows.map((row) => (
          <Line key={row.id} name={row.name} meta={row.logged ? "Logged" : "Call"} detail={row.logged || row.detail} action={row.logged ? "Open" : "Call"} onAction={() => { setNote(""); setOpenId(row.id); }} />
        ))}
      </List>
    </div>
  );
}

type Buyer = { id: string; name: string; intent: string; area: string; budget: string; beds: string; next: string; offer: OfferId | null; viewing: string | null };
type Visit = { id: string; place: string; seller: string; when: string; status: "unbooked" | "booked" | "recorded"; note?: string };
type Mandate = { id: string; name: string; place: string; status: "waiting" | "prepared" | "accepted"; detail: string };
type ViewingRow = { id: string; name: string; place: string; when: string; phone?: string; group: string; status: ViewingStatus; note: string };
type Sale = { id: string; name: string; place: string; price: string; step: 0 | 1 | 2 | 3 };

const MATCHES = [
  { area: "Avondale", place: "2 Baines Avenue", line: "4 bed house · US$185,000 · in preparation." },
  { area: "Borrowdale", place: "14 Kingsmead", line: "On the market · US$180,000." },
  { area: "Mount Pleasant", place: "8 Stonechat Lane", line: "In preparation · inspection still to record." },
];

const BUYERS: Buyer[] = [
  { id: "tendai", name: "Tendai Moyo", intent: "Buying", area: "Borrowdale", budget: "US$180,000", beds: "3 bed", next: "Seller sent a counter. The buyer signs again.", offer: "kingsmead", viewing: null },
  { id: "rudo", name: "Rudo Ncube", intent: "Buying", area: "Borrowdale", budget: "US$160,000", beds: "3 bed", next: "Viewing today at 4 Borrowdale Brooke.", offer: null, viewing: "Monday 9 November · 09:30" },
  { id: "farai", name: "Farai Dube", intent: "Buying", area: "Mount Pleasant", budget: "US$98,000", beds: "2 bed", next: "Buyer signed the form. The PDF is ready.", offer: "kensington", viewing: null },
  { id: "chipo", name: "Chipo Ndlovu", intent: "Buying", area: "Mount Pleasant", budget: "US$240,000", beds: "4 bed", next: "Buyer signed the form. The PDF is ready.", offer: "stonechat", viewing: null },
];

const VISITS: Visit[] = [
  { id: "baines", place: "2 Baines Avenue", seller: "David Mafigu", when: "", status: "unbooked" },
  { id: "stonechat", place: "8 Stonechat Lane", seller: "Amina Cruz", when: "Tuesday 10 November · 09:00", status: "booked" },
];

const MANDATES: Mandate[] = [
  { id: "amina", name: "Amina Cruz", place: "8 Stonechat Lane", status: "waiting", detail: "The seller has not returned the mandate form." },
  { id: "david", name: "David Mafigu", place: "2 Baines Avenue", status: "accepted", detail: "Accepted · 11 Jul 2026 – 5 Jul 2027 · US$185,000." },
];

const VIEWINGS: ViewingRow[] = [
  { id: "rudo", name: "Rudo Ncube", place: "4 Borrowdale Brooke", when: "Monday 9 November · 09:30", group: "Today", status: "scheduled", note: "" },
  { id: "tawonga", name: "Tawonga Creig", place: "2 Baines Avenue", when: "Tuesday 10 November · 10:00", group: "Upcoming", status: "scheduled", note: "" },
  { id: "chipo", name: "Chipo Ndlovu", place: "8 Stonechat Lane", when: "Wednesday 11 November · 15:30", phone: "+263 77 418 2201", group: "Upcoming", status: "scheduled", note: "" },
  { id: "farai", name: "Farai Dube", place: "Flat 4B, Kensington", when: "Thursday 12 November · 16:00", phone: "+263 77 555 0190", group: "Upcoming", status: "scheduled", note: "" },
];

const SALES: Sale[] = [
  { id: "kuda", name: "Kuda Muchenje", place: "19 Cork Road", price: "US$210,000", step: 0 },
  { id: "lisa", name: "Lisa Patel", place: "Flat 2, Avondale", price: "US$95,000", step: 2 },
];

const INQUIRIES = [
  { id: "blessing", name: "Blessing Dube", channel: "Phone", detail: "Called about renting in Avondale.", kind: "buyer" as const, done: "" },
  { id: "grace", name: "Grace Ncube", channel: "Phone", detail: "Has a house to sell in Borrowdale.", kind: "seller" as const, done: "" },
  { id: "tatenda", name: "Tatenda Zhou", channel: "WhatsApp", detail: "Asked the price of 14 Kingsmead.", kind: "reply" as const, done: "" },
];

const THREADS = [
  { id: "blessing", name: "Blessing Dube", preview: "Is 2 Baines still available?", sent: "" },
  { id: "tendai", name: "Tendai Moyo", preview: "Can we view 14 Kingsmead again on Tuesday?", sent: "" },
];

const JOBS = [
  { id: "tendai", name: "Tendai Moyo", detail: "Viewing follow-up was due yesterday.", logged: "" },
  { id: "farai", name: "Farai Dube", detail: "Follow-up · Mount Pleasant search.", logged: "" },
  { id: "david", name: "David Mafigu", detail: "Call about 2 Baines Avenue.", logged: "" },
];

function Head({ kicker, title, detail, action, onAction }: { kicker: string; title: string; detail: string; action?: string; onAction?: () => void }) {
  return (
    <div className="re-head flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-sales-text-muted">{kicker}</p>
        <h1 className="mt-1 break-words font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] text-sales-text-secondary">{detail}</p>
      </div>
      {action ? (
        <button type="button" onClick={onAction} className={limeBtn}>
          <Plus size={16} strokeWidth={1.75} aria-hidden />
          {action}
        </button>
      ) : null}
    </div>
  );
}

function Filters({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="re-chips flex flex-wrap gap-2" role="tablist">
      {options.map((option) => (
        <button key={option} type="button" role="tab" aria-selected={value === option} onClick={() => onChange(option)} className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium ${value === option ? "bg-sales-text-primary text-sales-surface" : "border border-sales-border text-sales-text-secondary"}`}>
          {option}
        </button>
      ))}
    </div>
  );
}

function List({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {count != null ? <span className="text-[13px] tabular-nums text-sales-text-muted">{count}</span> : null}
      </div>
      <ul>{children}</ul>
    </section>
  );
}

function Line({ name, meta, detail, action, onAction }: { name: string; meta: string; detail: string; action: string; onAction: () => void }) {
  return (
    <li className="re-in flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{name}</p>
        <p className="truncate text-[12px] text-sales-text-muted">{meta}</p>
        <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">{detail}</p>
      </div>
      <button type="button" onClick={onAction} className={rowBtn}>{action}</button>
    </li>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="border-t border-sales-border-subtle px-4 py-8">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="mt-1 max-w-[42ch] text-[13px] text-sales-text-secondary">{detail}</p>
    </li>
  );
}

function Bones() {
  return (
    <li className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3" aria-hidden>
      <div className="min-w-0 flex-1 space-y-1.5">
        <span className="re-bone block h-3.5 w-36 max-w-[46%] rounded-[4px]" />
        <span className="re-bone block h-3 w-28 max-w-[36%] rounded-[4px]" />
        <span className="re-bone block h-3 w-52 max-w-[62%] rounded-[4px]" />
      </div>
      <span className="re-bone h-9 w-16 shrink-0 rounded-[8px]" />
    </li>
  );
}
