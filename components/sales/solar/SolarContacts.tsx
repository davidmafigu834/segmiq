"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone, Search } from "lucide-react";
import type { ContactTimelineEvent } from "@/lib/customer-hub/build-contact-timeline";
import type { ContactListItem } from "@/lib/customer-hub/contact-list-types";
import { lineBtn } from "./desk";
import "./solar-desk.css";

type Teammate = { id: string; name: string };
type When = "any" | "today" | "yesterday" | "week" | "custom";
type Who = "all" | "mine" | "new" | "talking" | "visit" | "quote" | "won" | "lost";
type Group = Exclude<Who, "all" | "mine"> | "none";

const GROUPS: { id: Exclude<Group, "none">; label: string }[] = [
  { id: "new", label: "New" },
  { id: "talking", label: "Contacted" },
  { id: "visit", label: "Visit" },
  { id: "quote", label: "Quotation" },
  { id: "won", label: "Won" },
];

function dayKey(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function shift(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dayKey(date.toISOString());
}

function stageGroup(status: string | null | undefined): Group {
  if (!status) return "none";
  if (status === "NEW" || status === "NEW_LEAD") return "new";
  if (status === "LOST" || status === "NOT_QUALIFIED") return "lost";
  if (status === "WON" || status === "CONVERTED_TO_DEAL") return "won";
  if (status.includes("VISIT")) return "visit";
  if (status.includes("PROPOSAL") || status.includes("QUOTE") || status === "NEGOTIATION" || status === "NEGOTIATING") return "quote";
  return "talking";
}

function stageLabel(status: string | null | undefined) {
  if (!status) return "No open lead";
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function digits(phone: string | null) {
  return (phone ?? "").replace(/\D/g, "");
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function SolarContacts({
  you,
  team,
  initialContactId,
}: {
  you: string;
  team: Teammate[];
  initialContactId?: string;
}) {
  const [rows, setRows] = useState<ContactListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState<When>("any");
  const [who, setWho] = useState<Who>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [yours, setYours] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [assignee, setAssignee] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState(initialContactId ?? "");
  const [events, setEvents] = useState<ContactTimelineEvent[]>([]);
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const today = dayKey(new Date().toISOString());
  const yesterday = shift(-1);
  const weekStart = (() => {
    const date = new Date();
    const delta = date.getDay() === 0 ? 6 : date.getDay() - 1;
    date.setDate(date.getDate() - delta);
    return dayKey(date.toISOString());
  })();

  useEffect(() => {
    let live = true;
    void fetch("/api/contacts/list?limit=200")
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { contacts?: ContactListItem[]; error?: string };
        if (!live) return;
        if (!res.ok) {
          setError(json.error || "Could not load contacts.");
          return;
        }
        setRows(json.contacts ?? []);
      })
      .catch(() => {
        if (live) setError("Could not load contacts.");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!openId) return;
    let live = true;
    setHistoryNote(null);
    void fetch(`/api/contacts/${openId}/timeline`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as { events?: ContactTimelineEvent[]; error?: string };
        if (!live) return;
        if (!res.ok) {
          setHistoryNote(json.error || "History could not be loaded.");
          setEvents([]);
          return;
        }
        setEvents(json.events ?? []);
      })
      .catch(() => {
        if (live) setHistoryNote("History could not be loaded.");
      });
    return () => {
      live = false;
    };
  }, [openId]);

  const mine = useMemo(() => rows.filter((row) => row.owner === you), [rows, you]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const needleDigits = digits(query);
    return rows.filter((row) => {
      const lead = row.latestLead ?? row.activeLead;
      const group = stageGroup(lead?.status);
      const ownerMine = row.owner === you;
      if ((yours || who === "mine") && !ownerMine) return false;
      if (who !== "all" && who !== "mine" && group !== who) return false;
      const touched = dayKey(row.lastTouchedAt);
      if (when === "today" && touched !== today) return false;
      if (when === "yesterday" && touched !== yesterday) return false;
      if (when === "week" && (touched < weekStart || touched > today)) return false;
      if (when === "custom" && ((from && touched < from) || (to && touched > to))) return false;
      if (!needle && needleDigits.length < 3) return true;
      const hay = `${row.name ?? ""} ${row.email ?? ""} ${row.source ?? ""} ${row.phone ?? ""}`.toLowerCase();
      return hay.includes(needle) || (needleDigits.length >= 3 && digits(row.phone).includes(needleDigits));
    });
  }, [from, query, rows, to, today, weekStart, when, who, yesterday, you, yours]);

  const open = rows.find((row) => row.id === openId) ?? null;
  const pulsePeak = Math.max(1, ...GROUPS.map((group) => mine.filter((row) => stageGroup((row.latestLead ?? row.activeLead)?.status) === group.id).length));

  async function transfer(leadId: string, userId: string) {
    const res = await fetch(`/api/leads/${leadId}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to_id: userId }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error || "Could not transfer.");
  }

  async function assignSelected() {
    if (!assignee) return;
    const chosen = rows.filter((row) => picked.includes(row.id));
    const name = team.find((person) => person.id === assignee)?.name ?? "that teammate";
    let moved = 0;
    let failed = 0;
    for (const row of chosen) {
      const leadId = row.activeLead?.id ?? row.latestLead?.id;
      if (!leadId) {
        failed += 1;
        continue;
      }
      try {
        await transfer(leadId, assignee);
        moved += 1;
        row.owner = name;
      } catch {
        failed += 1;
      }
    }
    setRows([...rows]);
    setPicked([]);
    setNotice(failed ? `${moved} assigned. ${failed} stayed where they were.` : `${moved} assigned to ${name}.`);
  }

  if (open) {
    const lead = open.latestLead ?? open.activeLead;
    const phone = open.phone;
    const saved = [
      phone ? { label: "Phone", value: phone, href: `tel:${phone}` } : null,
      open.email ? { label: "Email", value: open.email, href: `mailto:${open.email}` } : null,
    ].filter(Boolean) as { label: string; value: string; href: string }[];
    const mark = (open.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
    return (
      <div className="so-contact">
        <button type="button" className={lineBtn} onClick={() => setOpenId("")}>Back to contacts</button>
        <header className="so-contact-hero">
          <span className="so-lead-mark" aria-hidden>{mark}</span>
          <div>
            <p className="so-contact-kicker">{stageLabel(lead?.status)}</p>
            <h1>{open.name || "Unnamed contact"}</h1>
            <p className="so-contact-sub">{open.owner ? `With ${open.owner}` : "Unassigned"}</p>
          </div>
        </header>
        <div className="so-saved">
          {saved.map((line) => (
            <div key={line.label} className="so-saved-row">
              <span>{line.label}</span>
              <a href={line.href}>{line.value}</a>
              <button type="button" className={lineBtn} onClick={() => void copyText(line.value)}>Copy</button>
            </div>
          ))}
        </div>
        <div className="so-reach">
          {phone ? <a className="so-lead-qa" href={`tel:${phone}`}>Call</a> : null}
          {phone ? <a className="so-lead-qa" href={`https://wa.me/${digits(phone)}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}
          {open.email ? <a className="so-lead-qa" href={`mailto:${open.email}`}>Email</a> : <button type="button" className="so-lead-qa" disabled>Email</button>}
          {phone ? <a className="so-lead-qa" href={`sms:${phone}`}>Text</a> : null}
        </div>
        <p className="mt-5 text-[13px] text-sales-text-secondary">Came in through {open.source || "an unrecorded source"}.</p>
        {lead ? (
          <label className="so-label mt-4 block">
            Transfer
            <select className="so-field" defaultValue="" onChange={(event) => {
              const userId = event.target.value;
              if (!userId) return;
              void transfer(lead.id, userId)
                .then(() => {
                  const person = team.find((item) => item.id === userId);
                  open.owner = person?.name ?? open.owner;
                  setRows([...rows]);
                  setNotice(`Transferred to ${person?.name ?? "that teammate"}.`);
                })
                .catch((reason: Error) => setNotice(reason.message));
            }}>
              <option value="">Choose a teammate</option>
              {team.filter((person) => person.name !== open.owner).map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {notice ? <p className="mt-3 text-[13px] text-sales-text-secondary" role="status">{notice}</p> : null}
        <h2 className="mt-6 text-[13px] font-semibold">History</h2>
        {historyNote ? <p className="mt-2 text-[13px] text-sales-text-secondary">{historyNote}</p> : null}
        <ol className="mt-3 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="border-l border-sales-border pl-3">
              <p className="text-[14px]">{event.event_type.replaceAll("_", " ")}</p>
              <p className="text-[12px] text-sales-text-muted">{event.actor_name} · {new Date(event.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const lostCount = mine.filter((row) => stageGroup((row.latestLead ?? row.activeLead)?.status) === "lost").length;
  const touches = [
    { id: "today" as const, label: "Today", count: mine.filter((row) => dayKey(row.lastTouchedAt) === today).length },
    { id: "yesterday" as const, label: "Yesterday", count: mine.filter((row) => dayKey(row.lastTouchedAt) === yesterday).length },
    { id: "week" as const, label: "This week", count: mine.filter((row) => { const day = dayKey(row.lastTouchedAt); return day >= weekStart && day <= today; }).length },
  ];
  const touchPeak = Math.max(1, ...touches.map((item) => item.count));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Contacts</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] text-sales-text-secondary">Every number, address, and conversation is kept here. Search a name or the part of a number you still remember.</p>
      </div>
      <section className="so-pulse" aria-label="Your book">
        <header className="so-pulse-head">
          <p>Your book</p>
          <h2>{you || "You"}</h2>
          <p>{lostCount ? `${lostCount} lost.` : "This is where your contacts stand."}</p>
        </header>
        <div className="so-pulse-grid">
          <div>
            <h3>Pipeline</h3>
            <div className="so-funnel">
              {GROUPS.map((group) => {
                const count = mine.filter((row) => stageGroup((row.latestLead ?? row.activeLead)?.status) === group.id).length;
                return (
                  <button key={group.id} type="button" aria-pressed={yours && who === group.id} onClick={() => { setYours(true); setWho(group.id); setWhen("any"); }}>
                    <span>{group.label}</span>
                    <span className="so-funnel-track" aria-hidden><span className="so-funnel-fill" style={{ width: count ? `${Math.max(14, (count / pulsePeak) * 100)}%` : "0%" }} /></span>
                    <span className="so-funnel-n">{count}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="so-funnel-lost" aria-pressed={yours && who === "lost"} onClick={() => { setYours(true); setWho("lost"); setWhen("any"); }}>
              Lost <span>{lostCount}</span>
            </button>
          </div>
          <div>
            <h3>Touched</h3>
            <div className="so-cols">
              {touches.map((item) => (
                <button key={item.id} type="button" aria-pressed={yours && when === item.id} onClick={() => { setYours(true); setWho("all"); setWhen(item.id); }}>
                  <span className="so-col-n">{item.count}</span>
                  <span className="so-col-bar" style={{ height: `${Math.max(6, (item.count / touchPeak) * 72)}px` }} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="so-book-tools">
        <label className="so-book-find">
          <Search size={16} strokeWidth={1.8} aria-hidden />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, number, suburb, email" aria-label="Find a contact" />
        </label>
        <div className="so-book-picks">
          <label>
            When
            <select className="so-field" value={when} aria-label="When they were touched" onChange={(event) => { setWhen(event.target.value as When); setYours(false); }}>
          <option value="any">Any time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This week</option>
          <option value="custom">Choose dates</option>
            </select>
          </label>
          <label>
            Stage
            <select className="so-field" value={who} aria-label="Stage" onChange={(event) => {
              const value = event.target.value as Who;
              setWho(value);
              setYours(value === "mine");
            }}>
              <option value="all">All contacts</option>
              <option value="mine">Mine</option>
              <option value="new">New</option>
              <option value="talking">Contacted</option>
              <option value="visit">Visit</option>
              <option value="quote">Quotation</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </label>
        </div>
      {when === "custom" ? (
        <div className="so-book-dates">
          <label>From<input type="date" className="so-field" value={from} aria-label="From" onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To<input type="date" className="so-field" value={to} aria-label="To" onChange={(event) => setTo(event.target.value)} /></label>
        </div>
      ) : null}
      <p className="so-book-count">{error || `${shown.length} contacts${yours || who === "mine" ? " · yours" : ""}`}</p>
      </div>
      {picked.length ? (
        <form className="so-book-assign" onSubmit={(event) => { event.preventDefault(); void assignSelected(); }}>
          <p>{picked.length} marked</p>
          <label>
            Assign to
            <select className="so-field" value={assignee} aria-label="Assign to" onChange={(event) => setAssignee(event.target.value)}>
              <option value="">Choose</option>
              {team.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <button type="submit" className={lineBtn} disabled={!assignee}>Assign</button>
          <button type="button" className={lineBtn} onClick={() => setPicked([])}>Clear</button>
        </form>
      ) : null}
      {notice ? <p className="text-[13px] text-sales-text-secondary" role="status">{notice}</p> : null}
      <ul className="so-book-list">
        {shown.map((row) => {
          const lead = row.latestLead ?? row.activeLead;
          const mark = (row.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
          return (
            <li key={row.id} className="so-book-item">
              <input type="checkbox" aria-label={`Mark ${row.name || "contact"}`} checked={picked.includes(row.id)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} />
              <button type="button" className="so-book-open" onClick={() => setOpenId(row.id)}>
                <span className="so-lead-mark" aria-hidden>{mark}</span>
                <span className="min-w-0">
                  <span className="so-book-name">{row.name || "Unnamed contact"}</span>
                  <span className="so-book-phone">{row.phone || "No phone"}</span>
                  <span className="so-book-meta">{row.lastTouchedAt ? `Last touch ${new Date(row.lastTouchedAt).toLocaleDateString()}` : "No activity yet"}</span>
                </span>
                <span className="so-book-stage">{stageLabel(lead?.status)}</span>
              </button>
              {row.phone ? <a className="so-book-call" href={`tel:${row.phone}`} aria-label={`Call ${row.name || "contact"}`}><Phone size={16} strokeWidth={1.8} aria-hidden /></a> : <span />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
