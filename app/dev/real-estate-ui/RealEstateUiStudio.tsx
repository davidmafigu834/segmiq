"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  Calendar,
  FileText,
  Handshake,
  Phone,
  Plus,
} from "lucide-react";
import { SellerRecord } from "./SellerRecord";
import { PropertyRecord } from "./PropertyRecord";
import { OfferRecord, type OfferId } from "./OfferRecord";
import { CalendarRecord } from "./CalendarRecord";
import { ActivitiesPage, BuyersPage, InboxPage, InquiriesPage, InspectionsPage, MandatesPage, PeoplePage, SalesPage, SellersPage, ViewingsPage } from "./WorkPages";
import "./mock.css";

type Screen = "today" | "properties" | "calendar" | "people" | "sales" | "mandates" | "sellers" | "inspections" | "buyers" | "viewings" | "offers" | "inbox" | "activities" | "inquiries" | "seller" | "property" | "states";

const SCREENS: Array<{ id: Screen; label: string }> = [
  { id: "today", label: "Today" },
  { id: "properties", label: "Properties" },
  { id: "calendar", label: "Calendar" },
  { id: "people", label: "People" },
  { id: "sales", label: "Sales" },
  { id: "mandates", label: "Mandates" },
  { id: "sellers", label: "Sellers" },
  { id: "inspections", label: "Inspections" },
  { id: "buyers", label: "Buyers" },
  { id: "viewings", label: "Viewings" },
  { id: "offers", label: "Offers" },
  { id: "inbox", label: "Inbox" },
  { id: "activities", label: "Activities" },
  { id: "inquiries", label: "Inquiries" },
  { id: "seller", label: "Seller" },
  { id: "property", label: "Property" },
  { id: "states", label: "States" },
];

function asScreen(value: string | undefined): Screen {
  return SCREENS.some((item) => item.id === value) ? (value as Screen) : "today";
}

export function RealEstateUiStudio({ initialScreen }: { initialScreen?: string }) {
  const [screen, setScreen] = useState<Screen>(asScreen(initialScreen));
  const [loading, setLoading] = useState(true);
  const [offerId, setOfferId] = useState<OfferId | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(window.localStorage.getItem("re-mock-theme") === "dark");
  }, []);

  function toggleDark() {
    setDark((value) => {
      const next = !value;
      window.localStorage.setItem("re-mock-theme", next ? "dark" : "light");
      return next;
    });
  }

  function openScreen(next: Screen, id?: string) {
    setOfferId(null);
    setFocus(id ?? null);
    setScreen(next);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("screen") !== screen) {
      url.searchParams.set("screen", screen);
      window.history.replaceState(null, "", url.toString());
    }
    document.querySelector(".re-mock")?.scrollTo({ top: 0 });
    const timer = window.setTimeout(() => setLoading(false), 1400);
    return () => window.clearTimeout(timer);
  }, [screen]);

  function replay() {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1400);
  }

  return (
    <div data-theme={dark ? "dark" : "light"} className="re-mock sales-dashboard-premium h-screen overflow-y-auto bg-sales-bg text-sales-text-primary">
      <header className="sticky top-0 z-10 border-b border-sales-border-subtle bg-sales-bg">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-4 py-3 min-[480px]:px-5">
          <div className="flex flex-col gap-3 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sales-text-muted">SegmiQ · Proposal</p>
            <p className="truncate font-display text-[15px] font-semibold tracking-[-0.02em]">Real estate workspace</p>
          </div>
          <div className="re-actions flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={dark}
              onClick={toggleDark}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-sales-border bg-sales-surface px-2.5 text-[13px] font-medium text-sales-text-secondary transition-colors hover:bg-sales-surface-hover hover:text-sales-text-primary"
            >
              Dark
              <span className={`relative h-5 w-9 rounded-full ${dark ? "bg-sales-text-primary" : "bg-sales-border"}`} aria-hidden>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-sales-surface ${dark ? "left-4" : "left-0.5"}`} />
              </span>
            </button>
            <button
              type="button"
              onClick={replay}
              className="h-9 rounded-[8px] border border-sales-border px-3 text-[13px] font-medium text-sales-text-secondary transition-colors hover:bg-sales-surface-hover hover:text-sales-text-primary"
            >
              Replay loading
            </button>
          </div>
          </div>
          <nav className="re-nav flex flex-wrap items-center gap-1" aria-label="Screens">
            {SCREENS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={screen === item.id ? "page" : undefined}
                onClick={() => openScreen(item.id)}
                className={`h-9 shrink-0 rounded-[8px] px-3 text-[13px] font-medium transition-colors ${
                  screen === item.id
                    ? "bg-sales-text-primary text-sales-surface"
                    : "text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 py-6 min-[480px]:px-5 min-[480px]:py-8">
        {offerId ? <OfferRecord id={offerId} onClose={() => setOfferId(null)} /> : null}
        {!offerId && screen === "today" ? <Today loading={loading} onOpenOffer={setOfferId} /> : null}
        {!offerId && screen === "calendar" ? <CalendarRecord loading={loading} /> : null}
        {!offerId && screen === "properties" ? <Properties loading={loading} onOpenOffer={setOfferId} /> : null}
        {!offerId && screen === "offers" ? <Offers loading={loading} onOpenOffer={setOfferId} /> : null}
        {!offerId && screen === "people" ? <PeoplePage onOpen={openScreen} /> : null}
        {!offerId && screen === "sales" ? <SalesPage loading={loading} /> : null}
        {!offerId && screen === "mandates" ? <MandatesPage loading={loading} onOpenSeller={() => openScreen("sellers", "david")} /> : null}
        {!offerId && screen === "sellers" && focus === "david" ? (
          <div className="space-y-5">
            <button type="button" onClick={() => setFocus(null)} className="inline-flex h-9 items-center rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">Back</button>
            <SellerRecord loading={false} />
          </div>
        ) : null}
        {!offerId && screen === "sellers" && focus !== "david" ? <SellersPage loading={loading} focus={focus} onOpenDavid={() => setFocus("david")} /> : null}
        {!offerId && screen === "inspections" ? <InspectionsPage loading={loading} /> : null}
        {!offerId && screen === "buyers" ? <BuyersPage loading={loading} focus={focus} onOpenOffer={(id, buyerId) => { setFocus(buyerId); setOfferId(id); }} /> : null}
        {!offerId && screen === "viewings" ? <ViewingsPage loading={loading} /> : null}
        {!offerId && screen === "inbox" ? <InboxPage loading={loading} /> : null}
        {!offerId && screen === "activities" ? <ActivitiesPage loading={loading} /> : null}
        {!offerId && screen === "inquiries" ? <InquiriesPage loading={loading} onOpenBuyer={() => openScreen("buyers")} onOpenSeller={() => openScreen("sellers")} /> : null}
        {!offerId && screen === "seller" ? <SellerRecord loading={loading} /> : null}
        {!offerId && screen === "property" ? <PropertyRecord loading={loading} /> : null}
        {!offerId && screen === "states" ? <States /> : null}
      </main>
    </div>
  );
}

