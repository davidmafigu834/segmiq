"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Funnel } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { PlatformStatusBadge, type PlatformStatusKind } from "@/components/platform/PlatformStatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";

export type AdminFunnelRow = {
  id: string;
  status: "building" | "review" | "live" | "paused";
  clientName: string;
  listingHeading: string;
  listingSuburb: string | null;
  slug: string | null;
  updatedAt: string;
  publishedAt: string | null;
};

const fieldClass =
  "h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/40";

export const FUNNEL_STATUS: Record<AdminFunnelRow["status"], { kind: PlatformStatusKind; label: string }> = {
  building: { kind: "pending", label: "Being built" },
  review: { kind: "attention", label: "In review" },
  live: { kind: "active", label: "Live" },
  paused: { kind: "suspended", label: "Paused" },
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function FunnelAdminList({ funnels, clients }: { funnels: AdminFunnelRow[]; clients: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [listings, setListings] = useState<Array<{ id: string; label: string; status: string | null; approved: boolean }>>([]);
  const [listingId, setListingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setListings([]);
    setListingId("");
    if (!clientId) return;
    setLoading(true);
    fetch(`/api/admin/funnels?clientId=${clientId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { listings?: typeof listings; error?: string }) => {
        if (body.error) setError(body.error);
        setListings(body.listings ?? []);
      })
      .catch(() => setError("Could not load properties."))
      .finally(() => setLoading(false));
  }, [clientId]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!clientId || !listingId) return;
    setPending(true);
    setError(null);
    const response = await fetch("/api/admin/funnels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, listingId }),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    setPending(false);
    if (!response.ok || !body.id) {
      setError(body.error ?? "The funnel could not be created.");
      return;
    }
    router.push(`/dashboard/funnels/${body.id}`);
  }

  const live = funnels.filter((row) => row.status === "live").length;
  const building = funnels.filter((row) => row.status === "building" || row.status === "review").length;

  return (
    <div className="space-y-6">
      <p className="max-w-[70ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
        Bespoke sales pages the SegmiQ team builds for real estate clients. Each one runs in a sandbox on the property&apos;s public address. Agents share it with their own link, and enquiries go into the client&apos;s CRM, assigned to that agent.
      </p>

      <div className="grid grid-cols-3 gap-x-6 gap-y-4 border-y border-[var(--border)] py-4">
        {[
          ["Funnels", funnels.length],
          ["Live", live],
          ["In progress", building],
        ].map(([label, value]) => (
          <div key={label as string}>
            <p className="text-[12px] text-[var(--text-tertiary)]">{label}</p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={create} className="rounded-lg border border-[var(--border)] p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">New funnel</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] sm:items-end">
          <label className="block text-[12px] text-[var(--text-tertiary)]">
            Organisation
            <select className={`${fieldClass} mt-1.5`} value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="">Choose a real estate client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] text-[var(--text-tertiary)]">
            Property
            <select className={`${fieldClass} mt-1.5`} value={listingId} onChange={(event) => setListingId(event.target.value)} disabled={!clientId || loading}>
              <option value="">{loading ? "Loading…" : !clientId ? "Choose an organisation first" : listings.length ? "Choose a property" : "Every property already has a funnel"}</option>
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.label}
                  {listing.status && listing.status !== "available" ? ` · ${listing.status.replace(/_/g, " ")}` : ""}
                  {!listing.approved ? " · not approved" : ""}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={!clientId || !listingId || pending}>{pending ? "Creating…" : "Create funnel"}</Button>
        </div>
      </form>

      {error ? <p className="text-[13px] text-[var(--error)]">{error}</p> : null}

      {funnels.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)]">
          <EmptyState icon={Funnel} title="No funnels yet" description="Create one for a client property above, then paste or upload its page." />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <Table>
            <TableHeader>
              <TableRow isHeader>
                <TableHead>Property</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnels.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="block font-medium text-[var(--text-primary)]">{row.listingHeading}</span>
                    {row.slug ? <span className="block font-mono text-[12px] text-[var(--text-tertiary)]">/property/{row.slug}</span> : null}
                  </TableCell>
                  <TableCell>{row.clientName}</TableCell>
                  <TableCell>
                    <PlatformStatusBadge kind={FUNNEL_STATUS[row.status].kind} label={FUNNEL_STATUS[row.status].label} />
                  </TableCell>
                  <TableCell>{formatDate(row.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/funnels/${row.id}`} className="text-[13px] font-medium text-[var(--accent)] hover:underline">Open</Link>
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
