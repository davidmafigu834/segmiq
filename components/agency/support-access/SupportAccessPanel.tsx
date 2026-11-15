"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    <section className="space-y-3">

      {state.granted ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-4">
          <div className="min-w-0">
            <p className="text-[12px] text-[var(--text-tertiary)]">Support access</p>
            <p className="mt-1 text-[16px] font-semibold text-[var(--text-primary)]">A session is open.</p>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
              {state.scopes.map((s) => SUPPORT_ACCESS_SCOPE_LABELS[s]).join(" · ")}
              {state.reference ? ` · ${state.reference}` : ""} · {formatRemaining(state.remainingMs)} remaining
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setEnding(true)}>
            End access
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[6px] border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-4">
          <div className="min-w-0 max-w-[54ch]">
            <p className="text-[12px] text-[var(--text-tertiary)]">Support access</p>
            <p className="mt-1 text-[16px] font-semibold text-[var(--text-primary)]">
              {state.pendingApproval ? "A request is waiting for approval." : "Customer data is closed."}
            </p>
            <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
              Open a session only to resolve a support or security issue.
            </p>
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)} disabled={state.pendingApproval}>
            Request access
          </Button>
        </div>
      )}

      <Link
        href={`/dashboard/support-access?clientId=${organisationId}`}
        className="inline-flex h-9 items-center text-[13px] font-semibold text-[var(--text-primary)] underline decoration-[var(--border)] underline-offset-4"
      >
        Open the access log
      </Link>

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
