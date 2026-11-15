"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import type { Screen } from "./nav";
import { ORGS, REGISTERS, orgById } from "./desk";
import { Bones, EmptyNote, Fact, Head, Panel, QuietRow, WorkRow, backBtn, field, inkBtn, lineBtn } from "./primitives";

export function ScreenBody({
  screen,
  loading,
  focus,
  dark,
  onToggleDark,
  onOpen,
}: {
  screen: Screen;
  loading: boolean;
  focus: string | null;
  dark: boolean;
  onToggleDark: () => void;
  onOpen: (screen: Screen, id?: string) => void;
}) {
  if (screen === "signin") return <SignIn dark={dark} onToggleDark={onToggleDark} onEnter={() => onOpen("overview")} />;
  if (screen === "overview") return <Overview loading={loading} onOpen={onOpen} />;
  if (screen === "organisations") return <Organisations loading={loading} startAdding={focus === "add"} onOpen={onOpen} />;
  if (screen === "organisation") return <Organisation orgId={focus} onOpen={onOpen} />;
  if (screen === "commercial") return <Commercial loading={loading} onOpen={onOpen} />;
  if (screen === "quote") return <Quote onOpen={onOpen} />;
  if (screen === "invoice") return <Invoice onOpen={onOpen} />;
  if (screen === "support") return <Support onOpen={onOpen} />;
  if (screen === "settings") return <Settings />;
  if (screen === "states") return <States />;
  const spec = REGISTERS[screen];
  if (!spec) return null;
  return <Register key={screen} spec={spec} loading={loading} startAdding={focus === "add"} onOpen={onOpen} />;
}

