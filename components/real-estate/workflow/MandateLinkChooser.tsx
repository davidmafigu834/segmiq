"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type TemplateRow = { id: string; kind: string; title: string; version: number };

const choice = "flex min-h-14 w-full items-center justify-between gap-3 rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4 text-left transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] disabled:opacity-60";
const lineBtn = "inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold text-sales-text-primary transition-colors hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]";
const limeBtn = "inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)] disabled:opacity-60";

export function MandateLinkChooser({ clientId, backHref }: { clientId: string; backHref: string }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<"sole" | "open" | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [kind, setKind] = useState<"sole" | "open" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/clients/${clientId}/seller-intake-templates`, { cache: "no-store" });
        const json = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setFailed(true);
          setTemplates([]);
          setError(json.error ?? "Seller forms could not be loaded.");
          return;
        }
        setTemplates(json.templates ?? []);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setTemplates([]);
          setError("Seller forms could not be loaded.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function templateFor(next: "sole" | "open") {
    const matches = (templates ?? []).filter((item) => item.kind === next);
    return matches.sort((a, b) => b.version - a.version)[0] ?? null;
  }

  async function create(next: "sole" | "open") {
    const template = templateFor(next);
    setKind(next);
    setLink(null);
    setCopied(false);
    setError(null);
    if (!template) {
      setError(next === "sole" ? "A manager needs to approve the sole mandate before a link can be created." : "A manager needs to approve the open mandate before a link can be created.");
      return;
    }
    setBusy(next);
    try {
      const response = await fetch(`/api/clients/${clientId}/seller-intakes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.link) {
        setError(json.error ?? "The seller link was not created.");
        return;
      }
      setLink(json.link);
    } catch {
      setError("The seller link was not created.");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError(null);
    } catch {
      setCopied(false);
      setError("Select the link and copy it.");
    }
  }

  const loading = templates === null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-sales-text-muted">Seller link</p>
          <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">Choose a mandate</h1>
          <p className="mt-2 max-w-[52ch] text-[14px] text-sales-text-secondary">The seller signs the form you choose. The commission is 5% of the selling price, plus VAT at 15.5% of that commission, on both.</p>
        </div>
        <button type="button" onClick={() => router.push(backHref)} className={lineBtn}>Back</button>
      </div>

      <div className="grid gap-3">
        <button type="button" disabled={loading || busy !== null} onClick={() => void create("sole")} className={choice}>
          <span>
            <span className="block text-[16px] font-semibold text-sales-text-primary">Sole mandate</span>
            <span className="mt-1 block max-w-[58ch] text-[13px] leading-relaxed text-sales-text-secondary">The agency is the only one that may sell for at least two months. Commission can still be due if they introduced the buyer.</span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold text-sales-text-muted">{busy === "sole" ? "Creating" : "Open"}</span>
        </button>
        <button type="button" disabled={loading || busy !== null} onClick={() => void create("open")} className={choice}>
          <span>
            <span className="block text-[16px] font-semibold text-sales-text-primary">Open mandate to sell</span>
            <span className="mt-1 block max-w-[58ch] text-[13px] leading-relaxed text-sales-text-secondary">The appointment runs from a start date to an end date. The seller completes the property file, and their identity details.</span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold text-sales-text-muted">{busy === "open" ? "Creating" : "Open"}</span>
        </button>
      </div>

      {failed ? (
        <p className="text-[13px] font-medium text-sales-danger-fg">{error}</p>
      ) : null}

      {link ? (
        <section className="rounded-[12px] border border-sales-border bg-sales-surface px-4 py-4" aria-label="Seller link">
          <h2 className="font-display text-[22px] font-semibold leading-none tracking-[-0.03em] text-sales-text-primary">{kind === "open" ? "Open mandate to sell" : "Sole mandate"}</h2>
          <p className="mt-2 max-w-[52ch] text-[14px] text-sales-text-secondary">Send this link to the seller. They fill the form. When it comes back, generate the PDF from the file.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input readOnly value={link} aria-label="Seller form link" onFocus={(event) => event.currentTarget.select()} className="h-11 min-w-0 flex-1 rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px] text-sales-text-primary" />
            <button type="button" onClick={() => void copy()} className={limeBtn}>{copied ? "Copied" : "Copy link"}</button>
          </div>
        </section>
      ) : null}

      {!failed && error ? <p className="text-[13px] font-medium text-sales-danger-fg">{error}</p> : null}
    </div>
  );
}
