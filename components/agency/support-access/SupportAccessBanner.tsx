"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { formatRemaining } from "@/lib/security/support-access/policy";
import {
  SUPPORT_ACCESS_SCOPE_LABELS,
  type SupportAccessScope,
} from "@/lib/security/support-access/scopes";
import { EndSupportAccessDialog } from "./EndSupportAccessDialog";

type ActiveSession = {
  id: string;
  reference: string;
  organisationId: string;
  organisation: string | null;
  scopes: SupportAccessScope[];
  accessKind: "SUPPORT" | "BREAK_GLASS";
  expiresAt: string | null;
  remainingMs: number;
};

const POLL_MS = 20_000;

/**
 * Persistent reminder that the administrator is inside privileged client-data
 * access. The countdown is informational — the server expiry is authoritative,
 * so the banner re-checks with the server rather than trusting its own timer.
 */
export function SupportAccessBanner() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [ending, setEnding] = useState<ActiveSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadedAt = useRef<number>(Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/support-access/active", { cache: "no-store" });
      if (!res.ok) {
        setSessions([]);
        return;
      }
      const payload = (await res.json()) as { sessions?: ActiveSession[] };
      const next = payload.sessions ?? [];
      setSessions((prev) => {
        if (prev.length && !next.length) {
          setNotice("Support access expired — client data has been locked again.");
        }
        return next;
      });
      loadedAt.current = Date.now();
    } catch {
      // Keep the last known state; the server still enforces expiry.
    }
  }, []);

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function endAccess(session: ActiveSession) {
    try {
      const res = await fetch(`/api/admin/support-access/${session.id}/revoke`, {
        method: "POST",
      });
      if (!res.ok) {
        setNotice("Could not end Support Access. Try again.");
        return;
      }
      setEnding(null);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setNotice(
        `Support access ended — you no longer have access to ${session.organisation ?? "this organisation"}'s customer data.`
      );
      router.replace(`/dashboard/clients/${session.organisationId}`);
      router.refresh();
    } catch {
      setNotice("Could not end Support Access. Try again.");
    }
  }

  if (!sessions.length) {
    return notice ? <SupportAccessNotice message={notice} /> : null;
  }

  return (
    <>
      {notice ? <SupportAccessNotice message={notice} /> : null}
      <div className="sticky top-0 z-[110] border-b border-[var(--accent)]/35 bg-[var(--accent)]/[0.08] backdrop-blur-sm">
        {sessions.map((session) => {
          const elapsed = Math.max(0, now - loadedAt.current);
          const remaining = Math.max(0, session.remainingMs - elapsed);
          return (
            <div
              key={session.id}
              role="status"
              className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5"
            >
              <span className="flex items-center gap-2">
                <ShieldAlert
                  className="h-3.5 w-3.5 text-[var(--accent)]"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-primary">
                  {session.accessKind === "BREAK_GLASS"
                    ? "Break-glass access active"
                    : "Support access active"}
                </span>
              </span>
              <span className="text-[13px] font-medium text-ink-primary">
                {session.organisation ?? session.organisationId}
              </span>
              <span className="text-[12.5px] text-ink-secondary">
                {session.scopes.map((s) => SUPPORT_ACCESS_SCOPE_LABELS[s]).join(" · ")}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-ink-secondary">
                {formatRemaining(remaining)} remaining
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto"
                onClick={() => setEnding(session)}
              >
                End Access
              </Button>
            </div>
          );
        })}
      </div>

      <EndSupportAccessDialog
        open={Boolean(ending)}
        organisationName={ending?.organisation ?? "this organisation"}
        onCancel={() => setEnding(null)}
        onConfirm={() => {
          if (ending) void endAccess(ending);
        }}
      />
    </>
  );
}

function SupportAccessNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 rounded-lg border border-border bg-surface-card px-4 py-2.5 text-[13px] text-ink-primary shadow-[0_16px_40px_-20px_rgba(0,0,0,0.5)]"
    >
      {message}
    </div>
  );
}
