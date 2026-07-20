"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { MarketingHubTabs } from "./MarketingHubTabs";

type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  stats: Record<string, number>;
  created_at: string;
  template_name: string;
};

export function CampaignList({ clientId }: { clientId: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/clients/${clientId}/marketing/campaigns`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCampaigns(data.campaigns ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div>
      <MarketingHubTabs />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Campaigns</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            WhatsApp campaigns targeted to CRM audiences.
          </p>
        </div>
        <Link
          href="/client/marketing/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New campaign
        </Link>
      </div>

      {loading ? (
        <div className="shimmer h-48 rounded-xl" />
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No campaigns yet.</p>
          <Link
            href="/client/marketing/campaigns/new"
            className="mt-3 inline-block text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-elevated)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Name</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Sent</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Replies</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Template</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--surface-hover)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/client/marketing/campaigns/${c.id}`}
                      className="font-medium text-[var(--text-primary)] hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{c.status}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{c.stats?.sent ?? 0}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{c.stats?.replied ?? 0}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-tertiary)]">
                    {c.template_name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