function Register({
  spec,
  loading,
  onOpen,
  startAdding = false,
}: {
  spec: (typeof REGISTERS)[string];
  loading: boolean;
  onOpen: (screen: Screen, id?: string) => void;
  startAdding?: boolean;
}) {
  const [adding, setAdding] = useState(startAdding);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function add(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (next.length < 2) {
      setError("Enter a name.");
      setSaved(null);
      return;
    }
    setError(null);
    setSaved(next);
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="space-y-8">
      <Head
        kicker={spec.kicker}
        title={spec.title}
        detail={spec.detail}
        action={adding ? undefined : spec.create}
        onAction={spec.create ? () => { setAdding(true); setSaved(null); } : undefined}
      />
      {adding ? (
        <form onSubmit={add} className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <h2 className="text-[15px] font-semibold">{spec.create}</h2>
          <label className="mt-4 block">
            <span className="text-[13px] font-medium">Name</span>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} className={field} />
          </label>
          {error ? <p className="mt-2 text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" className={`${inkBtn} h-11 px-4 text-[14px]`}>Save on this desk</button>
            <button type="button" onClick={() => setAdding(false)} className={`${lineBtn} h-11 px-4 text-[14px]`}>Close</button>
          </div>
        </form>
      ) : null}
      {saved ? <p className="text-[14px] text-sales-text-secondary" role="status">{saved} is noted here. The live product writes the record.</p> : null}
      <Panel title="Register" count={loading ? undefined : spec.rows.length}>
        {loading ? (
          <Bones />
        ) : spec.rows.length === 0 ? (
          <EmptyNote title="Nothing waiting" detail="When a record needs a decision, it shows up in this register." />
        ) : (
          <ul>
            {spec.rows.map((row) => (
              <WorkRow
                key={row.name}
                name={row.name}
                meta={row.meta}
                detail={row.detail}
                mark={row.mark}
                action={row.action}
                onAction={() => onOpen(row.screen, row.orgId)}
              />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Overview({ loading, onOpen }: { loading: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <Head
        kicker="Platform"
        title="Overview"
        detail="Sunday 15 November. One agreement is still unsigned."
      />
      <Fact
        name="Charter Properties has not signed."
        detail="The service agreement was sent. The customer has not signed, so the account is not a completed commercial record."
        action="Open organisation"
        onAction={() => onOpen("organisation", "charter")}
      />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]">
        <Panel title="Needs a decision" count={loading ? undefined : 3}>
          {loading ? (
            <Bones />
          ) : (
            <ul>
              <WorkRow name="Charter Properties" meta="Agreement unsigned" detail="Signature is still outstanding." mark="today" action="Open" onAction={() => onOpen("organisation", "charter")} />
              <WorkRow name="Highlands Realty" meta="INV-2041" detail="The invoice is past the due date." mark="overdue" action="Open invoice" onAction={() => onOpen("invoice", "highlands")} />
              <WorkRow name="WhatsApp delivery" meta="Degraded" detail="Follow-up jobs are paused until delivery recovers." mark="waiting" action="Open health" onAction={() => onOpen("incidents")} />
            </ul>
          )}
        </Panel>
        <Panel title="On the platform" count={loading ? undefined : ORGS.length}>
          {loading ? (
            <Bones />
          ) : (
            <ul>
              {ORGS.map((org) => (
                <QuietRow key={org.id} name={org.name} detail={`${org.plan} · ${org.place}`} action="Open" onAction={() => onOpen("organisation", org.id)} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Organisations({ loading, startAdding, onOpen }: { loading: boolean; startAdding: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  const [adding, setAdding] = useState(startAdding);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (startAdding) setAdding(true);
  }, [startAdding]);

  function add(event: FormEvent) {
    event.preventDefault();
    const next = name.trim();
    if (next.length < 2) {
      setError("Enter the organisation name.");
      setSaved(null);
      return;
    }
    setError(null);
    setSaved(next);
    setAdding(false);
    setName("");
  }

  return (
    <div className="space-y-8">
      <Head
        kicker="Platform"
        title="Organisations"
        detail="Customer tenants. Charter Properties is the one with an unsigned agreement."
        action={adding ? undefined : "New organisation"}
        onAction={() => {
          setAdding(true);
          setSaved(null);
        }}
      />
      {adding ? (
        <form onSubmit={add} className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
          <h2 className="text-[15px] font-semibold">New organisation</h2>
          <p className="mt-1 text-[13px] text-sales-text-secondary">A name starts the record. Plan and billing come after.</p>
          <label className="mt-4 block">
            <span className="text-[13px] font-medium">Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className={field} aria-invalid={error ? true : undefined} />
          </label>
          {error ? <p className="mt-2 text-[13px] text-sales-danger-fg" role="alert">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" className={`${inkBtn} h-11 px-4 text-[14px]`}>Create record</button>
            <button type="button" onClick={() => setAdding(false)} className={`${lineBtn} h-11 px-4 text-[14px]`}>Close</button>
          </div>
        </form>
      ) : null}
      {saved ? <p className="text-[14px] text-sales-text-secondary" role="status">{saved} is noted on this desk. The live product writes the tenant.</p> : null}
      <Panel title="Tenants" count={loading ? undefined : ORGS.length}>
        {loading ? (
          <Bones />
        ) : (
          <ul>
            {ORGS.map((org) => (
              <WorkRow
                key={org.id}
                name={org.name}
                meta={`${org.industry} · ${org.plan}`}
                detail={org.next}
                mark={org.mark}
                action="Open"
                onAction={() => onOpen("organisation", org.id)}
              />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Organisation({ orgId, onOpen }: { orgId: string | null; onOpen: (screen: Screen, id?: string) => void }) {
  const org = orgById(orgId);
  return (
    <div className="space-y-8">
      <button type="button" onClick={() => onOpen("organisations")} className={backBtn}>Back</button>
      <Head kicker={org.industry} title={org.name} detail={`${org.plan} · ${org.place}. ${org.next}`} />
      <Fact name={org.status} detail={org.next} action="Open the next record" onAction={() => onOpen(nextScreen(org.id), org.id)} />
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <Panel title="Commercial">
          <ul>
            <QuietRow name="Plan" detail={org.plan} />
            <QuietRow name="Place" detail={org.place} />
            <QuietRow name="Billing" detail={org.id === "highlands" ? "Invoice overdue" : org.id === "lumina" ? "Grace until 20 Nov" : org.id === "kwekwe" ? "Legacy subscription" : "Current"} action="Open billing" onAction={() => onOpen(org.id === "highlands" ? "invoice" : "billing", org.id)} />
          </ul>
        </Panel>
        <Panel title="People">
          <ul>
            <QuietRow name="Manager on file" detail={org.id === "lumina" ? "Farai Moyo" : org.id === "highlands" ? "Tariro Ncube" : org.id === "kwekwe" ? "No manager yet" : "Nyasha Dube"} action="Open users" onAction={() => onOpen("users")} />
            <QuietRow name="Support" detail={org.id === "charter" ? "Read-only session, expires tonight" : "No open session"} action="Open support" onAction={() => onOpen("support")} />
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function nextScreen(id: string): Screen {
  if (id === "highlands") return "invoice";
  if (id === "lumina") return "grace";
  if (id === "kwekwe") return "migrations";
  return "agreements";
}

function Commercial({ loading, onOpen }: { loading: boolean; onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <Head
        kicker="Commercial"
        title="Commercial"
        detail="Subscriptions, agreements, quotations, and grace. Customer-facing sales stay fail-closed."
        action="New prospect"
        onAction={() => onOpen("prospects", "add")}
      />
      <Fact
        name="Q-184 is waiting on Lumina Solar."
        detail="The quotation was sent. The customer has not answered. Sending it again is a separate action."
        action="Open quotation"
        onAction={() => onOpen("quote")}
      />
      <Panel title="Attention" count={loading ? undefined : 4}>
        {loading ? (
          <Bones />
        ) : (
          <ul>
            <WorkRow name="Quotations awaiting a response" meta="Q-184" detail="Lumina Solar has the link." mark="today" action="Open" onAction={() => onOpen("quotes")} />
            <WorkRow name="Agreements awaiting signature" meta="Charter Properties" detail="Sent, not signed." mark="today" action="Open" onAction={() => onOpen("agreements")} />
            <WorkRow name="Legacy subscriptions" meta="Kwekwe Electrical" detail="Controlled migration has not started." action="Open" onAction={() => onOpen("migrations")} />
            <WorkRow name="Overdue invoices" meta="Highlands Realty" detail="INV-2041 is past the due date." mark="overdue" action="Open" onAction={() => onOpen("invoice", "highlands")} />
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Quote({ onOpen }: { onOpen: (screen: Screen) => void }) {
  return (
    <div className="space-y-8">
      <button type="button" onClick={() => onOpen("quotes")} className={backBtn}>Back</button>
      <Head kicker="Quotation" title="Q-184" detail="Lumina Solar. Sent. The customer has not answered." />
      <Fact name="Waiting on the customer." detail="The link is out. A reminder is the next action. This desk does not change the price." action="Note a reminder" onAction={() => onOpen("activity")} />
      <Panel title="Lines">
        <ul>
          <QuietRow name="Growth" detail="8 seats. Unit price stays on the catalogue." />
          <QuietRow name="Agentic AI, Business" detail="Allowance comes from the catalogue row." />
          <QuietRow name="Total" detail="Calculated when the live quotation is opened. Not invented here." />
        </ul>
      </Panel>
    </div>
  );
}

function Invoice({ onOpen }: { onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <button type="button" onClick={() => onOpen("billing")} className={backBtn}>Back</button>
      <Head kicker="Invoice" title="INV-2041" detail="Highlands Realty. Past the due date. No payment is recorded." />
      <Fact name="Payment has not been recorded." detail="Recording it clears the overdue mark. The amount is the subscription amount on the live invoice." action="Open organisation" onAction={() => onOpen("organisation", "highlands")} />
      <Panel title="Record">
        <ul>
          <QuietRow name="Organisation" detail="Highlands Realty" action="Open" onAction={() => onOpen("organisation", "highlands")} />
          <QuietRow name="Status" detail="Overdue" />
          <QuietRow name="Period" detail="1 Nov 2026 to 30 Nov 2026" />
        </ul>
      </Panel>
    </div>
  );
}

function Support({ onOpen }: { onOpen: (screen: Screen, id?: string) => void }) {
  return (
    <div className="space-y-8">
      <Head kicker="Security" title="Support Access" detail="Privileged sessions. Client business data stays restricted. One session is open." />
      <Fact
        name="Read-only session on Charter Properties."
        detail="Rudo Chikwanha. Reason: unsigned agreement check. Expires tonight. Ending it is the decision if the check is done."
        action="Open organisation"
        onAction={() => onOpen("organisation", "charter")}
      />
      <Panel title="Log" count={2}>
        <ul>
          <WorkRow name="Charter Properties" meta="Active · read only" detail="Expires tonight. Ticket SA-19." mark="today" action="Open" onAction={() => onOpen("organisation", "charter")} />
          <WorkRow name="Lumina Solar" meta="Ended yesterday" detail="Grace window was confirmed with the customer." action="Open grace" onAction={() => onOpen("grace")} />
        </ul>
      </Panel>
    </div>
  );
}

function Settings() {
  const [email, setEmail] = useState("rudo@segmiq.test");
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function save(event: FormEvent) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setState("error");
      setMessage("Use the full work email, including the @.");
      return;
    }
    setState("loading");
    setMessage(null);
    window.setTimeout(() => {
      setState("success");
      setMessage("Saved on this desk.");
    }, 400);
  }

  const label = state === "loading" ? "Saving" : state === "success" ? "Saved" : state === "error" ? "Try again" : "Save account";

  return (
    <div className="space-y-8">
      <Head kicker="Configuration" title="Platform Settings" detail="Your account. Multi-factor sign-in stays required for Super Admin." />
      <form onSubmit={save} className="max-w-[440px] rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4">
        <label className="block">
          <span className="text-[13px] font-medium">Work email</span>
          <input value={email} onChange={(event) => { setEmail(event.target.value); setState("idle"); }} className={field} autoComplete="username" />
        </label>
        <p className="mt-3 text-[13px] text-sales-text-secondary">Authenticator is enrolled. Recovery codes stay in the live account settings.</p>
        {message ? (
          <p className={`mt-3 text-[13px] ${state === "error" ? "text-sales-danger-fg" : "text-sales-text-secondary"}`} role={state === "error" ? "alert" : "status"}>
            {message}
          </p>
        ) : null}
        <button type="submit" className={`${inkBtn} mt-4 h-11 px-4 text-[14px]`} data-state={state === "idle" ? undefined : state} disabled={state === "loading"}>
          {label}
        </button>
      </form>
    </div>
  );
}

function States() {
  return (
    <div className="space-y-8">
      <Head kicker="Studio" title="Screen states" detail="Empty, error, and the button states used on this desk." />
      <Panel title="Empty">
        <EmptyNote title="No active grace periods" detail="No customer currently has a live commercial grace exception." />
      </Panel>
      <Panel title="Error">
        <div className="px-4 py-6" role="alert">
          <p className="text-[15px] font-semibold">The grace-period register is not available.</p>
          <p className="mt-1 max-w-[52ch] text-[14px] text-sales-text-secondary">No active state has been inferred.</p>
        </div>
      </Panel>
      <Panel title="Button">
        <ul>
          <li className="flex flex-wrap items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
            <span className="w-24 text-[13px] text-sales-text-muted">Default</span>
            <button type="button" className={`${inkBtn} h-11 px-4`}>Save account</button>
          </li>
          <li className="flex flex-wrap items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
            <span className="w-24 text-[13px] text-sales-text-muted">Disabled</span>
            <button type="button" className={`${inkBtn} h-11 px-4`} disabled>Save account</button>
          </li>
          <li className="flex flex-wrap items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
            <span className="w-24 text-[13px] text-sales-text-muted">Loading</span>
            <button type="button" className={`${inkBtn} h-11 px-4`} data-state="loading">Saving</button>
          </li>
          <li className="flex flex-wrap items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
            <span className="w-24 text-[13px] text-sales-text-muted">Error</span>
            <button type="button" className={`${inkBtn} h-11 px-4`} data-state="error">Try again</button>
          </li>
          <li className="flex flex-wrap items-center gap-3 border-t border-sales-border-subtle px-4 py-3">
            <span className="w-24 text-[13px] text-sales-text-muted">Success</span>
            <button type="button" className={`${inkBtn} h-11 px-4`} data-state="success">Saved</button>
          </li>
        </ul>
      </Panel>
    </div>
  );
}

function SignIn({ dark, onToggleDark, onEnter }: { dark: boolean; onToggleDark: () => void; onEnter: () => void }) {
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "checking" | "opening">("idle");
  const busy = phase !== "idle";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const nextEmail = !email.trim() ? "Enter the work email." : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Use the full work email, including the @." : null;
    const nextSecret = !secret ? "Enter the password." : secret.length < 8 ? "That password is shorter than the one on file." : null;
    setEmailError(nextEmail);
    setSecretError(nextSecret);
    if (nextEmail || nextSecret) return;
    setPhase("checking");
    window.setTimeout(() => {
      setPhase("opening");
      window.setTimeout(onEnter, 500);
    }, 400);
  }

  const action = phase === "checking" ? "Checking" : phase === "opening" ? "Opening the desk" : "Sign in";

  return (
    <div className="re-sign">
      <header className="re-sign-bar">
        <img src={dark ? "/segmiq-wordmark.png" : "/segmiq-wordmark-black.png"} alt="SegmiQ" className="re-sign-mark" />
        <span className="re-sign-desk">Platform</span>
        <span className="re-sign-gap" />
        <span className="re-sb-theme" role="group" aria-label="Theme">
          <button type="button" aria-label="Light theme" aria-pressed={!dark} onClick={() => dark && onToggleDark()}>
            <Sun size={15} strokeWidth={1.8} aria-hidden />
          </button>
          <button type="button" aria-label="Dark theme" aria-pressed={dark} onClick={() => !dark && onToggleDark()}>
            <Moon size={15} strokeWidth={1.8} aria-hidden />
          </button>
        </span>
      </header>
      <div className="re-sign-body">
        <div className="re-sign-grid">
          <div>
            <p className="re-sign-date">Sunday 15 November</p>
            <h1 className="re-sign-title">Sign in</h1>
            <p className="re-sign-lede">Charter Properties still needs a signature. The desk stays closed until you are in.</p>
            <form className="re-sign-form" onSubmit={submit} noValidate>
              <label className="re-sign-label" htmlFor="sa-email">Work email</label>
              <input id="sa-email" className={emailError ? "re-sign-field is-error" : "re-sign-field"} value={email} disabled={busy} autoComplete="username" placeholder="rudo@segmiq.test" onChange={(event) => { setEmail(event.target.value); setEmailError(null); }} aria-invalid={emailError ? true : undefined} />
              {emailError ? <p className="re-sign-error" role="alert">{emailError}</p> : null}
              <div className="re-sign-label-row">
                <label className="re-sign-label" htmlFor="sa-secret">Password</label>
              </div>
              <div className="re-sign-secret">
                <input id="sa-secret" className={secretError ? "re-sign-field is-error" : "re-sign-field"} type={show ? "text" : "password"} value={secret} disabled={busy} autoComplete="current-password" onChange={(event) => { setSecret(event.target.value); setSecretError(null); }} aria-invalid={secretError ? true : undefined} />
                <button type="button" className="re-sign-reveal" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((value) => !value)}>
                  {show ? <EyeOff size={16} strokeWidth={1.8} aria-hidden /> : <Eye size={16} strokeWidth={1.8} aria-hidden />}
                </button>
              </div>
              {secretError ? <p className="re-sign-error" role="alert">{secretError}</p> : null}
              <button type="submit" className="re-sign-submit" disabled={busy} data-state={phase === "checking" ? "loading" : undefined}>{action}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
