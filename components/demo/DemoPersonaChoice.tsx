"use client";

import { useEffect, useState } from "react";

type Persona = { key: string; name: string; role: string };

type DemoStatus = {
  demo: boolean;
  name: string | null;
  personas?: Persona[];
  intro?: { headline: string; subtext: string } | null;
};

function roleLabel(persona: Persona): string {
  return persona.role === "CLIENT_MANAGER" ? "Manager" : "Salesperson";
}

function roleDetail(persona: Persona): string {
  if (persona.role === "CLIENT_MANAGER") {
    return "See the company pipeline, team, quotations, and what is still open to close.";
  }
  return "Work your own WhatsApp conversations, leads, follow-ups, and deals.";
}

export function DemoPersonaChoice() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: DemoStatus | null) => {
        if (cancelled) return;
        if (!body?.demo || !body.personas?.length) setFailed(true);
        else setStatus(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(personaKey: string) {
    setPendingKey(personaKey);
    setError(null);
    const res = await fetch("/api/demo/persona", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ personaKey }),
    });
    const body = (await res.json().catch(() => null)) as { redirectTo?: string } | null;
    if (res.ok && body?.redirectTo) {
      window.location.assign(body.redirectTo);
      return;
    }
    setPendingKey(null);
    setError("That view could not be opened. Open the guest link again.");
  }

  if (failed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">SegmiQ demonstration</p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">Open a guest link first</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          This choice is available after a demonstration invitation. Nothing here is a live customer workspace.
        </p>
      </main>
    );
  }

  const managers = status?.personas?.filter((persona) => persona.role === "CLIENT_MANAGER") ?? [];
  const sales = status?.personas?.filter((persona) => persona.role !== "CLIENT_MANAGER") ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">SegmiQ demonstration</p>
      <h1 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">
        {status?.name ?? "Choose how you want to look around"}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
        {status?.intro?.subtext ??
          "Choose the manager view or a salesperson. These are fictional records. No message is sent."}
      </p>
      {!status ? <p className="mt-8 text-sm text-[var(--text-secondary)]">Loading views…</p> : null}
      {status ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[...managers, ...sales].map((persona) => (
            <button
              key={persona.key}
              type="button"
              disabled={pendingKey !== null}
              onClick={() => void choose(persona.key)}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-4 text-left transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-tertiary)] disabled:opacity-60"
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                {roleLabel(persona)}
              </span>
              <span className="mt-1 block text-[15px] font-semibold text-[var(--text-primary)]">{persona.name}</span>
              <span className="mt-2 block text-[13px] leading-5 text-[var(--text-secondary)]">{roleDetail(persona)}</span>
              <span className="mt-3 block text-[13px] font-medium text-[var(--text-primary)]">
                {pendingKey === persona.key ? "Opening…" : "Enter this view"}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-[var(--danger)]">{error}</p> : null}
    </main>
  );
}
