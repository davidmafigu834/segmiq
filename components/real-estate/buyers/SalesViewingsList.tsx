"use client";

import { useEffect, useState } from "react";

type Viewing = {
  id: string;
  status: string;
  scheduled_at: string;
  confirmation_status?: string | null;
  outcome?: string | null;
  listing?: { suburb?: string | null; address?: string | null } | null;
  contact?: { name?: string | null } | null;
};

export function SalesViewingsList({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<Viewing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/clients/${clientId}/viewings`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Could not load viewings");
          return;
        }
        setRows(json.viewings ?? []);
      })
      .catch(() => setError("Could not load viewings"));
  }, [clientId]);

  return (
    <div className="space-y-3 px-4 py-4 md:px-6">
      <h1 className="text-lg font-semibold">Viewings</h1>
      <p className="text-sm text-sales-text-secondary">Appointments already on the shared viewing calendar. Schedule new ones from a buyer search.</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rows.length === 0 && !error ? <p className="text-sm text-sales-text-secondary">No viewings yet.</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border border-sales-border px-3 py-2 text-sm">
            <p className="font-semibold">{row.contact?.name || "Customer"} · {row.listing?.suburb || row.listing?.address || "Property"}</p>
            <p className="text-sales-text-secondary">
              {new Date(row.scheduled_at).toLocaleString()} · {row.status}
              {row.confirmation_status ? ` · ${row.confirmation_status.replaceAll("_", " ")}` : ""}
              {row.outcome ? ` · ${row.outcome.replaceAll("_", " ")}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
