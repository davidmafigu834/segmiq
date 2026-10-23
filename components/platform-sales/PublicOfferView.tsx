"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatUsd } from "@/lib/commercial/catalogue";
import type { QuoteSnapshot } from "@/lib/platform-sales/types";
type Offer = {
  quote_id: string;
  quote_number: string;
  status: string;
  valid_until: string;
  revision: number;
  snapshot: QuoteSnapshot;
  notes?: string | null;
  pdf_available: boolean;
  prospect: {
    organisation_name: string;
    legal_name?: string | null;
    contact_name: string;
  };
};
export function PublicOfferView({ token }: { token: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [form, setForm] = useState({
    name: "",
    title: "",
    authorityConfirmed: false,
  });
  useEffect(() => {
    fetch(`/api/platform-sales/offers/${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        setOffer(b.offer);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  async function respond(action: "accept" | "decline" | "request_changes") {
    setError("");
    const r = await fetch(
      `/api/platform-sales/offers/${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          ...form,
          correlationId: crypto.randomUUID(),
        }),
      },
    );
    const b = await r.json();
    if (!r.ok) return setError(b.error ?? "Response failed");
    setDone(b.status);
  }
  if (error) return <State title="Offer unavailable" detail={error} />;
  if (!offer)
    return <State title="Loading offer" detail="Verifying the secure link…" />;
  if (done)
    return (
      <State
        title="Response recorded"
        detail={
          done === "accepted"
            ? "Your commercial acceptance was recorded. This is not yet a signed service agreement or proof of payment."
            : "Your response was recorded."
        }
      />
    );
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          SegmiQ commercial offer
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
          {offer.prospect.legal_name || offer.prospect.organisation_name}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {offer.quote_number} · Revision {offer.revision} · Valid until{" "}
          {offer.valid_until}
        </p>
      </header>
      <section className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 sm:p-7">
        <h2 className="font-semibold text-[var(--text-primary)]">
          Offer summary
        </h2>
        <div className="mt-4 divide-y divide-[var(--border)]">
          {offer.snapshot.lines.map((line) => (
            <div
              key={line.sku}
              className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-[var(--text-primary)]">
                  {line.name}
                </p>
                <p className="text-[var(--text-tertiary)]">
                  {line.quantity} × {formatUsd(line.unitPriceUsdCents)}
                </p>
              </div>
              <span>{formatUsd(line.subtotalUsdCents)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <Summary
            label="Monthly recurring"
            value={formatUsd(offer.snapshot.recurringTotalUsdCents)}
          />
          <Summary
            label="One-time services"
            value={formatUsd(offer.snapshot.oneTimeTotalUsdCents)}
          />
          <Summary label="Tax" value={formatUsd(offer.snapshot.taxUsdCents)} />
          <Summary
            label="Initial due"
            value={formatUsd(offer.snapshot.initialDueUsdCents)}
          />
        </div>
        {offer.notes ? (
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
            {offer.notes}
          </p>
        ) : null}
        {offer.pdf_available ? (
          <a
            className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent)]"
            href={`/api/platform-sales/offers/${encodeURIComponent(token)}/pdf`}
          >
            Download offer PDF
          </a>
        ) : null}
      </section>
      <section className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 sm:p-7">
        <h2 className="font-semibold text-[var(--text-primary)]">
          Respond to this offer
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          Commercial acceptance does not sign a service agreement, confirm
          payment, or activate a workspace.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs text-[var(--text-secondary)]">
              Full legal name
            </span>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs text-[var(--text-secondary)]">
              Position / capacity
            </span>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
        </div>
        <label className="mt-4 flex min-h-11 items-start gap-3 text-sm text-[var(--text-secondary)]">
          <input
            className="mt-1"
            type="checkbox"
            checked={form.authorityConfirmed}
            onChange={(e) =>
              setForm({ ...form, authorityConfirmed: e.target.checked })
            }
          />
          <span>
            I confirm that I am authorized to communicate this
            organisation&apos;s commercial acceptance. This confirmation is not
            represented as proof of legal authority.
          </span>
        </label>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            disabled={
              !form.authorityConfirmed ||
              form.name.length < 2 ||
              form.title.length < 2
            }
            onClick={() => respond("accept")}
          >
            Accept commercial offer
          </Button>
          <Button
            variant="secondary"
            onClick={() => respond("request_changes")}
          >
            Request changes
          </Button>
          <Button variant="secondary" onClick={() => respond("decline")}>
            Decline
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-[var(--error)]">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
function State({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{detail}</p>
    </main>
  );
}
