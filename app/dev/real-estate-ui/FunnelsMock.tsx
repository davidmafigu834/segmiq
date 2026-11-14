"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · component-scope */
/* Hallmark · pre-emit critique: P5 H4 E4 S5 R4 V4 */

import { useEffect, useId, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Bell, CalendarPlus, Camera, Check, Copy, Download, Eye, Link2, MessageCircle, Phone, Plus, Share2, Trophy, X } from "lucide-react";

const AGENCY = "Landlords Junction Properties";
const DOMAIN = "segmiq.com/p";

export type FunnelProfile = {
  ready: boolean;
  handle: string;
  name: string;
  first: string;
  initials: string;
  role: string;
  whatsapp: string;
  line: string;
};

let profile: FunnelProfile = {
  ready: false,
  handle: "tatenda",
  name: "Tatenda Marufu",
  first: "Tatenda",
  initials: "TM",
  role: "Property Sales Negotiator",
  whatsapp: "+263 77 000 0002",
  line: "Hi, I'm Tatenda. I'll personally walk you through every property I share.",
};
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFunnelProfile() {
  return useSyncExternalStore(subscribe, () => profile, () => profile);
}

function saveProfile(next: FunnelProfile) {
  profile = next;
  listeners.forEach((listener) => listener());
}

type Channel = { id: string; label: string; visits: number; enquiries: number };

type Funnel = {
  id: string;
  slug: string;
  name: string;
  place: string;
  kind: string;
  price: string;
  status: "live" | "building";
  since: string | null;
  photo: string;
  headline: string;
  summary: string;
  pitch: string;
  visits: number;
  whatsapp: number;
  enquiries: number;
  viewings: number;
  channels: Channel[];
};

function frame(body: string) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">${body}</svg>`)}`;
}

const FUNNELS: Funnel[] = [
  {
    id: "charter",
    slug: "charter-house",
    name: "Charter House",
    place: "Bulawayo CBD",
    kind: "Commercial",
    price: "US$2,600,000",
    status: "live",
    since: "13 Nov 2026",
    photo: "/listings/charter-house/charter-house-tower.jpg",
    headline: "Charter House | Landmark CBD investment in Bulawayo",
    summary: "95 offices, 3,776.83 sqm lettable, secure underground parking.",
    pitch: "95 offices, 3,776.83 sqm of lettable space and secure underground parking, in the middle of the CBD.",
    visits: 128,
    whatsapp: 17,
    enquiries: 3,
    viewings: 2,
    channels: [
      { id: "wa", label: "WhatsApp Status", visits: 61, enquiries: 1 },
      { id: "fb", label: "Facebook", visits: 39, enquiries: 1 },
      { id: "portal", label: "Property portal", visits: 28, enquiries: 1 },
    ],
  },
  {
    id: "baines",
    slug: "2-baines-avenue",
    name: "2 Baines Avenue",
    place: "Avondale",
    kind: "House",
    price: "US$185,000",
    status: "live",
    since: "2 Nov 2026",
    photo: frame(`<rect width="800" height="500" fill="#d7cfc3"/><rect y="340" width="800" height="160" fill="#c4b8a8"/><rect x="170" y="150" width="460" height="230" fill="#efeae3"/><path d="M140 190 L400 70 L660 190" fill="#2f3a32"/><rect x="360" y="250" width="80" height="130" fill="#c8bfb2"/><rect x="230" y="210" width="70" height="55" fill="#9eb0b8"/><rect x="500" y="210" width="70" height="55" fill="#9eb0b8"/>`),
    headline: "2 Baines Avenue | Family home in Avondale",
    summary: "4 bedrooms, 2 bathrooms, a garden at the back.",
    pitch: "4 bedrooms, 2 bathrooms and a garden at the back, on a quiet avenue.",
    visits: 74,
    whatsapp: 9,
    enquiries: 1,
    viewings: 1,
    channels: [
      { id: "wa", label: "WhatsApp Status", visits: 40, enquiries: 1 },
      { id: "fb", label: "Facebook", visits: 34, enquiries: 0 },
    ],
  },
  {
    id: "stonechat",
    slug: "8-stonechat-lane",
    name: "8 Stonechat Lane",
    place: "Borrowdale",
    kind: "House",
    price: "Price to be confirmed",
    status: "building",
    since: null,
    photo: frame(`<rect width="800" height="500" fill="#e7efe4"/><rect y="300" width="800" height="200" fill="#b7c7a4"/><circle cx="180" cy="230" r="70" fill="#6e8a62"/><rect x="168" y="280" width="24" height="70" fill="#6a5644"/><rect x="480" y="160" width="220" height="150" fill="#efeae3"/><path d="M460 190 L590 90 L720 190" fill="#2f3a32"/>`),
    headline: "",
    summary: "",
    pitch: "",
    visits: 0,
    whatsapp: 0,
    enquiries: 0,
    viewings: 0,
    channels: [],
  },
];

type LeadStatus = "New" | "Contacted" | "Viewing booked";

type Lead = {
  id: string;
  name: string;
  buyer: string;
  funnelId: string;
  when: string;
  channel: string;
  status: LeadStatus;
  wants: string;
  message: string;
  steps: Array<[string, string]>;
};

