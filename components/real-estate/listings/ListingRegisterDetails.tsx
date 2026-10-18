"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/sales/ui";
import { IntroductionMatchStatus, strengthLabel } from "@/components/real-estate/buyers/IntroductionMatchStatus";
import {
  REGISTER_ISSUE_LABEL,
  REGISTER_MANDATE_LABEL,
  type RegisterMandateState,
  type RegisterRow,
} from "@/lib/real-estate/listing-register-rules";

type Match = {
  searchId: string;
  strength: string;
  reasons: string[];
  managedBy: string;
  contactName: string | null;
  phone?: string | null;
  canRequestIntroduction: boolean;
  introductionStatus?: string | null;
  introductionNote?: string | null;
};

export function mandateTone(state: RegisterMandateState): "success" | "warning" | "danger" | "neutral" {
  if (state === "approved") return "success";
  if (state === "expiring" || state === "awaiting" || state === "legacy_unverified") return "warning";
  if (state === "expired" || state === "revoked") return "danger";
  return "neutral";
}

export function registerActivityLine(row: RegisterRow | undefined): string {
  if (!row) return "—";
  const parts = [
    `${row.interestCount} interested`,
    `${row.viewingCount} viewing${row.viewingCount === 1 ? "" : "s"}`,
    `${row.offerCount} offer${row.offerCount === 1 ? "" : "s"}`,
  ];
  return parts.join(" · ");
}

export function ListingRegisterDetails({
  clientId,
  listingId,
  listingLive,
  row,
  basePath,
  onToast,
}: {
  clientId: string;
  listingId: string;
  listingLive: boolean;
  row: RegisterRow | undefined;
  basePath: "/client" | "/sales";
  onToast: (message: string) => void;
}) {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [requestErrors, setRequestErrors] = useState<Record<string, string>>({});

  async function loadMatches() {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/matching?listingId=${listingId}`);
      const json = (await res.json().catch(() => ({}))) as { matches?: Match[]; notice?: string | null; error?: string };
      if (!res.ok) {
        onToast(json.error ?? "Matching buyers could not be loaded.");
        return;
      }
      setMatches(json.matches ?? []);
      setNotice(json.notice ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function requestIntroduction(searchId: string) {
    setRequestingId(searchId);
    setRequestErrors((current) => ({ ...current, [searchId]: "" }));
    try {
      const res = await fetch(`/api/clients/${clientId}/buyer-sales/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "introduction", listingId, searchId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRequestErrors((current) => ({ ...current, [searchId]: json.error ?? "The introduction could not be requested." }));
        return;
      }
      setMatches((current) =>
        (current ?? []).map((match) =>
          match.searchId === searchId
            ? {
                ...match,
                introductionStatus: "requested",
                canRequestIntroduction: false,
                introductionNote:
                  match.managedBy === "Unassigned"
                    ? "Awaiting review by agency management."
                    : `Awaiting review by ${match.managedBy}.`,
              }
            : match
        )
      );
    } finally {
      setRequestingId(null);
    }
  }

  async function requestCollaboration() {
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/agency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "collaboration", kind: "listing_assistance", listingId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        onToast(json.error ?? "The request could not be sent.");
        return;
      }
      setRequested(true);
      onToast("Collaboration requested. The listing agent will review it.");
    } finally {
      setBusy(false);
    }
  }

  if (!row) {
    return <p className="mt-4 text-[12px] text-sales-text-muted">Register details are loading or unavailable.</p>;
  }

  return (
    <div className="mt-4 space-y-3 border-t border-sales-border-subtle pt-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
        <div>
          <dt className="text-[11px] text-sales-text-muted">Sourced by</dt>
          <dd>{row.sourcingAgentName ?? (row.sourcingAgentId ? "Former team member" : "—")}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-sales-text-muted">Mandate</dt>
          <dd>
            <Badge tone={mandateTone(row.mandate)} appearance="soft">
              {REGISTER_MANDATE_LABEL[row.mandate]}
            </Badge>
            {row.mandateExpiry ? (
              <span className="ml-1 text-[11px] text-sales-text-muted">until {row.mandateExpiry.slice(0, 10)}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-sales-text-muted">Interest</dt>
          <dd className="tabular-nums">
            {row.interestCount} people · {row.searchCount} searches
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-sales-text-muted">Viewings</dt>
          <dd className="tabular-nums">
            {row.viewingCount} total · {row.upcomingViewingCount} upcoming
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-sales-text-muted">Open offers</dt>
          <dd className="tabular-nums">{row.offerCount}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-sales-text-muted">Transaction</dt>
          <dd>{row.hasActiveTransaction ? "In progress" : "None"}</dd>
        </div>
      </dl>

      {row.issues.length ? (
        <ul className="flex flex-wrap gap-1" aria-label="Listing issues">
          {row.issues.map((issue) => (
            <li key={issue}>
              <Badge tone="warning" appearance="soft">
                {REGISTER_ISSUE_LABEL[issue]}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {listingLive ? (
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void loadMatches()}>
            {matches ? "Refresh buyers" : "Match buyers"}
          </Button>
        ) : null}
        {row.activeTransactionId ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              window.location.href = `${basePath}/transactions?open=${row.activeTransactionId}`;
            }}
          >
            Open transaction
          </Button>
        ) : null}
        {row.canRequestCollaboration && !requested ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void requestCollaboration()}>
            Request collaboration
          </Button>
        ) : null}
      </div>

      {matches ? (
        <div className="space-y-2">
          {notice ? <p className="text-[12px] text-sales-text-muted">{notice}</p> : null}
          {matches.length === 0 ? (
            <p className="text-[12px] text-sales-text-muted">No active buyer searches match this listing.</p>
          ) : (
            <ul className="space-y-2">
              {matches.slice(0, 20).map((match) => (
                <li key={match.searchId} className="rounded-sales-md border border-sales-border-subtle px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                      {match.contactName ?? "Private buyer"}
                    </p>
                    <Badge tone={match.strength === "strong" ? "success" : "neutral"} appearance="soft">
                      {strengthLabel(match.strength)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-sales-text-muted">Managed by {match.managedBy}</p>
                  {match.reasons.length ? (
                    <p className="mt-1 text-[12px] text-sales-text-secondary">{match.reasons.slice(0, 3).join(" · ")}</p>
                  ) : null}
                  {match.contactName && !match.introductionStatus ? (
                    <a
                      className="re-focus mt-1 inline-flex min-h-11 items-center text-[13px] font-semibold text-sales-brand"
                      href={`${basePath}/buyers/${match.searchId}`}
                    >
                      Open search
                    </a>
                  ) : null}
                  <IntroductionMatchStatus
                    status={match.introductionStatus ?? null}
                    note={match.introductionNote ?? null}
                    contactName={null}
                    phone={match.introductionStatus === "accepted" ? match.phone ?? null : null}
                    managedBy={match.managedBy}
                    canRequest={match.canRequestIntroduction}
                    busy={requestingId === match.searchId}
                    error={requestErrors[match.searchId] || null}
                    onRequest={() => void requestIntroduction(match.searchId)}
                  />
                </li>
              ))}
            </ul>
          )}
          {matches.length > 20 ? (
            <p className="text-[12px] text-sales-text-muted">Showing the strongest 20 of {matches.length} matches.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
