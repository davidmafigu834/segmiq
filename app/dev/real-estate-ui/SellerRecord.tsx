"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Phone } from "lucide-react";

const REQUIRED = [
  "Date of birth",
  "A copy of the identity document",
  "Proof of the residential address",
];

export function SellerRecord({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4" aria-hidden>
        <div className="space-y-2">
          <span className="re-bone block h-3 w-16 rounded-[4px]" />
          <span className="re-bone block h-8 w-56 rounded-[6px]" />
          <span className="re-bone block h-3 w-72 rounded-[4px]" />
        </div>
        <div className="re-bone h-36 rounded-[12px]" />
        <div className="re-bone h-28 rounded-[12px]" />
      </div>
    );
  }

  return (
    <div className="re-in space-y-5">
      <header className="re-head flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">Sellers</p>
          <h1 className="mt-1 break-words font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">David Mafigu</h1>
          <p className="mt-2 text-[14px] text-sales-text-secondary">2 Baines Avenue, Avondale, Harare</p>
          <p className="mt-1 text-[13px] text-sales-text-muted">Individual · +263 77 412 8806</p>
        </div>
        <div className="re-actions flex gap-2">
          <button type="button" className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
            <Phone size={16} strokeWidth={1.75} aria-hidden />
            Call
          </button>
          <button type="button" className="inline-flex h-11 items-center rounded-[10px] border border-sales-border bg-sales-surface px-3 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
            WhatsApp
          </button>
        </div>
      </header>

      <DiligenceScan />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Record title="Property" meta="In preparation">
          <p className="px-4 pb-3 text-[13px] text-sales-text-secondary">Inspection, photos, and the remaining details are still to add.</p>
          <Facts
            rows={[
              ["Address", "2 Baines Avenue, Avondale, Harare"],
              ["Type", "House"],
              ["Ownership", "Full Title"],
              ["Occupied by", "Owner occupied"],
              ["Asking price", "US$185,000"],
            ]}
          />
        </Record>
        <div className="space-y-4">
          <Record title="Mandate" meta="Accepted">
            <div className="re-split flex items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">Open mandate</p>
                <p className="mt-0.5 text-[13px] text-sales-text-secondary">11 Jul 2026 – 5 Jul 2027 · US$185,000</p>
              </div>
              <button type="button" className="h-11 shrink-0 rounded-[8px] border border-sales-border bg-sales-bg px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover min-[480px]:h-9">Open the form</button>
            </div>
          </Record>
          <Record title="Offers" meta="1">
            <div className="re-split flex items-center justify-between gap-3 border-t border-sales-border-subtle px-4 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold">Tawonga Creig</p>
                <p className="mt-0.5 text-[13px] text-sales-text-secondary">US$185,000 · The letter has not been sent</p>
              </div>
              <button type="button" className="h-11 shrink-0 rounded-[8px] bg-sales-text-primary px-3 text-[13px] font-semibold text-sales-surface transition-opacity hover:opacity-90 min-[480px]:h-9">Send letter</button>
            </div>
          </Record>
        </div>
      </div>
    </div>
  );
}

const FORM_FIELDS: Array<{ label: string; hint: string; kind: "date" | "file" }> = [
  { label: "Date of birth", hint: "The date on the identity document", kind: "date" },
  { label: "Identity document", hint: "National ID or passport", kind: "file" },
  { label: "Proof of the residential address", hint: "A utility bill or bank statement", kind: "file" },
];

