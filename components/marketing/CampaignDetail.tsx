"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatCurrencyUsd } from "@/lib/format";
import { MarketingHubTabs } from "./MarketingHubTabs";

type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  template_name: string;
  stats: Record<string, number>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  test_sent_at: string | null;
  test_sent_to: string | null;
  estimated_recipients: number | null;
};

type Recipient = {
  id: string;
  phone: string;
  status: string;
  skip_reason: string | null;
  sent_at: string | null;
  replied_at: string | null;
  response_classification: string | null;
  error_message: string | null;
};

type Attribution = {
  messagesSent: number;
  replies: number;
  interested: number;
  quotationsIssued: number;
  dealsWon: number;
  pipelineValue: number;
  revenueWon: number;
  estimatedCost: number | null;
  costPerOpportunity: number | null;
  returnOnSpend: number | null;
  optOuts: number;
  bySalesperson: {
    name: string;
    replies: number;
    interested: number;
    dealsWon: number;
    revenueWon: number;
  }[];
};

export function CampaignDetail({
  clientId,
  campaignId,
}: {
  clientId: string;
  campaignId: string;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<Attribution | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/clients/${clientId}/marketing/campaigns/${campaignId}`),
      fetch(`/api/clients/${clientId}/marketing/campaigns/${campaignId}/attribution`),
    ])
      .then(async ([campRes, attrRes]) => {
        const campData = await campRes.json();
        const attrData = await attrRes.json();
        setCampaign(campData.campaign ?? null);
        setRecipients(campData.recipients ?? []);
        setAttribution(attrData.attribution ?? null);
        if (campData.campaign?.test_sent_to) setTestPhone(campData.campaign.test_sent_to);
      })
      .finally(() => setLoading(false));
  }, [clientId, campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTestSend() {
    setActionLoading(true);
    setMessage(null);
    const res = await fetch(
      `/api/clients/${clientId}/marketing/campaigns/${campaignId}/test-send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      }
    );
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Test send failed");
      return;
    }
    setMessage("Test message sent.");
    load();
  }

  async function handleLaunch() {
    setActionLoading(true);
    setMessage(null);
    const res = await fetch(
      `/api/clients/${clientId}/marketing/campaigns/${campaignId}/launch`,
      { method: "POST" }
    );
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Launch failed");
      return;
    }
    if (data.requiresApproval) {
      setMessage("Campaign submitted for manager approval.");
    } else {
      setMessage("Campaign launched — sending will begin shortly.");
    }
    load();
  }

  async function handleApprove() {
    setActionLoading(true);
    setMessage(null);
    const res = await fetch(
      `/api/clients/${clientId}/marketing/campaigns/${campaignId}/approve`,
      { method: "POST" }
    );
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Approval failed");
      return;
    }
    setMessage("Campaign approved and sending.");
    load();
  }

  if (loading) return <div className="shimmer h-48 rounded-xl" />;
  if (!campaign) return <p className="text-sm text-[var(--error)]">Campaign not found.</p>;

  const stats = campaign.stats ?? {};
  const isDraft = campaign.status === "draft";
  const awaitingApproval = campaign.status === "pending_approval";

  return (
    <div>
      <MarketingHubTabs />

      <Link
        href="/client/marketing/campaigns"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        All campaigns
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{campaign.name}</h2>
            <p className="mt-1 text-sm capitalize text-[var(--text-secondary)]">
              {campaign.objective.replace(/_/g, " ")} · {campaign.status.replace(/_/g, " ")}
            </p>
          </div>
          <span className="font-mono text-xs text-[var(--text-tertiary)]">{campaign.template_name}</span>
        </div>
      </div>

      {(isDraft || awaitingApproval) && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          {isDraft && (
            <>
              <p className="text-sm text-[var(--text-secondary)]">
                Send a test message before launching.{" "}
                {campaign.test_sent_at
                  ? `Last test sent to ${campaign.test_sent_to} at ${new Date(campaign.test_sent_at).toLocaleString()}.`
                  : "No test sent yet."}
              </p>
              <div className="flex gap-2">
                <input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+263771234567"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={actionLoading || !testPhone.trim()}
                  onClick={() => void handleTestSend()}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40"
                >
                  Send test
                </button>
                <button
                  type="button"
                  disabled={actionLoading || !campaign.test_sent_at}
                  onClick={() => void handleLaunch()}
                  className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
                >
                  Submit for launch
                </button>
              </div>
            </>
          )}
          {awaitingApproval && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--warning)]">
                This campaign ({campaign.estimated_recipients ?? 0} recipients) is awaiting manager
                approval.
              </p>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleApprove()}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
              >
                Approve & send
              </button>
            </div>
          )}
          {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
        </div>
      )}

      {attribution && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--text-primary)]">
            Revenue attribution
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Replies", attribution.replies],
              ["Interested", attribution.interested],
              ["Quotations", attribution.quotationsIssued],
              ["Deals won", attribution.dealsWon],
              ["Pipeline", formatCurrencyUsd(attribution.pipelineValue)],
              ["Revenue", formatCurrencyUsd(attribution.revenueWon)],
            ].map(([label, value]) => (
              <div key={label as string} className="text-center">
                <p className="text-xs text-[var(--text-tertiary)]">{label as string}</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>
          {(attribution.estimatedCost != null || attribution.returnOnSpend != null) && (
            <p className="mt-3 text-xs text-[var(--text-tertiary)]">
              {attribution.estimatedCost != null &&
                `Est. cost ${formatCurrencyUsd(attribution.estimatedCost)}`}
              {attribution.costPerOpportunity != null &&
                ` · Cost per opportunity ${formatCurrencyUsd(attribution.costPerOpportunity)}`}
              {attribution.returnOnSpend != null &&
                ` · ROAS ${attribution.returnOnSpend.toFixed(1)}x`}
            </p>
          )}
          {attribution.bySalesperson.length > 0 && (
            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">By salesperson</p>
              <div className="space-y-1">
                {attribution.bySalesperson.map((sp) => (
                  <div
                    key={sp.name}
                    className="flex justify-between text-xs text-[var(--text-secondary)]"
                  >
                    <span>{sp.name}</span>
                    <span>
                      {sp.interested} interested · {formatCurrencyUsd(sp.revenueWon)} won
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          ["Total", stats.total],
          ["Sent", stats.sent],
          ["Failed", stats.failed],
          ["Skipped", stats.skipped],
          ["Replied", stats.replied],
          ["Opt-outs", stats.opt_out],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center"
          >
            <p className="text-xs text-[var(--text-tertiary)]">{label as string}</p>
            <p className="text-xl font-semibold text-[var(--text-primary)]">{value ?? 0}</p>
          </div>
        ))}
      </div>

      {recipients.length > 0 && (
        <div className="rounded-xl border border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">Recipients</h3>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--surface-elevated)]">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">Phone</th>
                  <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-[var(--text-secondary)]">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-mono text-xs">{r.phone}</td>
                    <td className="px-4 py-2 capitalize text-[var(--text-secondary)]">
                      {r.status}
                      {r.skip_reason && (
                        <span className="ml-1 text-xs text-[var(--text-tertiary)]">({r.skip_reason})</span>
                      )}
                    </td>
                    <td className="px-4 py-2 capitalize text-[var(--text-secondary)]">
                      {r.response_classification ?? (r.replied_at ? "replied" : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