const LEADS: Lead[] = [
  {
    id: "tinashe",
    name: "Tinashe Gumbo",
    buyer: "Property company",
    funnelId: "charter",
    when: "4 minutes ago",
    channel: "WhatsApp Status",
    status: "New",
    wants: "Information pack and a viewing",
    message: "We would like to view next week. Can you share the tenancy schedule before then?",
    steps: [
      ["14:02", "Opened your WhatsApp Status link"],
      ["14:04", "Looked through all 3 photos"],
      ["14:06", "Used the yield calculator"],
      ["14:09", "Asked for the information pack and a viewing"],
    ],
  },
  {
    id: "farai",
    name: "Farai Sibanda",
    buyer: "Private investor",
    funnelId: "charter",
    when: "Yesterday",
    channel: "Facebook",
    status: "Viewing booked",
    wants: "A viewing",
    message: "Is the building fully let at the moment?",
    steps: [
      ["19:40", "Opened your Facebook link"],
      ["19:43", "Read the investment snapshot"],
      ["19:45", "Asked for a viewing"],
    ],
  },
  {
    id: "blessing",
    name: "Blessing Mpofu",
    buyer: "Pension fund",
    funnelId: "charter",
    when: "5 days ago",
    channel: "Property portal",
    status: "Contacted",
    wants: "Information pack",
    message: "Please send the information pack to our investment committee.",
    steps: [
      ["10:12", "Opened your property portal link"],
      ["10:15", "Asked for the information pack"],
    ],
  },
  {
    id: "kudzai",
    name: "Kudzai Ncube",
    buyer: "Buyer",
    funnelId: "baines",
    when: "3 days ago",
    channel: "WhatsApp Status",
    status: "Contacted",
    wants: "A viewing",
    message: "Can we see it on Saturday morning?",
    steps: [
      ["08:20", "Opened your WhatsApp Status link"],
      ["08:24", "Asked for a viewing"],
    ],
  },
];

const RANKING = [
  { name: "Danny", initials: "D", visits: 296, enquiries: 9 },
  { name: "Rudo Ndlovu", initials: "RN", visits: 241, enquiries: 6 },
  { name: "Tatenda Marufu", initials: "TM", visits: 202, enquiries: 4, you: true },
  { name: "Nyasha Mlambo", initials: "NM", visits: 88, enquiries: 2 },
];

const TAKEN = ["danny", "rudo", "nyasha", "admin"];

function funnelById(id: string | null | undefined) {
  return FUNNELS.find((funnel) => funnel.id === id) ?? FUNNELS[0];
}

function linkFor(funnel: Funnel, handle: string, channel?: string) {
  return `${DOMAIN}/${funnel.slug}/${handle}${channel ? `/${channel}` : ""}`;
}

const btn = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover";
const lime = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text transition-opacity hover:opacity-90";
const bigLime = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-opacity hover:opacity-90";
const bigBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover";

function useCopied() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text.startsWith("segmiq.com") ? `https://${text}` : text);
    } catch {
      /* The status line still confirms what was prepared. */
    }
    setCopied(key);
  }
  return { copied, copy };
}

function Avatar({ initials, you = false, size = "md" }: { initials: string; you?: boolean; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "h-14 w-14 text-[18px]" : size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-[13px]";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${box} ${you ? "bg-sales-text-primary text-sales-brand" : "bg-sales-surface-active text-sales-text-secondary"}`} aria-hidden>
      {initials}
    </span>
  );
}

