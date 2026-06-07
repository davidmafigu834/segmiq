"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Paperclip, XCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatMoney, formatDate, methodLabel } from "@/lib/billing/format";

export type PendingPayment = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  method: string;
  methodDetail: string | null;
  reference: string | null;
  paidAt: string | null;
  proofs: { url: string; name: string }[];
};

export function PendingPaymentsClient({ rows }: { rows: PendingPayment[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function confirm(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/billing/payments/${id}/confirm`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Failed to confirm payment");
      else router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    if (!reason.trim()) {
      setError("Please enter a reason for rejecting.");
      return;
    }
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/billing/payments/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to reject payment");
        return;
      }
      setRejecting(null);
      setReason("");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <CheckCircle2 className="h-8 w-8 text-[var(--text-tertiary)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--text-secondary)]">No payments awaiting review.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-md border border-[var(--error-border)] bg-[var(--error-muted)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : null}

      {rows.map((p) => (
        <Card key={p.id}>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{p.clientName}</p>
                <Link
                  href={`/dashboard/billing/invoices/${p.invoiceId}`}
                  className="font-mono text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                >
                  {p.invoiceNumber}
                </Link>
              </div>
              <p
                className="text-2xl text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-instrument-serif)" }}
              >
                {formatMoney(p.amount, p.currency)}
              </p>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--text-tertiary)]">
              <span>
                Method: <span className="text-[var(--text-secondary)]">{methodLabel(p.method)}</span>
                {p.methodDetail ? ` · ${p.methodDetail}` : ""}
              </span>
              {p.reference ? (
                <span>
                  Ref: <span className="text-[var(--text-secondary)]">{p.reference}</span>
                </span>
              ) : null}
              {p.paidAt ? (
                <span>
                  Paid: <span className="text-[var(--text-secondary)]">{formatDate(p.paidAt)}</span>
                </span>
              ) : null}
            </div>

            {p.proofs.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {p.proofs.map((pr) => (
                  <a
                    key={pr.url}
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/[0.03]"
                  >
                    <Paperclip className="h-3.5 w-3.5" /> {pr.name}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">No proof file attached.</p>
            )}

            {rejecting === p.id ? (
              <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)]/40 p-4">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Reason for rejection (sent to the client)"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40"
                />
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => reject(p.id)} disabled={busy !== null}>
                    {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Confirm rejection
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setRejecting(null);
                      setReason("");
                    }}
                    disabled={busy !== null}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button onClick={() => confirm(p.id)} disabled={busy !== null}>
                  {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirm
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRejecting(p.id);
                    setReason("");
                    setError(null);
                  }}
                  disabled={busy !== null}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
