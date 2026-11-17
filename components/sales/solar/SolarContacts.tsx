"use client";

import { useEffect, useMemo, useState } from "react";
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
    return (
      <div className="so-book">
        <button type="button" className={lineBtn} onClick={() => setOpenId("")}>Back to contacts</button>
        <h1 className="mt-4 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{open.name || "Unnamed contact"}</h1>
        <p className="mt-2 text-[14px] text-sales-text-secondary">{stageLabel(lead?.status)} · {open.owner ? `With ${open.owner}` : "Unassigned"}</p>
        <div className="mt-5 grid gap-3">
          {saved.map((line) => (
            <div key={line.label} className="flex items-center justify-between gap-3 border border-sales-border px-3 py-2">
              <a href={line.href} className="min-w-0">
                <span className="block text-[12px] text-sales-text-muted">{line.label}</span>
                <span className="block truncate text-[14px]">{line.value}</span>
              </a>
              <button type="button" className={lineBtn} onClick={() => void copyText(line.value)}>Copy</button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {phone ? <a className={lineBtn} href={`tel:${phone}`}>Call</a> : null}
          {phone ? <a className={lineBtn} href={`https://wa.me/${digits(phone)}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}
          {open.email ? <a className={lineBtn} href={`mailto:${open.email}`}>Email</a> : <button type="button" className={lineBtn} disabled>Email</button>}
          {phone ? <a className={lineBtn} href={`sms:${phone}`}>Text</a> : null}
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

  return (
    <div className="so-book">
      <p className="text-[13px] text-sales-text-muted">Contacts</p>
      <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Contacts</h1>
      <p className="mt-2 max-w-[62ch] text-[14px] text-sales-text-secondary">Every person in the account, with the number, the last touch, and where the job stands.</p>
      <section className="mt-6" aria-label="Your book">
        <div className="space-y-2">
          {GROUPS.map((group) => {
            const count = mine.filter((row) => stageGroup((row.latestLead ?? row.activeLead)?.status) === group.id).length;
            return (
              <button key={group.id} type="button" className="grid w-full grid-cols-[92px_1fr_24px] items-center gap-3 text-left" onClick={() => { setYours(true); setWho(group.id); setWhen("any"); }}>
                <span className="text-[13px]">{group.label}</span>
                <span className="h-2 bg-sales-surface-hover"><span className="block h-2 bg-sales-text-primary" style={{ width: count ? `${Math.max(14, (count / pulsePeak) * 100)}%` : "0%" }} /></span>
                <span className="text-[13px] tabular-nums">{count}</span>
              </button>
            );
          })}
          <button type="button" className="pt-1 text-left text-[13px] text-sales-text-secondary" onClick={() => { setYours(true); setWho("lost"); setWhen("any"); }}>
            {mine.filter((row) => stageGroup((row.latestLead ?? row.activeLead)?.status) === "lost").length} lost
          </button>
        </div>
      </section>
      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_180px_180px]">
        <input className="so-field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, number, email" aria-label="Search contacts" />
        <select className="so-field" value={when} aria-label="When" onChange={(event) => { setWhen(event.target.value as When); setYours(false); }}>
          <option value="any">Any time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This week</option>
          <option value="custom">Choose dates</option>
        </select>
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
      </div>
      {when === "custom" ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input type="date" className="so-field" value={from} aria-label="From" onChange={(event) => setFrom(event.target.value)} />
          <input type="date" className="so-field" value={to} aria-label="To" onChange={(event) => setTo(event.target.value)} />
        </div>
      ) : null}
      <p className="mt-3 text-[13px] text-sales-text-muted">{error || `${shown.length} contacts${yours || who === "mine" ? " · yours" : ""}`}</p>
      {picked.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className="so-field" value={assignee} aria-label="Assign to" onChange={(event) => setAssignee(event.target.value)}>
            <option value="">Assign to</option>
            {team.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <button type="button" className={lineBtn} disabled={!assignee} onClick={() => void assignSelected()}>Assign {picked.length}</button>
        </div>
      ) : null}
      {notice ? <p className="mt-2 text-[13px] text-sales-text-secondary" role="status">{notice}</p> : null}
      <ul className="mt-4 divide-y divide-sales-border border-y border-sales-border">
        {shown.map((row) => {
          const lead = row.latestLead ?? row.activeLead;
          return (
            <li key={row.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 py-3">
              <input type="checkbox" aria-label={`Mark ${row.name || "contact"}`} checked={picked.includes(row.id)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} />
              <button type="button" className="min-w-0 text-left" onClick={() => setOpenId(row.id)}>
                <span className="block truncate text-[15px] font-semibold">{row.name || "Unnamed contact"}</span>
                <span className="block truncate text-[13px] text-sales-text-secondary">{row.phone || "No phone"} · {stageLabel(lead?.status)}</span>
                <span className="block truncate text-[12px] text-sales-text-muted">{row.lastTouchedAt ? `Last touch ${new Date(row.lastTouchedAt).toLocaleDateString()}` : "No activity yet"}</span>
              </button>
              {row.phone ? <a className={lineBtn} href={`tel:${row.phone}`}>Call</a> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