function DiligenceScan() {
  const [phase, setPhase] = useState<"scanning" | "required">("scanning");
  const [prepared, setPrepared] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
      setPhase("required");
      return;
    }
    const timer = window.setTimeout(() => setPhase("required"), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  const scanning = phase === "scanning";

  return (
    <section className="dd overflow-hidden rounded-[16px] bg-sales-text-primary text-sales-surface" aria-live="polite">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-sales-brand">Due diligence</p>
          <h2 className="mt-1 font-display text-[22px] font-semibold tracking-[-0.03em]">
            {scanning ? "Scanning" : "Still required"}
          </h2>
        </div>
        {scanning ? (
          <p className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em]">
            <span className="dd-live h-1.5 w-1.5 rounded-full bg-sales-brand" aria-hidden />
            Reading the form
          </p>
        ) : (
          <p className="dd-dim text-[13px]">3 checks</p>
        )}
      </div>
      {scanning ? (
        <div className="dd-plate dd-line mx-4 mb-4 h-40 rounded-[12px] border" aria-hidden>
          <span className="dd-corner left-2 top-2 border-l-2 border-t-2" />
          <span className="dd-corner right-2 top-2 border-r-2 border-t-2" />
          <span className="dd-corner bottom-2 left-2 border-b-2 border-l-2" />
          <span className="dd-corner bottom-2 right-2 border-b-2 border-r-2" />
          <div className="dd-beam" />
          <div className="space-y-3 px-4 py-4">
            <span className="dd-bar block w-4/5" />
            <span className="dd-bar block w-3/5" />
            <span className="dd-bar block w-2/3" />
            <span className="dd-bar block w-1/2" />
          </div>
        </div>
      ) : (
        <div className="dd-in">
          <p className="dd-dim px-4 pb-3 text-[13px]">The form has been read. These were not collected.</p>
          <ul>
            {REQUIRED.map((item) => (
              <li key={item} className="dd-line flex items-start justify-between gap-3 border-t px-4 py-3">
                <span className="min-w-0 flex-1 text-[14px] font-semibold">{item}</span>
                <span className="text-[13px] font-medium text-sales-danger">Not collected</span>
              </li>
            ))}
          </ul>
          <div className="dd-line border-t px-4 py-4">
            {prepared ? (
              <p className="text-[13px] font-medium text-sales-brand">Form prepared</p>
            ) : (
              <button type="button" onClick={() => setPrepared(true)} className="re-fill inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text">
                Prepare a form
              </button>
            )}
          </div>
          {prepared ? <MissingForm copied={copied} onCopy={() => setCopied(true)} /> : null}
        </div>
      )}
    </section>
  );
}

function MissingForm({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/f/david-mafigu`);
    } catch {
      /* The preview still confirms the link is ready. */
    }
    onCopy();
  }

  return (
    <div className="dd-in mx-4 mb-4 rounded-[12px] bg-sales-surface p-4 text-sales-text-primary">
      <h3 className="text-[15px] font-semibold tracking-[-0.01em]">Form for David Mafigu</h3>
      <p className="mt-1 text-[13px] text-sales-text-secondary">It asks only for what is still missing. Send the link and the seller completes it.</p>
      <div className="mt-4 space-y-3">
        {FORM_FIELDS.map((field) => (
          <label key={field.label} className="block">
            <span className="text-[13px] font-medium">{field.label}</span>
            <span className="mt-0.5 block text-[12px] text-sales-text-muted">{field.hint}</span>
            {field.kind === "date" ? (
              <input type="date" className="mt-1.5 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px]" />
            ) : (
              <input type="file" className="mt-1.5 block w-full text-[13px] text-sales-text-secondary file:mr-3 file:h-9 file:rounded-[8px] file:border-0 file:bg-sales-surface-hover file:px-3 file:text-[13px] file:font-semibold file:text-sales-text-primary" />
            )}
          </label>
        ))}
      </div>
      <button type="button" onClick={() => void copyLink()} className="re-fill mt-4 inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border px-4 text-[14px] font-semibold transition-colors hover:bg-sales-surface-hover">
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}

function Record({ title, meta, children }: { title: string; meta: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        <span className="text-[13px] text-sales-text-muted">{meta}</span>
      </div>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 border-t border-sales-border-subtle px-4 py-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[12px] text-sales-text-muted">{label}</dt>
          <dd className="text-[14px] font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
