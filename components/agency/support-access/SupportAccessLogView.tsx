"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { PlatformStatusBadge } from "@/components/platform/PlatformStatusBadge";
import type { PlatformStatusKind } from "@/components/platform/PlatformStatusBadge";
import { PlatformDrawer, DetailList } from "@/components/platform/PlatformDrawer";
import {
  SUPPORT_ACCESS_SCOPE_LABELS,
  type SupportAccessScope,
} from "@/lib/security/support-access/scopes";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";

export type SupportAccessLogRow = {
  id: string;
  reference: string;
  administrator: string | null;
  organisation: string | null;
  organisationId: string;
  status: string;
  accessKind: "SUPPORT" | "BREAK_GLASS";
  scopes: SupportAccessScope[];
  reason: string;
  ticketReference: string | null;
  durationMinutes: number;
  requestedAt: string;
  startedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};

type TimelineEvent = {
  id: string;
  at: string;
  label: string;
  outcome: "SUCCESS" | "DENIED" | "ERROR";
};

function statusKind(status: string): PlatformStatusKind {
  if (status === "ACTIVE") return "active";
  if (status === "PENDING" || status === "APPROVED") return "pending";
  if (status === "DENIED") return "error";
  return "neutral";
}

export function SupportAccessLogView({ rows }: { rows: SupportAccessLogRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openRow = rows.find((r) => r.id === openId) ?? null;

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.getTime();
    return {
      active: rows.filter((r) => r.status === "ACTIVE").length,
      pending: rows.filter((r) => r.status === "PENDING" || r.status === "APPROVED").length,
      today: rows.filter((r) => new Date(r.requestedAt).getTime() >= todayIso).length,
      expired: rows.filter((r) => r.status === "EXPIRED").length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-[var(--border)] py-4 sm:grid-cols-4">
        <Metric label="Active sessions" value={metrics.active} />
        <Metric label="Pending requests" value={metrics.pending} />
        <Metric label="Sessions today" value={metrics.today} />
        <Metric label="Expired" value={metrics.expired} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)]">
          <EmptyState
            icon={ShieldCheck}
            title="No support sessions"
            description="Privileged support activity will appear here when access is requested."
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <Table>
            <TableHeader>
              <TableRow isHeader>
                <TableHead>Administrator</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(row.id)}
                >
                  <TableCell>
                    <span className="font-medium">{row.administrator ?? "SegmiQ staff"}</span>
                    {row.accessKind === "BREAK_GLASS" ? (
                      <span className="ml-2 text-[11px] text-[var(--error)]">Break glass</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.organisation ?? row.organisationId.slice(0, 8)}</TableCell>
                  <TableCell className="max-w-[20ch] truncate text-[12px] text-[var(--text-secondary)]">
                    {row.scopes.map((s) => SUPPORT_ACCESS_SCOPE_LABELS[s]).join(" · ")}
                  </TableCell>
                  <TableCell className="max-w-[24ch] truncate text-[var(--text-secondary)]" title={row.reason}>
                    {row.reason}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[12px] text-[var(--text-secondary)]">
                    {formatTime(row.startedAt ?? row.requestedAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[12px] text-[var(--text-secondary)]">
                    {row.expiresAt ? formatTime(row.expiresAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <PlatformStatusBadge kind={statusKind(row.status)} label={row.status.toLowerCase()} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <GrantDrawer row={openRow} onClose={() => setOpenId(null)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[12px] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.03em] text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function GrantDrawer({ row, onClose }: { row: SupportAccessLogRow | null; onClose: () => void }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!row) {
      setEvents(null);
      return;
    }
    setLoading(true);
    void fetch(`/api/admin/support-access/${row.id}/events`)
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((payload: { events?: TimelineEvent[] }) => setEvents(payload.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [row]);

  return (
    <PlatformDrawer
      open={Boolean(row)}
      onClose={onClose}
      title="Support Access"
      description={row ? row.organisation ?? row.organisationId : undefined}
    >
      {row ? (
        <div className="space-y-6">
          <PlatformStatusBadge kind={statusKind(row.status)} label={row.status} />
          <DetailList
            rows={[
              { label: "Administrator", value: row.administrator ?? "SegmiQ staff" },
              { label: "Reason", value: row.reason },
              {
                label: "Scope",
                value: row.scopes.map((s) => SUPPORT_ACCESS_SCOPE_LABELS[s]).join(", "),
              },
              { label: "Reference", value: row.reference, mono: true },
              { label: "Started", value: formatTime(row.startedAt ?? row.requestedAt) },
              { label: "Expires", value: row.expiresAt ? formatTime(row.expiresAt) : "—" },
              { label: "Ticket", value: row.ticketReference ?? "—" },
            ]}
          />
          <div>
            <h3 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">Session activity</h3>
            {loading ? (
              <p className="text-[13px] text-[var(--text-secondary)]">Loading…</p>
            ) : events && events.length ? (
              <ol className="space-y-2 border-l border-[var(--border)] pl-4">
                {events.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)]" />
                    <p className="font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
                      {formatClock(event.at)}
                    </p>
                    <p
                      className={`text-[13px] ${
                        event.outcome === "DENIED" ? "text-[var(--error)]" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {event.label}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[13px] text-[var(--text-secondary)]">No events recorded.</p>
            )}
          </div>
        </div>
      ) : null}
    </PlatformDrawer>
  );
}

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

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
