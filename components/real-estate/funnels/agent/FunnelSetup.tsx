"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { bigLime, card, displayUrl, initialsOf } from "@/components/real-estate/funnels/agent/ui";

const LINE_MAX = 160;

type Props = {
  baseUrl: string;
  me: { name: string; first: string; role: string };
  agencyName: string;
  exampleSlug: string | null;
  initial: { handle: string; whatsapp: string; line: string };
  firstTime: boolean;
};

type Check = { state: "idle" | "checking" | "ok" | "bad"; message: string };

export function FunnelSetup({ baseUrl, me, agencyName, exampleSlug, initial, firstTime }: Props) {
  const router = useRouter();
  const [handle, setHandle] = useState(initial.handle);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [line, setLine] = useState(initial.line);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<Check>({ state: "idle", message: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (handle.length < 2) {
      setCheck({ state: "bad", message: "Use at least 2 letters or numbers." });
      return;
    }
    setCheck({ state: "checking", message: "Checking…" });
    const timer = window.setTimeout(() => {
      fetch(`/api/sales/funnels/profile?handle=${encodeURIComponent(handle)}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((body: { available?: boolean; reason?: string | null }) =>
          setCheck(body.available ? { state: "ok", message: "Available" } : { state: "bad", message: body.reason ?? "Not available" })
        )
        .catch(() => setCheck({ state: "idle", message: "" }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [handle]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (check.state === "bad") next.handle = check.message;
    if (whatsapp.replace(/\D/g, "").length < 9) next.whatsapp = "Enter the full number, with the country code.";
    if (!line.trim()) next.line = "Write one line buyers will read next to your name.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    const response = await fetch("/api/sales/funnels/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, whatsapp, line }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; field?: string };
    setSaving(false);
    if (!response.ok) {
      setErrors({ [body.field ?? "form"]: body.error ?? "Could not save. Try again." });
      return;
    }
    router.push("/sales/funnels");
    router.refresh();
  }

  const example = `${displayUrl(baseUrl)}/property/${exampleSlug ?? "property-name"}/`;

  return (
    <div className="mx-auto max-w-[920px] space-y-6">
      <Link href="/sales/funnels" className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-sales-border bg-sales-surface px-3 text-[13px] font-semibold transition-colors hover:bg-sales-surface-hover">
        <ArrowLeft size={14} strokeWidth={2} aria-hidden />
        Funnels
      </Link>
      <header>
        <p className="text-[13px] font-medium text-sales-text-muted">{firstTime ? "One-time setup" : "Your link details"}</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold leading-none tracking-[-0.03em]">Your funnel link</h1>
        <p className="mt-2 max-w-[60ch] text-[14px] text-sales-text-secondary">Every property {agencyName} publishes carries these details when you share it. You can change them later.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} noValidate className={`${card} space-y-5 px-4 py-5`}>
          <div>
            <label htmlFor="fn-handle" className="text-[13px] font-medium">Link name</label>
            <div className="mt-1.5 flex h-11 items-center overflow-hidden rounded-[10px] border border-sales-border bg-sales-bg">
              <span className="hidden shrink-0 pl-3 font-mono text-[12px] text-sales-text-muted sm:inline">…/property/…/</span>
              <input
                id="fn-handle"
                value={handle}
                autoComplete="off"
                onChange={(event) => {
                  setHandle(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30));
                  setErrors((prev) => ({ ...prev, handle: "" }));
                }}
                aria-describedby="fn-handle-hint"
                aria-invalid={Boolean(errors.handle) || check.state === "bad" || undefined}
                className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] font-semibold outline-none sm:pl-0"
              />
            </div>
            <p
              id="fn-handle-hint"
              className={`mt-1.5 text-[12px] font-medium ${errors.handle || check.state === "bad" ? "text-sales-danger-fg" : check.state === "ok" ? "text-sales-success-fg" : "text-sales-text-muted"}`}
              aria-live="polite"
            >
              {errors.handle || check.message || "Usually your first name."}
            </p>
          </div>

          <div>
            <label htmlFor="fn-wa" className="text-[13px] font-medium">WhatsApp number</label>
            <input id="fn-wa" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="+263 77 123 4567" aria-invalid={Boolean(errors.whatsapp) || undefined} className="mt-1.5 h-11 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 text-[14px]" />
            <p className={`mt-1.5 text-[12px] ${errors.whatsapp ? "font-medium text-sales-danger-fg" : "text-sales-text-muted"}`}>{errors.whatsapp || "Shown on your pages. Buyers who tap WhatsApp message this number."}</p>
          </div>

          <div>
            <label htmlFor="fn-line" className="text-[13px] font-medium">Your line</label>
            <textarea id="fn-line" value={line} onChange={(event) => setLine(event.target.value.slice(0, LINE_MAX))} rows={3} aria-invalid={Boolean(errors.line) || undefined} className="mt-1.5 w-full rounded-[10px] border border-sales-border bg-sales-bg px-3 py-2.5 text-[14px] leading-6" />
            <p className={`mt-1.5 flex justify-between gap-3 text-[12px] ${errors.line ? "font-medium text-sales-danger-fg" : "text-sales-text-muted"}`}>
              <span>{errors.line || "Shown next to your name on every funnel."}</span>
              <span className="tabular-nums">{line.length}/{LINE_MAX}</span>
            </p>
          </div>

          {errors.form ? <p className="text-[13px] font-medium text-sales-danger-fg" role="alert">{errors.form}</p> : null}
          <button type="submit" className={`${bigLime} w-full`} disabled={saving}>{saving ? "Saving…" : firstTime ? "Save and get my links" : "Save changes"}</button>
        </form>

        <aside className={`${card} px-4 py-4 lg:sticky lg:top-4`} aria-labelledby="fn-preview">
          <h2 id="fn-preview" className="text-[13px] font-medium text-sales-text-muted">How buyers see you</h2>
          <div className="mt-3 rounded-[10px] bg-sales-text-primary p-4 text-sales-surface">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sales-brand text-[15px] font-semibold text-sales-brand-text">{initialsOf(me.name)}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{me.name}</p>
                <p className="text-[12px] opacity-80">{me.role}, {agencyName}</p>
              </div>
            </div>
            <p className="mt-3 text-[14px] leading-6">{line || "Your line appears here."}</p>
            <p className="mt-3 inline-flex h-9 items-center rounded-[8px] bg-sales-brand px-3 text-[13px] font-semibold text-sales-brand-text">WhatsApp {me.first}</p>
          </div>
          <p className="mt-3 break-all font-mono text-[12px] text-sales-text-muted">{example}<span className="font-semibold text-sales-text-primary">{handle || "your-name"}</span></p>
          <p className="mt-2 text-[12px] text-sales-text-muted">Each funnel's own design decides exactly where these appear.</p>
        </aside>
      </div>
    </div>
  );
}
