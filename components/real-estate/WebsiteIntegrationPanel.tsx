"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react";

type IntegrationState = {
  has_key: boolean;
  api_key_masked: string | null;
  rotated_at: string | null;
};

export function WebsiteIntegrationPanel({ clientId }: { clientId: string }) {
  const [state, setState] = useState<IntegrationState | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/website-integration`);
      const json = (await res.json()) as IntegrationState;
      setState({
        has_key: Boolean(json.has_key),
        api_key_masked: json.api_key_masked ?? null,
        rotated_at: json.rotated_at ?? null,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [clientId]);

  async function generate() {
    if (state?.has_key && !window.confirm("Regenerate API key? The old key will stop working immediately.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/website-integration`, { method: "POST" });
      const json = (await res.json()) as { api_key?: string; api_key_masked?: string; rotated_at?: string; error?: string };
      if (!res.ok || !json.api_key) {
        setToast(json.error ?? "Failed");
        return;
      }
      setRevealedKey(json.api_key);
      setState({
        has_key: true,
        api_key_masked: json.api_key_masked ?? null,
        rotated_at: json.rotated_at ?? null,
      });
      setToast("Copy this key now. It will not be shown in full again.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!window.confirm("Revoke the website integration key? Incoming website leads will stop until a new key is generated.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/website-integration`, { method: "DELETE" });
      if (!res.ok) {
        setToast("Could not revoke key");
        return;
      }
      setRevealedKey(null);
      setState({ has_key: false, api_key_masked: null, rotated_at: new Date().toISOString() });
      setToast("API key revoked");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setToast("Copied");
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.segmiq.com";
  const example = `curl -X POST ${origin}/api/external-leads/submit \\
  -H "Content-Type: application/json" \\
  -d '{
  "api_key": "YOUR_API_KEY",
  "source": "website",
  "deal_side": "buy_side",
  "listing_reference": "burnside-12",
  "name": "Tendai Moyo",
  "phone": "+263771234567",
  "utm_source": "google",
  "utm_medium": "organic",
  "utm_campaign": "burnside-family-home"
}'`;

  if (loading) return <p className="text-[13px] text-sales-text-muted">Loading integration…</p>;

  return (
    <div className="space-y-4 workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-sales-text-primary" />
        <div>
          <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-sales-text-primary">
            Website lead integration
          </h3>
          <p className="mt-1 text-[13px] text-sales-text-secondary">
            Status:{" "}
            <span className="font-medium text-sales-text-primary">
              {state?.has_key ? "Connected" : "Not configured"}
            </span>
          </p>
          {state?.rotated_at ? (
            <p className="mt-0.5 text-[12px] text-sales-text-muted">
              Last regenerated{" "}
              {new Date(state.rotated_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          ) : null}
        </div>
      </div>

      {toast ? <p className="text-[13px] text-sales-text-secondary">{toast}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-[10px] border border-sales-border bg-sales-surface-subtle px-3 py-2 font-mono text-[12px]">
          {revealedKey ?? state?.api_key_masked ?? "No key generated yet"}
        </code>
        {revealedKey ? (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-sales-border px-3 text-[12px] font-medium"
            onClick={() => copy(revealedKey)}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy key
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-sales-brand px-3 text-[12px] font-semibold"
          disabled={busy}
          onClick={() => void generate()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {state?.has_key ? "Regenerate key" : "Generate key"}
        </button>
        {state?.has_key ? (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-sales-border px-3 text-[12px] font-medium"
            disabled={busy}
            onClick={() => void revoke()}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Revoke
          </button>
        ) : null}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sales-text-muted">
            Setup instructions
          </p>
          <button type="button" className="text-[12px] text-sales-text-secondary" onClick={() => copy(example)}>
            Copy setup instructions
          </button>
        </div>
        <pre className="overflow-x-auto rounded-[10px] border border-sales-border bg-sales-surface-subtle p-3 font-mono text-[11px] leading-relaxed text-sales-text-secondary">
          {example}
        </pre>
      </div>
    </div>
  );
}
