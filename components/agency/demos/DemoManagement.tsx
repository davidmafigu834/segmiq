"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { Button, EmptyState, Input } from "@/components/ui";
import { PlatformStatusBadge } from "@/components/platform/PlatformStatusBadge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { DEMO_INVITATION_DEFAULT_MS, DEMO_INVITATION_MAX_MS } from "@/lib/demo/deployment";
import type { DemoAdminDirectory, DemoInvitationStatus } from "@/lib/demo/admin-directory";

const DAY_MS = 24 * 60 * 60 * 1000;
const LIFETIMES = [
  { value: DAY_MS, label: "24 hours" },
  { value: DEMO_INVITATION_DEFAULT_MS, label: "7 days" },
  { value: DEMO_INVITATION_MAX_MS, label: "30 days" },
];

const fieldClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40";

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: DemoInvitationStatus): string {
  if (status === "active") return "Active";
  if (status === "expired") return "Expired";
  return "Revoked";
}

export function DemoManagement({ directory }: { directory: DemoAdminDirectory }) {
  const router = useRouter();
  const ready = directory.workspaces.filter((workspace) => workspace.templateReady);
  const [clientId, setClientId] = useState(ready[0]?.id ?? "");
  const [lifetimeMs, setLifetimeMs] = useState(String(DEMO_INVITATION_DEFAULT_MS));
  const [pending, setPending] = useState<"create" | "revoke" | null>(null);
  const [error, setError] = useState<string | null>(directory.error);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const metrics = useMemo(
    () => ({
      workspaces: ready.length,
      active: directory.invitations.filter((row) => row.status === "active").length,
      sessions: directory.invitations.reduce((sum, row) => sum + row.openSessions, 0),
      revoked: directory.invitations.filter((row) => row.status === "revoked").length,
    }),
    [directory.invitations, ready.length]
  );

  async function createLink(event: FormEvent) {
    event.preventDefault();
    if (!clientId || !directory.accessOpen) return;
    setPending("create");
    setError(null);
    setCopied(false);
    try {
      const response = await fetch("/api/agency/demos/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, lifetimeMs: Number(lifetimeMs) }),
      });
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !body?.url) {
        setError(
          response.status === 409
            ? "Sign out of a demonstration session before creating a link."
            : response.status === 404
              ? "This workspace cannot receive a guest link."
              : "The guest link could not be created."
        );
        return;
      }
      setFreshUrl(body.url);
      router.refresh();
    } catch {
      setError("The guest link could not be created.");
    } finally {
      setPending(null);
    }
  }

  async function revoke(invitationId: string) {
    setPending("revoke");
    setError(null);
    try {
      const response = await fetch(`/api/agency/demos/invitations/${invitationId}/revoke`, { method: "POST" });
      if (!response.ok) {
        setError("The invitation could not be revoked.");
        return;
      }
      setConfirmRevokeId(null);
      router.refresh();
    } catch {
      setError("The invitation could not be revoked.");
    } finally {
      setPending(null);
    }
  }

  async function copyUrl() {
    if (!freshUrl) return;
    try {
      await navigator.clipboard.writeText(freshUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="max-w-[70ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
        Create a private demonstration link for a fictional workspace. The link is shown once. Opening it signs the visitor in as a guest, separate from any paying customer.
      </p>

      {directory.accessMessage ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-primary)]">
          {directory.accessMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-[var(--border)] py-4 sm:grid-cols-4">
        <Metric label="Ready workspaces" value={metrics.workspaces} />
        <Metric label="Active links" value={metrics.active} />
        <Metric label="Open guest sessions" value={metrics.sessions} />
        <Metric label="Revoked links" value={metrics.revoked} />
      </div>

      <form onSubmit={createLink} className="rounded-lg border border-[var(--border)] p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">New guest link</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto] sm:items-end">
          <label className="block text-[12px] text-[var(--text-tertiary)]">
            Workspace
            <select
              className={`${fieldClass} mt-1.5`}
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={!directory.accessOpen || ready.length === 0}
            >
              {ready.length === 0 ? <option value="">No ready workspace</option> : null}
              {ready.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                  {workspace.scenario ? ` · ${workspace.scenario.replaceAll("_", " ")}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] text-[var(--text-tertiary)]">
            Link lifetime
            <select
              className={`${fieldClass} mt-1.5`}
              value={lifetimeMs}
              onChange={(event) => setLifetimeMs(event.target.value)}
              disabled={!directory.accessOpen}
            >
              {LIFETIMES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={!directory.accessOpen || !clientId || pending != null}>
            {pending === "create" ? "Creating…" : "Create guest link"}
          </Button>
        </div>
        {ready.length === 0 ? (
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
            No demonstration workspace on this database can accept a guest link yet.
          </p>
        ) : null}
      </form>

      {freshUrl ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:p-5">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">Copy this link now. It will not be shown again.</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            Open it in a private window while signed out of SegmiQ. A signed-in staff session will be refused.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={freshUrl} aria-label="Guest demonstration link" onFocus={(event) => event.currentTarget.select()} />
            <Button type="button" variant="secondary" onClick={() => void copyUrl()}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-[var(--error)]">{error}</p> : null}

      {directory.invitations.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)]">
          <EmptyState
            icon={Link2}
            title="No guest links yet"
            description="A link appears here after you create one. The address itself stays hidden."
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <Table>
            <TableHeader>
              <TableRow isHeader>
                <TableHead>Workspace</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {directory.invitations.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="font-medium">{row.workspaceName}</span>
                    {row.createdByName ? (
                      <span className="mt-0.5 block text-[12px] text-[var(--text-tertiary)]">{row.createdByName}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[12px] text-[var(--text-secondary)]">{formatTime(row.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap text-[12px] text-[var(--text-secondary)]">{formatTime(row.expiresAt)}</TableCell>
                  <TableCell className="tabular-nums text-[var(--text-secondary)]">{row.openSessions}</TableCell>
                  <TableCell>
                    <PlatformStatusBadge
                      kind={row.status === "active" ? "active" : row.status === "expired" ? "warning" : "neutral"}
                      label={statusLabel(row.status)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {row.status !== "active" ? null : confirmRevokeId === row.id ? (
                      <span className="inline-flex items-center gap-2">
                        <Button type="button" size="sm" variant="destructive" disabled={pending != null} onClick={() => void revoke(row.id)}>
                          Revoke
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRevokeId(null)}>
                          Cancel
                        </Button>
                      </span>
                    ) : (
                      <Button type="button" size="sm" variant="secondary" disabled={!directory.accessOpen || pending != null} onClick={() => setConfirmRevokeId(row.id)}>
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[12px] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