function StatusChip({ status }: { status: Funnel["status"] | LeadStatus }) {
  const tone =
    status === "live" || status === "Viewing booked"
      ? "bg-sales-success-soft text-sales-success-fg"
      : status === "New"
        ? "bg-sales-brand text-sales-brand-text"
        : status === "building"
          ? "bg-sales-info-soft text-sales-info-fg"
          : "bg-sales-warning-soft text-sales-warning-fg";
  const label = status === "live" ? "Live" : status === "building" ? "Being built" : status;
  return <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[12px] font-semibold ${tone}`}>{label}</span>;
}

function HandleLink({ funnel, handle, channel }: { funnel: Funnel; handle: string; channel?: string }) {
  return (
    <span className="re-fn-link font-mono">
      {DOMAIN}/{funnel.slug}/<mark>{handle}</mark>
      {channel ? `/${channel}` : ""}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Funnels list                                                         */
/* ------------------------------------------------------------------ */

export function FunnelsMock({ loading, onOpen, onSetup }: { loading: boolean; onOpen: (focus: string) => void; onSetup: () => void }) {
  const me = useFunnelProfile();
  const [share, setShare] = useState<Funnel | null>(null);
  const { copied, copy } = useCopied();

  if (loading) {
    return (
      <div className="space-y-5" aria-hidden>
        <span className="re-bone block h-8 w-40 rounded-[6px]" />
        <span className="re-bone block h-24 rounded-[12px]" />
        <span className="re-bone block h-28 rounded-[12px]" />
        <span className="re-bone block h-28 rounded-[12px]" />
      </div>
    );
  }

  const live = FUNNELS.filter((funnel) => funnel.status === "live");
  const totals = live.reduce(
    (sum, funnel) => ({ visits: sum.visits + funnel.visits, whatsapp: sum.whatsapp + funnel.whatsapp, enquiries: sum.enquiries + funnel.enquiries, viewings: sum.viewings + funnel.viewings }),
    { visits: 0, whatsapp: 0, enquiries: 0, viewings: 0 },
  );
  const fresh = LEADS.find((lead) => lead.status === "New");

  function shareOrSetup(funnel: Funnel) {
    if (!me.ready) onSetup();
    else setShare(funnel);
  }

  return (
    <div className="re-fn space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">Marketing</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Funnels</h1>
          <p className="mt-2 max-w-[62ch] text-[14px] text-sales-text-secondary">Property pages the SegmiQ team builds for {AGENCY}. Every one you share carries your name, photo and WhatsApp, so the buyer comes to you.</p>
        </div>
        {me.ready ? (
          <button type="button" className={btn} onClick={onSetup}>
            <Avatar initials={me.initials} you size="sm" />
            Your link details
          </button>
        ) : null}
      </header>

      {!me.ready ? (
        <section className="re-in flex flex-wrap items-center gap-4 rounded-[12px] border border-sales-border border-l-[3px] border-l-sales-brand bg-sales-surface px-4 py-4" aria-labelledby="fn-setup">
          <Avatar initials={me.initials} you size="lg" />
          <div className="min-w-[200px] flex-1">
            <h2 id="fn-setup" className="text-[15px] font-semibold">Set up your funnel link first</h2>
            <p className="mt-1 text-[13px] text-sales-text-secondary">Choose your link name and how buyers see you. You do this once, and it applies to every funnel.</p>
          </div>
          <button type="button" className={bigLime} onClick={onSetup}>Set up my link</button>
        </section>
      ) : fresh ? (
        <section className="re-in flex flex-wrap items-center gap-3 rounded-[12px] bg-sales-text-primary px-4 py-3 text-sales-surface" aria-label="New enquiry">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-sales-brand text-sales-brand-text" aria-hidden>
            <Bell size={16} strokeWidth={2} />
          </span>
          <div className="min-w-[180px] flex-1">
            <p className="text-[14px] font-semibold">New enquiry from {fresh.name}</p>
            <p className="text-[13px] opacity-80">{funnelById(fresh.funnelId).name} · from your {fresh.channel} link · {fresh.when}</p>
          </div>
          <button type="button" className={lime} onClick={() => onOpen(`${fresh.funnelId}:${fresh.id}`)}>Open lead</button>
        </section>
      ) : null}

      <div className="grid items-start gap-x-4 gap-y-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.85fr)]">
        <section className="min-w-0" aria-labelledby="fn-list">
          <h2 id="fn-list" className="mb-3 flex items-center gap-2 font-display text-[18px] font-semibold leading-tight tracking-[-0.02em]">
            Your funnels
            <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-sales-border bg-sales-surface px-1.5 font-sans text-[12px] font-semibold tabular-nums tracking-normal">{FUNNELS.length}</span>
          </h2>
          <ul className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
            {FUNNELS.map((funnel, index) => (
              <li key={funnel.id} className="re-in flex flex-wrap items-center gap-3 border-t border-sales-border-subtle px-4 py-3 first:border-t-0" style={{ animationDelay: `${index * 40}ms` }}>
                <button type="button" onClick={() => onOpen(funnel.id)} className="flex min-w-[220px] flex-1 items-center gap-3 text-left" aria-label={`Open ${funnel.name}`}>
                  <img src={funnel.photo} alt="" className={`h-14 w-20 shrink-0 rounded-[8px] object-cover ${funnel.status === "building" ? "opacity-60" : ""}`} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold">{funnel.name}</span>
                      <StatusChip status={funnel.status} />
                    </span>
                    <span className="block text-[12px] text-sales-text-muted">{funnel.kind} · {funnel.place} · {funnel.price}</span>
                    <span className="mt-0.5 block text-[13px] text-sales-text-secondary">
                      {funnel.status !== "live" ? "Your link appears here when it goes live." : !me.ready ? "Ready to share once your link is set up." : `${funnel.visits} visits from your links · ${funnel.enquiries} ${funnel.enquiries === 1 ? "enquiry" : "enquiries"}`}
                    </span>
                  </span>
                </button>
                {funnel.status === "live" ? (
                  <div className="flex gap-2">
                    <button type="button" className={lime} onClick={() => shareOrSetup(funnel)}>
                      <Share2 size={14} strokeWidth={2} aria-hidden />
                      Share
                    </button>
                    <button type="button" className={btn} onClick={() => (me.ready ? void copy(funnel.id, linkFor(funnel, me.handle)) : onSetup())}>
                      {copied === funnel.id ? "Copied" : "Copy link"}
                    </button>
                  </div>
                ) : (
                  <button type="button" className={btn} onClick={() => onOpen(funnel.id)}>Progress</button>
                )}
              </li>
            ))}
          </ul>
          {copied ? <p className="mt-2 text-[13px] text-sales-text-secondary" role="status">Copied {linkFor(funnelById(copied), me.handle)}</p> : null}
        </section>

        <div className="space-y-6">
          <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4" aria-labelledby="fn-totals">
            <h2 id="fn-totals" className="text-[15px] font-semibold">Your links, last 30 days</h2>
            {!me.ready ? <p className="mt-1 text-[12px] text-sales-text-muted">Counts start when you share your first link.</p> : null}
            <dl className="mt-3 grid grid-cols-2 gap-4">
              {[
                ["Visits", totals.visits],
                ["WhatsApp taps", totals.whatsapp],
                ["Enquiries", totals.enquiries],
                ["Viewing requests", totals.viewings],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[12px] text-sales-text-muted">{label}</dt>
                  <dd className={`mt-1 text-[26px] font-semibold leading-none tabular-nums tracking-[-0.03em] ${me.ready ? "" : "text-sales-text-muted"}`}>{me.ready ? value : 0}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface" aria-labelledby="fn-rank">
            <div className="flex items-center gap-2 px-4 pb-2 pt-4">
              <Trophy size={16} strokeWidth={2} aria-hidden className="text-sales-text-muted" />
              <h2 id="fn-rank" className="text-[15px] font-semibold">Agency ranking</h2>
            </div>
            <p className="px-4 text-[12px] text-sales-text-muted">Enquiries from funnel links, last 30 days</p>
            <ol className="mt-2">
              {[...RANKING].sort((a, b) => (b.you && !me.ready ? -1 : b.enquiries) - (a.you && !me.ready ? -1 : a.enquiries)).map((row, index) => (
                <li key={row.name} className={`flex items-center gap-3 border-t border-sales-border-subtle px-4 py-2.5 ${row.you ? "bg-sales-surface-active" : ""}`}>
                  <span className="w-4 text-[13px] font-semibold tabular-nums text-sales-text-muted">{index + 1}</span>
                  <Avatar initials={row.initials} you={row.you} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{row.you ? `${row.name} (you)` : row.name}</span>
                    <span className="block text-[12px] text-sales-text-muted">{row.you && !me.ready ? "No link yet" : `${row.visits} visits`}</span>
                  </span>
                  <span className="text-[18px] font-semibold tabular-nums">{row.you && !me.ready ? 0 : row.enquiries}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <p className="text-[12px] text-sales-text-muted">Sample data. Nothing is saved or sent from this page.</p>

      {share ? <ShareSheet funnel={share} me={me} onClose={() => setShare(null)} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One funnel                                                           */
/* ------------------------------------------------------------------ */

export function FunnelRecord({ focus, onBack, onPreview, onSetup, onOpenInquiries }: { focus: string | null; onBack: () => void; onPreview: (funnelId: string) => void; onSetup: () => void; onOpenInquiries: () => void }) {
  const [funnelId, leadId] = (focus ?? "charter").split(":");
  const funnel = funnelById(funnelId);
  const me = useFunnelProfile();
  const [share, setShare] = useState(false);
  const [lead, setLead] = useState<Lead | null>(() => LEADS.find((row) => row.id === leadId) ?? null);
  const [channels, setChannels] = useState<Channel[]>(funnel.channels);
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const { copied, copy } = useCopied();
  const leads = LEADS.filter((row) => row.funnelId === funnel.id);
  const maxVisits = Math.max(1, ...channels.map((channel) => channel.visits));

  function addChannel(event: FormEvent) {
    event.preventDefault();
    const label = (adding ?? "").trim();
    if (!label) return setAddError("Name the channel, for example LinkedIn.");
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (channels.some((channel) => channel.id === id)) return setAddError("You already have a link for that channel.");
    setChannels((rows) => [...rows, { id, label, visits: 0, enquiries: 0 }]);
    setAdding(null);
    setAddError(null);
  }

  const back = (
    <button type="button" onClick={onBack} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
      <ArrowLeft size={14} strokeWidth={2} aria-hidden />
      Funnels
    </button>
  );

  if (funnel.status === "building") {
    const steps = [
      ["Brief and photos received", "done"],
      ["SegmiQ team writes the copy and designs the page", "now"],
      [`${AGENCY} approves the page`, "next"],
      ["Goes live, and your link appears", "next"],
    ] as const;
    return (
      <div className="re-fn space-y-5">
        {back}
        <header>
          <p className="text-[13px] font-medium text-sales-text-muted">{funnel.kind} · {funnel.place}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{funnel.name} <StatusChip status="building" /></h1>
          <p className="mt-2 max-w-[60ch] text-[14px] text-sales-text-secondary">The SegmiQ team is building this page. You can't share it yet. When it goes live it shows up in Funnels with your link ready.</p>
        </header>
        <ol className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
          {steps.map(([label, state]) => (
            <li key={label} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3 first:border-t-0">
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${state === "done" ? "bg-sales-text-primary text-sales-brand" : state === "now" ? "border-2 border-sales-text-primary" : "border border-sales-border"}`} aria-hidden>
                {state === "done" ? <Check size={13} strokeWidth={2.5} /> : null}
              </span>
              <span className={`text-[14px] ${state === "next" ? "text-sales-text-muted" : "font-semibold"}`}>{label}</span>
              {state === "now" ? <span className="ml-auto text-[12px] text-sales-text-muted">In progress</span> : null}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="re-fn space-y-6">
      {back}

      <header className="grid items-end gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <img src={funnel.photo} alt={funnel.name} className="aspect-[16/10] w-full rounded-[12px] object-cover" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">{funnel.kind} · {funnel.place}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{funnel.name} <StatusChip status="live" /></h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">{funnel.price} · Live since {funnel.since} · Built by the SegmiQ team</p>
        </div>
      </header>

      <div className="grid items-start gap-x-4 gap-y-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4" aria-labelledby="fn-mylink">
            <h2 id="fn-mylink" className="text-[15px] font-semibold">Your link</h2>
            {me.ready ? (
              <>
                <p className="mt-3 flex items-center gap-2 rounded-[8px] border border-dashed border-sales-border bg-sales-bg px-3 py-2.5 text-[13px]">
                  <Link2 size={15} strokeWidth={2} aria-hidden className="shrink-0 text-sales-text-muted" />
                  <HandleLink funnel={funnel} handle={me.handle} />
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={lime} onClick={() => setShare(true)}>
                    <Share2 size={14} strokeWidth={2} aria-hidden />
                    Share
                  </button>
                  <button type="button" className={btn} onClick={() => void copy("main", linkFor(funnel, me.handle))}>
                    <Copy size={14} strokeWidth={2} aria-hidden />
                    {copied === "main" ? "Copied" : "Copy"}
                  </button>
                  <button type="button" className={btn} onClick={() => onPreview(funnel.id)}>
                    <Eye size={14} strokeWidth={2} aria-hidden />
                    See it as a buyer
                  </button>
                </div>
                <p className="mt-3 text-[12px] text-sales-text-muted">Buyers who open this link see your name, photo and WhatsApp on the page. Their enquiries come to you.</p>
              </>
            ) : (
              <div className="mt-2">
                <p className="text-[13px] text-sales-text-secondary">You haven't set up your funnel link yet.</p>
                <button type="button" className={`${lime} mt-3`} onClick={onSetup}>Set up my link</button>
              </div>
            )}
          </section>

          {me.ready ? (
            <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface" aria-labelledby="fn-channels">
              <div className="px-4 pb-2 pt-4">
                <h2 id="fn-channels" className="text-[15px] font-semibold">Links by channel</h2>
                <p className="mt-1 text-[12px] text-sales-text-muted">Use a different link on each channel to see which one brings you buyers.</p>
              </div>
              <ul>
                {channels.map((channel) => (
                  <li key={channel.id} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">{channel.label}</span>
                      <span className="block truncate text-[12px] text-sales-text-muted">
                        <HandleLink funnel={funnel} handle={me.handle} channel={channel.id} />
                      </span>
                    </span>
                    <button type="button" className={btn} onClick={() => void copy(channel.id, linkFor(funnel, me.handle, channel.id))}>{copied === channel.id ? "Copied" : "Copy"}</button>
                  </li>
                ))}
              </ul>
              {adding == null ? (
                <button type="button" onClick={() => setAdding("")} className="flex w-full items-center gap-2 border-t border-sales-border-subtle px-4 py-3 text-left text-[13px] font-semibold text-sales-text-secondary transition-colors hover:bg-sales-surface-hover">
                  <Plus size={15} strokeWidth={2} aria-hidden />
                  Add a channel link
                </button>
              ) : (
                <form onSubmit={addChannel} className="border-t border-sales-border-subtle px-4 py-3">
                  <label className="block text-[13px] font-medium" htmlFor="fn-new-channel">Channel name</label>
                  <div className="mt-1.5 flex gap-2">
                    <input id="fn-new-channel" autoFocus value={adding} onChange={(event) => { setAdding(event.target.value); setAddError(null); }} placeholder="LinkedIn" className="h-9 min-w-0 flex-1 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px]" />
                    <button type="submit" className={lime}>Add</button>
                    <button type="button" className={btn} onClick={() => { setAdding(null); setAddError(null); }}>Cancel</button>
                  </div>
                  {addError ? <p className="mt-1.5 text-[12px] font-medium text-sales-danger-fg">{addError}</p> : null}
                </form>
              )}
            </section>
          ) : null}
          {copied ? <p className="text-[13px] text-sales-text-secondary" role="status">Link copied.</p> : null}
        </div>

        <div className="min-w-0 space-y-6">
          <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4" aria-labelledby="fn-results">
            <h2 id="fn-results" className="text-[15px] font-semibold">Your results, last 30 days</h2>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              {[
                ["Visits", funnel.visits],
                ["WhatsApp taps", funnel.whatsapp],
                ["Enquiries", funnel.enquiries],
                ["Viewing requests", funnel.viewings],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[12px] text-sales-text-muted">{label}</dt>
                  <dd className="mt-1 text-[26px] font-semibold leading-none tabular-nums tracking-[-0.03em]">{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-4 space-y-3 border-t border-sales-border-subtle pt-3">
              {channels.map((channel) => (
                <li key={channel.id}>
                  <div className="flex justify-between gap-3 text-[13px]">
                    <span className="font-medium">{channel.label}</span>
                    <span className="tabular-nums text-sales-text-muted">{channel.visits} visits · {channel.enquiries} enq.</span>
                  </div>
                  <span className="mt-1 block h-1 rounded-full bg-sales-text-primary" style={{ width: `${Math.max(2, (channel.visits / maxVisits) * 100)}%` }} aria-hidden />
                </li>
              ))}
            </ul>
          </section>

          <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface" aria-labelledby="fn-leads">
            <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
              <h2 id="fn-leads" className="text-[15px] font-semibold">Leads from your links</h2>
              <span className="text-[13px] tabular-nums text-sales-text-muted">{leads.length}</span>
            </div>
            <ul>
              {leads.map((row) => (
                <li key={row.id} className="border-t border-sales-border-subtle">
                  <button type="button" onClick={() => setLead(row)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sales-surface-hover">
                    <Avatar initials={row.name.split(" ").map((part) => part[0]).join("")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{row.name}</span>
                      <span className="block truncate text-[12px] text-sales-text-muted">{row.channel} · {row.when}</span>
                    </span>
                    <StatusChip status={row.status} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {share ? <ShareSheet funnel={funnel} me={me} onClose={() => setShare(false)} /> : null}
      {lead ? <LeadSheet lead={lead} funnel={funnel} onClose={() => setLead(null)} onOpenInquiries={onOpenInquiries} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sheets                                                               */
/* ------------------------------------------------------------------ */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="re-fn-layer">
      <button type="button" className="re-fn-backdrop" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="re-fn-sheet">
        <header className="flex items-center justify-between gap-3 border-b border-sales-border-subtle px-5 py-4">
          <h2 id={titleId} className="font-display text-[20px] font-semibold leading-tight tracking-[-0.02em]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sales-border bg-sales-surface transition-colors hover:bg-sales-surface-hover">
            <X size={16} strokeWidth={2} aria-hidden />
          </button>
        </header>
        <div className="re-fn-sheet-body px-5 py-4">{children}</div>
      </section>
    </div>
  );
}

type Tone = "personal" | "investor" | "short";

function messageFor(tone: Tone, funnel: Funnel, me: FunnelProfile) {
  const url = `https://${linkFor(funnel, me.handle)}`;
  if (tone === "investor") return `${funnel.name}, ${funnel.place}. Asking ${funnel.price}.\n\n${funnel.pitch}\n\nFull details, photos and figures:\n${url}\n\n${me.name}, ${AGENCY}`;
  if (tone === "short") return `${funnel.name} is for sale at ${funnel.price}. Have a look: ${url}`;
  return `Hi! It's ${me.first} from ${AGENCY}.\n\n${funnel.name} in ${funnel.place} is now for sale at ${funnel.price}. ${funnel.pitch}\n\nEverything is on one page:\n${url}\n\nReply here and I'll send you the information pack.`;
}

function ShareSheet({ funnel, me, onClose }: { funnel: Funnel; me: FunnelProfile; onClose: () => void }) {
  const [tab, setTab] = useState<"message" | "status">("message");
  const [tone, setTone] = useState<Tone>("personal");
  const [text, setText] = useState(() => messageFor("personal", funnel, me));
  const [done, setDone] = useState<string | null>(null);
  const { copied, copy } = useCopied();

  function pickTone(next: Tone) {
    setTone(next);
    setText(messageFor(next, funnel, me));
  }

  return (
    <Sheet title={`Share ${funnel.name}`} onClose={onClose}>
      <div className="grid grid-cols-2 rounded-[10px] border border-sales-border-subtle bg-sales-bg p-1" role="tablist" aria-label="Share as">
        {(["message", "status"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-9 rounded-[8px] text-[13px] font-semibold transition-colors ${tab === id ? "bg-sales-surface text-sales-text-primary shadow-sm" : "text-sales-text-muted"}`}>
            {id === "message" ? "Message" : "Status image"}
          </button>
        ))}
      </div>

      {tab === "message" ? (
        <div className="mt-4 space-y-4">
          <figure className="overflow-hidden rounded-[10px] border border-sales-border-subtle bg-sales-bg">
            <div className="relative">
              <img src={funnel.photo} alt="" className="aspect-[1.91/1] w-full object-cover" />
              <span className="absolute bottom-2 left-2 inline-flex items-center gap-2 rounded-full bg-black/60 py-1 pl-1 pr-3 text-[12px] font-semibold text-white">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f78800] text-[11px] text-[#042462]">{me.initials}</span>
                {me.first}, Landlords Junction
              </span>
            </div>
            <figcaption className="px-3 py-2.5">
              <p className="text-[13px] font-semibold leading-5">{funnel.headline}</p>
              <p className="mt-0.5 text-[12px] text-sales-text-muted">{funnel.summary}</p>
              <p className="mt-1 text-[12px] text-sales-text-muted">segmiq.com</p>
            </figcaption>
          </figure>
          <p className="text-[12px] text-sales-text-muted">This is the card WhatsApp shows under your message, with your name on it.</p>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Message style">
            {(["personal", "investor", "short"] as const).map((id) => (
              <button key={id} type="button" aria-pressed={tone === id} onClick={() => pickTone(id)} className={`inline-flex h-9 items-center rounded-full px-3 text-[13px] font-medium ${tone === id ? "bg-sales-text-primary text-sales-surface" : "border border-sales-border text-sales-text-secondary"}`}>
                {id === "personal" ? "Personal" : id === "investor" ? "For investors" : "Short"}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-[13px] font-medium">Message</span>
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} className="mt-1.5 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2.5 text-[14px] leading-6" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={bigLime}>
              <MessageCircle size={16} strokeWidth={2} aria-hidden />
              Send on WhatsApp
            </a>
            <button type="button" className={bigBtn} onClick={() => void copy("msg", text)}>
              <Copy size={16} strokeWidth={2} aria-hidden />
              {copied === "msg" ? "Copied" : "Copy message"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex justify-center">
            <div className="re-fn-status" aria-label={`Status image for ${funnel.name}`} role="img">
              <img className="re-fn-status-photo" src={funnel.photo} alt="" />
              <span className="re-fn-status-shade" aria-hidden />
              <img className="re-fn-status-logo" src="/listings/charter-house/landlords-junction-logo.webp" alt="" />
              <div className="re-fn-status-copy">
                <span className="re-fn-status-tag">For sale</span>
                <p className="re-fn-status-name">{funnel.name}</p>
                <p className="re-fn-status-price">{funnel.price}</p>
                <p className="re-fn-status-meta">{funnel.summary.split(",")[0]} · {funnel.place}</p>
                <p className="re-fn-status-cta">
                  <span>{me.initials}</span>
                  Message {me.first} for the information pack
                </p>
              </div>
            </div>
          </div>
          <p className="text-center text-[12px] text-sales-text-muted">In your agency's brand. Post it to your Status, then paste your Status link as the caption.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={bigLime} onClick={() => setDone("Image saved to your phone.")}>
              <Download size={16} strokeWidth={2} aria-hidden />
              Save image
            </button>
            <button type="button" className={bigBtn} onClick={() => void copy("wa", linkFor(funnel, me.handle, "wa"))}>
              <Copy size={16} strokeWidth={2} aria-hidden />
              {copied === "wa" ? "Copied" : "Copy Status link"}
            </button>
          </div>
        </div>
      )}
      {done ? <p className="mt-3 text-[13px] text-sales-text-secondary" role="status">{done}</p> : null}
    </Sheet>
  );
}

function LeadSheet({ lead, funnel, onClose, onOpenInquiries }: { lead: Lead; funnel: Funnel; onClose: () => void; onOpenInquiries: () => void }) {
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [note, setNote] = useState<string | null>(null);
  const first = lead.name.split(" ")[0];
  const reply = `Hi ${first}, thank you for your interest in ${funnel.name}. I'll send the information pack now.`;
  return (
    <Sheet title={lead.name} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={status} />
        <span className="text-[13px] text-sales-text-muted">{lead.buyer} · enquired {lead.when}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(reply)}`} target="_blank" rel="noopener noreferrer" className={bigLime}>
          <MessageCircle size={16} strokeWidth={2} aria-hidden />
          Reply on WhatsApp
        </a>
        <button type="button" className={bigBtn} onClick={() => setNote(`Calling ${first}.`)}>
          <Phone size={16} strokeWidth={2} aria-hidden />
          Call
        </button>
        <button type="button" className={bigBtn} onClick={() => { setStatus("Viewing booked"); setNote("Viewing booked. It is on your calendar."); }}>
          <CalendarPlus size={16} strokeWidth={2} aria-hidden />
          Book viewing
        </button>
        <button type="button" className={bigBtn} onClick={() => { setStatus("Contacted"); setNote("Marked as contacted."); }}>
          <Check size={16} strokeWidth={2} aria-hidden />
          Contacted
        </button>
      </div>
      {note ? <p className="mt-2 text-[13px] text-sales-text-secondary" role="status">{note}</p> : null}

      <dl className="mt-5 divide-y divide-sales-border-subtle rounded-[10px] border border-sales-border-subtle">
        {[
          ["Property", `${funnel.name} · ${funnel.price}`],
          ["Came from", `Your ${lead.channel} link`],
          ["Wants", lead.wants],
          ["Phone", "+263 77 *** ****"],
        ].map(([label, value]) => (
          <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-[13px]">
            <dt className="text-sales-text-muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-5 text-[14px] font-semibold">Their message</h3>
      <blockquote className="mt-2 border-l-2 border-sales-brand pl-3 text-[14px] leading-6 text-sales-text-secondary">{lead.message}</blockquote>

      <h3 className="mt-5 text-[14px] font-semibold">What they did on the page</h3>
      <ol className="mt-2 space-y-2">
        {lead.steps.map(([time, step]) => (
          <li key={time} className="grid grid-cols-[48px_minmax(0,1fr)] gap-2 text-[13px]">
            <time className="font-mono text-sales-text-muted">{time}</time>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <button type="button" className={`${bigBtn} mt-6 w-full`} onClick={onOpenInquiries}>Open in Inquiries</button>
      <p className="mt-2 text-[12px] text-sales-text-muted">The lead is also in Follow-up, so your manager sees it too.</p>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* One-time setup                                                       */
/* ------------------------------------------------------------------ */

export function FunnelSetupMock({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const me = useFunnelProfile();
  const [handle, setHandle] = useState(me.handle);
  const [whatsapp, setWhatsapp] = useState(me.whatsapp);
  const [line, setLine] = useState(me.line);
  const [photo, setPhoto] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const handleState = handle.length < 2 ? "short" : TAKEN.includes(handle) ? "taken" : "ok";

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (handleState === "short") next.handle = "Use at least 2 letters.";
    if (handleState === "taken") next.handle = "Another agent at your agency has this name.";
    if (whatsapp.replace(/\D/g, "").length < 9) next.whatsapp = "Enter the full number, with the country code.";
    if (!line.trim()) next.line = "Write one line buyers will read next to your photo.";
    setErrors(next);
    if (Object.keys(next).length) return;
    saveProfile({ ...me, ready: true, handle, whatsapp, line: line.trim() });
    onDone();
  }

  return (
    <div className="re-fn mx-auto max-w-[920px] space-y-6">
      <button type="button" onClick={onBack} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Funnels
      </button>
      <header>
        <p className="text-[13px] font-medium text-sales-text-muted">One-time setup</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Your funnel link</h1>
        <p className="mt-2 max-w-[60ch] text-[14px] text-sales-text-secondary">Every funnel {AGENCY} publishes will carry these details when you share it. You can change them later.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} noValidate className="space-y-5 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-5">
          <div>
            <label htmlFor="fn-handle" className="text-[13px] font-medium">Link name</label>
            <div className="mt-1.5 flex h-11 items-center overflow-hidden rounded-[10px] border border-sales-border bg-sales-bg">
              <span className="shrink-0 pl-3 font-mono text-[12px] text-sales-text-muted">{DOMAIN}/…/</span>
              <input
                id="fn-handle"
                value={handle}
                onChange={(event) => { setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24)); setErrors((prev) => ({ ...prev, handle: "" })); }}
                aria-describedby="fn-handle-hint"
                aria-invalid={Boolean(errors.handle) || undefined}
                className="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-[13px] font-semibold outline-none"
              />
            </div>
            <p id="fn-handle-hint" className={`mt-1.5 text-[12px] font-medium ${handleState === "ok" ? "text-sales-success-fg" : "text-sales-danger-fg"}`} aria-live="polite">
              {errors.handle || (handleState === "ok" ? "Available" : handleState === "taken" ? "Another agent at your agency has this name." : "Use at least 2 letters.")}
            </p>
          </div>

          <div>
            <p className="text-[13px] font-medium">Photo</p>
            <div className="mt-1.5 flex items-center gap-3">
              <Avatar initials={me.initials} you size="lg" />
              <button type="button" className={btn} onClick={() => setPhoto(true)}>
                <Camera size={14} strokeWidth={2} aria-hidden />
                {photo ? "Photo chosen" : "Upload a photo"}
              </button>
            </div>
            <p className="mt-1.5 text-[12px] text-sales-text-muted">A clear, friendly headshot. Buyers trust a face.</p>
          </div>

          <div>
            <label htmlFor="fn-wa" className="text-[13px] font-medium">WhatsApp number</label>
            <input id="fn-wa" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} inputMode="tel" aria-invalid={Boolean(errors.whatsapp) || undefined} className="mt-1.5 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px]" />
            <p className={`mt-1.5 text-[12px] ${errors.whatsapp ? "font-medium text-sales-danger-fg" : "text-sales-text-muted"}`}>{errors.whatsapp || "Buyers who tap WhatsApp on your pages message this number."}</p>
          </div>

          <div>
            <label htmlFor="fn-line" className="text-[13px] font-medium">Your line</label>
            <textarea id="fn-line" value={line} onChange={(event) => setLine(event.target.value.slice(0, 120))} rows={3} aria-invalid={Boolean(errors.line) || undefined} className="mt-1.5 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2.5 text-[14px] leading-6" />
            <p className={`mt-1.5 flex justify-between gap-3 text-[12px] ${errors.line ? "font-medium text-sales-danger-fg" : "text-sales-text-muted"}`}>
              <span>{errors.line || "Shown next to your photo on every funnel."}</span>
              <span className="tabular-nums">{line.length}/120</span>
            </p>
          </div>

          <button type="submit" className={`${bigLime} w-full`}>Save and get my links</button>
        </form>

        <aside className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4 lg:sticky lg:top-4" aria-labelledby="fn-preview">
          <h2 id="fn-preview" className="text-[13px] font-medium text-sales-text-muted">How buyers see you</h2>
          <div className="mt-3 rounded-[10px] bg-[#042462] p-4 text-white">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f78800] text-[15px] font-semibold text-[#042462]">{me.initials}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{me.name}</p>
                <p className="text-[12px] opacity-80">{me.role}, {AGENCY}</p>
              </div>
            </div>
            <p className="mt-3 text-[14px] leading-6">{line || "Your line appears here."}</p>
            <p className="mt-3 inline-flex h-9 items-center rounded-[8px] bg-[#f78800] px-3 text-[13px] font-semibold text-[#042462]">WhatsApp {me.first}</p>
          </div>
          <p className="mt-3 break-all font-mono text-[12px] text-sales-text-muted">{DOMAIN}/charter-house/{handle || "your-name"}</p>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buyer view                                                           */
/* ------------------------------------------------------------------ */

export function FunnelPageMock({ funnelId, onBack }: { funnelId: string; onBack: () => void }) {
  const me = useFunnelProfile();
  const funnel = funnelById(funnelId);
  const params = new URLSearchParams({ agent: me.handle, name: me.name, initials: me.initials, role: me.role, wa: me.whatsapp.replace(/\D/g, ""), phone: me.whatsapp, line: me.line });
  return (
    <div className="re-fn-page">
      <div className="re-fn-page-bar">
        <button type="button" onClick={onBack} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
          <ArrowLeft size={14} strokeWidth={2} aria-hidden />
          Back
        </button>
        <p className="min-w-0 truncate text-[13px] text-sales-text-secondary">
          What a buyer sees from <span className="font-semibold text-sales-text-primary">{me.first}&apos;s</span> link
        </p>
        <span className="re-fn-page-url hidden truncate font-mono text-[12px] text-sales-text-muted md:block">{linkFor(funnel, me.handle)}</span>
      </div>
      <iframe title={`${funnel.name}, buyer view`} src={`/listings/charter-house/index.html?${params.toString()}`} />
    </div>
  );
}
