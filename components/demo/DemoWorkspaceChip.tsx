"use client";

import { useEffect, useState } from "react";

type Persona = { key: string; name: string; role: string };

type DemoStatus = {
  demo: boolean;
  name: string | null;
  guest?: boolean;
  fictional?: boolean;
  personaKey?: string | null;
  personas?: Persona[];
  intro?: { headline: string; subtext: string } | null;
};

/** Subtle staff indicator. Hidden for production organisations. */
export function DemoWorkspaceChip({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: DemoStatus | null) => {
        if (!cancelled) setStatus(body);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.demo) return null;

  async function onPersona(personaKey: string) {
    setPending(true);
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
    setPending(false);
  }

  return (
    <span className={`inline-flex max-w-full flex-col items-start gap-1 ${className}`}>
      {status.intro ? (
        <span className="max-w-md">
          <span className="block text-[12px] font-semibold text-sales-text-primary">{status.name}</span>
          <span className="block text-[12px] text-sales-text-primary">{status.intro.headline}</span>
          <span className="block text-[11px] leading-snug text-sales-text-secondary">{status.intro.subtext}</span>
        </span>
      ) : null}
      <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center rounded-full border border-sales-border bg-sales-surface px-2.5 py-1 text-[11px] font-medium tracking-wide text-sales-text-secondary"
        title={status.name ? `${status.name} is using fictional demonstration records` : "Fictional demonstration records"}
      >
        {status.fictional ? "Fictional demonstration" : "Demo Workspace"}
      </span>
      {status.guest && status.personas && status.personas.length > 0 ? (
        <label className="inline-flex items-center gap-1 text-[11px] text-sales-text-secondary">
          <span className="sr-only">Demonstration persona</span>
          <select
            className="rounded-md border border-sales-border bg-sales-surface px-2 py-1 text-[11px]"
            value={status.personaKey ?? ""}
            disabled={pending}
            onChange={(event) => void onPersona(event.target.value)}
          >
            {status.personas.map((persona) => (
              <option key={persona.key} value={persona.key}>
                {persona.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      </span>
    </span>
  );
}
