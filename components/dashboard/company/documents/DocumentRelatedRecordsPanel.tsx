"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ExternalLink, Link2, Search } from "lucide-react";
import type { EnrichedDocumentEntityLink } from "@/lib/documents/linking/types";
import { entityTypeLabel } from "@/lib/documents/linking/hrefs";
import { Button } from "@/components/sales/ui";

type SearchCandidate = {
  entityType: string;
  entityId: string;
  label: string;
  subtitle?: string | null;
  linkType?: string;
};

export function DocumentRelatedRecordsPanel({
  clientId,
  documentId,
  links,
  canEdit,
}: {
  clientId: string;
  documentId: string;
  links: EnrichedDocumentEntityLink[];
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"CUSTOMER" | "QUOTATION">("CUSTOMER");
  const [results, setResults] = useState<SearchCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirmed = links.filter((l) => l.confirmed);
  const suggestions = links.filter((l) => !l.confirmed);

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        entityType: searchType,
      });
      const res = await fetch(
        `/api/clients/${clientId}/company-documents/${documentId}/links?${params}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { candidates: SearchCandidate[] };
      setResults(data.candidates ?? []);
    } finally {
      setSearching(false);
    }
  }, [clientId, documentId, query, searchType]);

  const linkRecord = useCallback(
    async (candidate: SearchCandidate) => {
      setBusyId(candidate.entityId);
      try {
        const res = await fetch(
          `/api/clients/${clientId}/company-documents/${documentId}/links`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityType: candidate.entityType,
              entityId: candidate.entityId,
              linkType: candidate.linkType ?? "MANUAL",
              label: candidate.label,
              subtitle: candidate.subtitle,
            }),
          }
        );
        if (res.ok) window.location.reload();
      } finally {
        setBusyId(null);
      }
    },
    [clientId, documentId]
  );

  const reviewLink = useCallback(
    async (linkId: string, action: "confirm" | "remove") => {
      setBusyId(linkId);
      try {
        const res = await fetch(
          `/api/clients/${clientId}/company-documents/${documentId}/links/${linkId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          }
        );
        if (res.ok) window.location.reload();
      } finally {
        setBusyId(null);
      }
    },
    [clientId, documentId]
  );

  return (
    <div className="space-y-6">
      {confirmed.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-white">Linked records</h2>
          {confirmed.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              canEdit={canEdit}
              busyId={busyId}
              onRemove={() => void reviewLink(link.id, "remove")}
            />
          ))}
        </section>
      ) : null}

      {suggestions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-amber-100">Suggested links</h2>
          <p className="text-xs text-zinc-500">
            Review AI-suggested CRM matches before relying on them.
          </p>
          {suggestions.map((link) => (
            <div key={link.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-amber-200/80">
                    {entityTypeLabel(link.entity_type)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">{link.label}</p>
                  {link.subtitle ? <p className="mt-0.5 text-xs text-zinc-400">{link.subtitle}</p> : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    {link.match_reason} · {link.confidence.toLowerCase()} confidence
                  </p>
                </div>
                <Link
                  href={link.href}
                  className="inline-flex items-center gap-1 text-xs text-lime-400 hover:underline"
                >
                  Open <ExternalLink size={12} />
                </Link>
              </div>
              {canEdit ? (
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busyId === link.id}
                    onClick={() => void reviewLink(link.id, "confirm")}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === link.id}
                    onClick={() => void reviewLink(link.id, "remove")}
                  >
                    Dismiss
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {confirmed.length === 0 && suggestions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 px-4 py-10 text-center">
          <Link2 className="mx-auto text-zinc-600" size={24} />
          <p className="mt-3 text-sm text-zinc-400">No CRM records linked yet.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Links are suggested automatically after analysis, or you can search below.
          </p>
        </div>
      ) : null}

      {canEdit ? (
        <section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <h2 className="text-sm font-medium text-white">Link a record</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as "CUSTOMER" | "QUOTATION")}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="CUSTOMER">Customer</option>
              <option value="QUOTATION">Quotation</option>
            </select>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchType === "CUSTOMER" ? "Search customer name" : "Search quote number"}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
            <Button variant="secondary" size="md" disabled={searching} onClick={() => void runSearch()}>
              <Search size={16} className="mr-1.5" />
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
          {results.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {results.map((candidate) => (
                <li
                  key={`${candidate.entityType}:${candidate.entityId}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-white">{candidate.label}</p>
                    {candidate.subtitle ? (
                      <p className="text-xs text-zinc-500">{candidate.subtitle}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === candidate.entityId}
                    onClick={() => void linkRecord(candidate)}
                  >
                    Link
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function LinkRow({
  link,
  canEdit,
  busyId,
  onRemove,
}: {
  link: EnrichedDocumentEntityLink;
  canEdit: boolean;
  busyId: string | null;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {entityTypeLabel(link.entity_type)}
        </p>
        <p className="mt-1 text-sm font-medium text-white">{link.label}</p>
        {link.subtitle ? <p className="mt-0.5 text-xs text-zinc-400">{link.subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Link
          href={link.href}
          className="inline-flex items-center gap-1 text-xs text-lime-400 hover:underline"
        >
          Open <ExternalLink size={12} />
        </Link>
        {canEdit ? (
          <button
            type="button"
            className="text-xs text-zinc-500 hover:text-red-300"
            disabled={busyId === link.id}
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}
