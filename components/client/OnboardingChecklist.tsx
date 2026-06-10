"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

type OnboardingClient = {
  id: string;
  name: string;
  profilePublished: boolean;
  formFieldCount: number;
  salespeopleCount: number;
  hasManager: boolean;
  fbConnected: boolean;
  isSolo?: boolean;
};

export function OnboardingChecklist({ client }: { client: OnboardingClient }) {
  const storageKey = `leadstaq:onboarding-dismissed:${client.id}`;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (window.localStorage.getItem(storageKey) === "1") setDismissed(true);
  }, [storageKey]);

  const items = useMemo(
    () =>
      client.isSolo
        ? ([
            {
              key: "profile",
              label: "Set up profile page",
              done: client.profilePublished,
              href: `profile`,
              optional: false,
            },
            {
              key: "form",
              label: "Configure lead form",
              done: client.formFieldCount > 0,
              href: `form`,
              optional: false,
            },
            {
              key: "owner",
              label: "Owner account",
              done: client.salespeopleCount > 0,
              href: `team`,
              optional: false,
            },
            {
              key: "facebook",
              label: "Connect Facebook (optional)",
              done: client.fbConnected,
              href: `facebook`,
              optional: true,
            },
          ] as const)
        : ([
            {
              key: "profile",
              label: "Set up profile page",
              done: client.profilePublished,
              href: `profile`,
              optional: false,
            },
            {
              key: "form",
              label: "Configure lead form",
              done: client.formFieldCount > 0,
              href: `form`,
              optional: false,
            },
            {
              key: "team",
              label: "Add salespeople",
              done: client.salespeopleCount > 0,
              href: `team`,
              optional: false,
            },
            {
              key: "manager",
              label: "Add manager (optional)",
              done: client.hasManager,
              href: `team`,
              optional: true,
            },
            {
              key: "facebook",
              label: "Connect Facebook (optional)",
              done: client.fbConnected,
              href: `facebook`,
              optional: true,
            },
          ] as const),
    [client]
  );

  const required = items.filter((i) => !i.optional);
  const completedRequired = required.filter((i) => i.done).length;
  const allRequiredDone = completedRequired === required.length;

  const dismiss = useCallback(() => {
    window.localStorage.setItem(storageKey, "1");
    setDismissed(true);
  }, [storageKey]);

  if (dismissed || allRequiredDone) return null;

  return (
    <div className="mb-8 rounded-lg border border-accent bg-accent/[0.08] p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
            Setup · {completedRequired} of {required.length} complete
          </div>
          <h3 className="font-display text-xl tracking-display text-ink-primary">Finish setting up {client.name}</h3>
        </div>
        <button type="button" className="text-xs text-ink-tertiary hover:text-ink-primary" onClick={dismiss}>
          Dismiss
        </button>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={`/dashboard/clients/${client.id}/${item.href}`}
              className="group flex items-center gap-3 py-1.5"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  item.done ? "bg-accent text-[var(--surface-canvas)]" : "border border-[var(--border-strong)]"
                }`}
              >
                {item.done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
              </span>
              <span
                className={`text-sm ${item.done ? "text-ink-tertiary line-through" : "text-ink-primary group-hover:text-ink-secondary"}`}
              >
                {item.label}
              </span>
              {item.optional && !item.done ? <span className="text-xs text-ink-tertiary">Optional</span> : null}
              <span className="flex-1" />
              {!item.done ? (
                <span className="text-xs text-ink-secondary group-hover:text-ink-primary">→</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