function Today({ loading, onOpenOffer }: { loading: boolean; onOpenOffer: (id: OfferId) => void }) {
  return (
    <div className="space-y-5">
      <div className="re-head flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">Monday 9 November</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Today</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">3 items need a next action.</p>
        </div>
        <div className="re-actions flex flex-wrap gap-2">
          <button type="button" className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
            Add buyer
          </button>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text">
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            New seller form
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.85fr)]">
        <Panel title="Needs you" count={3}>
          {loading ? <Bones rows={3} /> : (
            <ul>
              <GroupLabel>Overdue</GroupLabel>
              <WorkRow delay={0} name="Tendai Moyo" meta="Buyer · Borrowdale" detail="Viewing follow-up was due yesterday" mark="overdue" action="Call" />
              <GroupLabel>Today</GroupLabel>
              <WorkRow delay={40} name="14 Kingsmead" meta="Offer · US$180,000" detail="Seller sent a counter. The buyer signs again." mark="today" action="Open offer" onAction={() => onOpenOffer("kingsmead")} />
              <GroupLabel>Waiting</GroupLabel>
              <WorkRow delay={80} name="Chipo Ndlovu" meta="8 Stonechat · US$240,000" detail="Buyer signed the form. The PDF is ready." mark="waiting" action="Open offer" onAction={() => onOpenOffer("stonechat")} />
            </ul>
          )}
        </Panel>
        <Panel title="Schedule" count={2}>
          {loading ? <Bones rows={2} compact /> : (
            <ul>
              <TimeRow delay={60} time="09:30" name="Rudo Ncube" detail="Viewing · 4 Borrowdale Brooke" action="Open" />
              <TimeRow delay={100} time="14:00" name="Farai Dube" detail="Follow-up · Mount Pleasant search" action="Call" />
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface sm:grid-cols-4">
        <Metric label="New inquiries" value="4" />
        <Metric label="Follow-ups due" value="3" attention />
        <Metric label="Viewings" value="2" />
        <Metric label="Offers" value="5" />
      </div>

      <Panel title="My work" flush>
        {loading ? <Bones rows={3} compact /> : (
          <ul>
            <QuietRow name="Buyers and tenants" detail="6 buyers · 2 tenants" action="Open" />
            <QuietRow name="Sellers" detail="4 mandates · 1 inspection to record" action="Open" />
            <QuietRow name="Sales" detail="2 moving to completion" action="Open" />
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Properties({ loading, onOpenOffer }: { loading: boolean; onOpenOffer: (id: OfferId) => void }) {
  const rows = [
    ["14 Kingsmead", "Tendai Moyo", "On the market", "Share viewing form"],
    ["8 Stonechat Lane", "Amina Cruz", "In preparation", "Book inspection"],
    ["Flat 4B, Kensington", "Rudo Ncube", "Under offer", "Open offer"],
  ];
  return (
    <div className="space-y-5">
      <PageTitle kicker="Stock" title="Properties" detail="In preparation, on the market, and under offer." action="New seller form" />
      <div className="re-chips flex gap-2">
        {["All", "In preparation", "On the market", "Closed"].map((label, index) => (
          <span key={label} className={`inline-flex h-9 shrink-0 items-center rounded-full px-3 text-[13px] font-medium ${index === 0 ? "bg-sales-text-primary text-sales-surface" : "border border-sales-border text-sales-text-secondary"}`}>
            {label}
          </span>
        ))}
      </div>
      <Panel title="Properties" count={3} flush>
        {loading ? <Bones rows={3} /> : (
          <>
          <ul className="min-[480px]:hidden">
            {rows.map((row, index) => (
              <li key={row[0]} className="re-in border-t border-sales-border-subtle px-4 py-3" style={{ animationDelay: `${index * 40}ms` }}>
                <p className="text-[14px] font-semibold">{row[0]}</p>
                <p className="mt-0.5 text-[13px] text-sales-text-secondary">{row[1]} · {row[2]}</p>
                <button
                  type="button"
                  onClick={row[3] === "Open offer" ? () => onOpenOffer("kensington") : undefined}
                  className="mt-3 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg text-[14px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover"
                >
                  {row[3]}
                </button>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-left min-[480px]:table">
            <thead>
              <tr className="border-y border-sales-border-subtle text-[12px] text-sales-text-muted">
                <th className="px-4 py-2 font-medium">Property</th>
                <th className="px-3 py-2 font-medium">Seller</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row[0]} className="re-in border-b border-sales-border-subtle last:border-0" style={{ animationDelay: `${index * 40}ms` }}>
                  <td className="px-4 py-3 text-[14px] font-semibold">{row[0]}</td>
                  <td className="px-3 py-3 text-[13px] text-sales-text-secondary">{row[1]}</td>
                  <td className="px-3 py-3 text-[13px] text-sales-text-secondary">{row[2]}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={row[3] === "Open offer" ? () => onOpenOffer("kensington") : undefined}
                      className="h-9 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover"
                    >
                      {row[3]}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </Panel>
    </div>
  );
}

function Offers({ loading, onOpenOffer }: { loading: boolean; onOpenOffer: (id: OfferId) => void }) {
  return (
    <div className="space-y-5">
      <PageTitle kicker="Negotiation" title="Offers" detail="A form is sent to the buyer. A signed form becomes a PDF for the seller." action="Send offer form" />
      <Panel title="Needs you" count={2} flush>
        {loading ? <Bones rows={2} /> : (
          <ul>
            <WorkRow delay={0} name="Tendai Moyo" meta="14 Kingsmead · US$180,000" detail="Seller sent a counter. The buyer signs again." mark="today" action="Open offer" onAction={() => onOpenOffer("kingsmead")} />
            <WorkRow delay={40} name="Chipo Ndlovu" meta="8 Stonechat · US$240,000" detail="Buyer signed the form. The PDF is ready." mark="waiting" action="Open offer" onAction={() => onOpenOffer("stonechat")} />
          </ul>
        )}
      </Panel>
    </div>
  );
}

function States() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">States</h1>
        <p className="mt-2 max-w-[62ch] text-[14px] text-sales-text-secondary">Loading uses the shape of the row it will become. Icons sit on the action, not on every line.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Loading">
          <Bones rows={3} />
        </Panel>
        <Panel title="Empty">
          <div className="px-4 py-10 text-center">
            <p className="text-[15px] font-semibold">Nothing needs you right now</p>
            <p className="mx-auto mt-1 max-w-[36ch] text-[13px] text-sales-text-secondary">New inquiries, offers, and overdue follow-ups will appear here.</p>
          </div>
        </Panel>
        <Panel title="Could not load">
          <div className="re-split flex items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">Offers didn’t load</p>
              <p className="mt-0.5 text-[13px] text-sales-text-secondary">Check the connection and try again.</p>
            </div>
            <button type="button" className="h-11 rounded-[8px] border border-sales-border px-3 text-[13px] font-semibold min-[480px]:h-9">Try again</button>
          </div>
        </Panel>
        <Panel title="Icons">
          <ul className="grid grid-cols-3 gap-3 px-4 py-4">
            {[
              [Phone, "Call"],
              [Calendar, "Viewing"],
              [FileText, "Form"],
              [Building2, "Property"],
              [Handshake, "Offer"],
              [Plus, "Create"],
            ].map(([Icon, label]) => (
              <li key={String(label)} className="flex items-center gap-2 text-[13px] text-sales-text-secondary">
                <Icon size={16} strokeWidth={1.75} aria-hidden />
                {String(label)}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function PageTitle({ kicker, title, detail, action }: { kicker: string; title: string; detail: string; action: string }) {
  return (
    <div className="re-head flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-sales-text-muted">{kicker}</p>
        <h1 className="mt-1 break-words font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 text-[14px] text-sales-text-secondary">{detail}</p>
      </div>
      <button type="button" className="re-fill inline-flex h-11 items-center gap-2 rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text">
        <Plus size={16} strokeWidth={1.75} aria-hidden />
        {action}
      </button>
    </div>
  );
}

function Panel({ title, count, children, flush = false }: { title: string; count?: number; children: ReactNode; flush?: boolean }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {count != null ? <span className="text-[13px] tabular-nums text-sales-text-muted">{count}</span> : null}
      </div>
      <div className={flush ? "pb-1" : ""}>{children}</div>
    </section>
  );
}

function WorkRow({ name, meta, detail, mark, action, delay, onAction }: { name: string; meta: string; detail: string; mark: "overdue" | "today" | "waiting"; action: string; delay: number; onAction?: () => void }) {
  const rule = mark === "overdue" ? "bg-sales-danger" : mark === "today" ? "bg-sales-brand" : "bg-sales-border";
  return (
    <li className="re-in flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3" style={{ animationDelay: `${delay}ms` }}>
      <span className={`h-8 w-[3px] shrink-0 rounded-full ${rule}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold">{name}</p>
        <p className="truncate text-[12px] text-sales-text-muted">{meta}</p>
        <p className="mt-0.5 truncate text-[13px] text-sales-text-secondary">{detail}</p>
      </div>
      <button type="button" onClick={onAction} className="h-9 shrink-0 rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface transition-opacity hover:opacity-90">
        {action}
      </button>
    </li>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <li className="border-t border-sales-border-subtle bg-sales-bg px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-sales-text-muted">
      {children}
    </li>
  );
}

function QuietRow({ name, detail, action }: { name: string; detail: string; action: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold">{name}</p>
        <p className="truncate text-[13px] text-sales-text-secondary">{detail}</p>
      </div>
      <button type="button" className="h-9 shrink-0 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
        {action}
      </button>
    </li>
  );
}

function TimeRow({ time, name, detail, delay, action }: { time: string; name: string; detail: string; delay: number; action?: string }) {
  return (
    <li className="re-in flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3" style={{ animationDelay: `${delay}ms` }}>
      <span className="w-12 shrink-0 text-[13px] font-semibold tabular-nums text-sales-text-secondary">{time}</span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold">{name}</p>
        <p className="truncate text-[12px] text-sales-text-muted">{detail}</p>
      </div>
      {action ? (
        <button type="button" className="h-9 shrink-0 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
          {action}
        </button>
      ) : null}
    </li>
  );
}

function Metric({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return (
    <div className="border-b border-r border-sales-border-subtle px-4 py-3 last:border-r-0 sm:border-b-0">
      <p className={`font-display text-[26px] font-semibold leading-none tabular-nums tracking-[-0.03em] ${attention ? "text-sales-danger-fg" : ""}`}>{value}</p>
      <p className="mt-1 text-[12px] text-sales-text-muted">{label}</p>
    </div>
  );
}

function Bones({ rows, compact = false }: { rows: number; compact?: boolean }) {
  return (
    <ul aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
          <span className="re-bone h-8 w-[3px] rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="re-bone block h-3.5 w-36 rounded-[4px]" />
            {compact ? null : <span className="re-bone block h-3 w-52 rounded-[4px]" />}
          </div>
          <span className="re-bone h-9 w-16 rounded-[8px]" />
        </li>
      ))}
    </ul>
  );
}
