"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { formatRemaining } from "@/lib/security/support-access/policy";
import {
  SUPPORT_ACCESS_SCOPE_LABELS,
  type SupportAccessScope,
} from "@/lib/security/support-access/scopes";
import { EndSupportAccessDialog } from "./EndSupportAccessDialog";
import { RequestSupportAccessModal } from "./RequestSupportAccessModal";

export type SupportAccessPanelState = {
  granted: boolean;
  grantId: string | null;
  reference: string | null;
  scopes: SupportAccessScope[];
  expiresAt: string | null;
  remainingMs: number;
  status: string | null;
  pendingApproval: boolean;
};

/**
 * Normal state on an organisation page: client data is restricted and the
 * administrator is offered temporary, scoped access. Hiding this panel would
 * change nothing — the APIs enforce the same rule server-side.
 */
export function SupportAccessPanel({
  organisationId,
  organisationName,
  state,
}: {
  organisationId: string;
  organisationName: string;
  state: SupportAccessPanelState;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function endAccess() {
    if (!state.grantId) return;
    const res = await fetch(`/api/admin/support-access/${state.grantId}/revoke`, {
      method: "POST",
    });
    setEnding(false);
    if (!res.ok) {
      setToast("Could not end Support Access. Try again.");
      return;
    }
    setToast(
      `Support access ended — you no longer have access to ${organisationName}'s customer data.`
    );
    router.refresh();
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Support Access</h2>
          <p className="mt-1 max-w-[48ch] text-[12px] text-[var(--text-secondary)]">
            Client business data is restricted by default. Request temporary, scoped access when it is required.
          </p>
        </div>
        <Link
          href={`/dashboard/support-access?clientId=${organisationId}`}
          className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          View access log →
        </Link>
      </div>

      {state.granted ? (
        <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/[0.06] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg border border-[var(--accent)]/40 bg-surface-card">
                <ShieldCheck
                  className="h-4 w-4 text-[var(--accent)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>
              <div>
                <p className="text-[14px] font-medium text-ink-primary">
                  Support Access is active
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                  {state.scopes.map((s) => SUPPORT_ACCESS_SCOPE_LABELS[s]).join(" · ")}
                </p>
                <p className="mt-2 font-mono text-[11px] text-ink-tertiary">
                  {state.reference} · {formatRemaining(state.remainingMs)} remaining
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEnding(true)}>
              End Access
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg border border-border bg-[var(--bg-tertiary)]">
                <Lock className="h-4 w-4 text-ink-tertiary" strokeWidth={1.5} aria-hidden />
              </span>
              <div className="max-w-[54ch]">
                <p className="text-[14px] font-medium text-ink-primary">
                  Access to this organisation&rsquo;s customer data is restricted.
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                  Use temporary Support Access only when required to resolve a customer
                  support or security issue.
                  {state.pendingApproval
                    ? " A request is awaiting approval."
                    : ""}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => setModalOpen(true)} disabled={state.pendingApproval}>
              Request Support Access
            </Button>
          </div>
        </div>
      )}

      <RequestSupportAccessModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        organisationId={organisationId}
        organisationName={organisationName}
        onGranted={(grant) => {
          setToast(
            grant.status === "ACTIVE"
              ? `Support access started — access to ${organisationName} will expire automatically.`
              : "Support access requested — awaiting approval."
          );
          router.refresh();
        }}
      />

      <EndSupportAccessDialog
        open={ending}
        organisationName={organisationName}
        onCancel={() => setEnding(false)}
        onConfirm={() => void endAccess()}
      />

      {toast ? (
        <p role="status" className="mt-3 text-[12.5px] text-ink-secondary">
          {toast}
        </p>
      ) : null}
    </section>
  );
}
