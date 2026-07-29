"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, RefreshCw } from "lucide-react";

export function WebsiteIntegrationPanel({ clientId }: { clientId: string }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/website-integration`);
      const json = (await res.json()) as { api_key?: string | null };
      setApiKey(json.api_key ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [clientId]);

  async function generate() {
    if (apiKey && !window.confirm("Rotate API key? The old key will stop working immediately.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/website-integration`, { method: "POST" });
      const json = (await res.json()) as { api_key?: string; error?: string };
      if (!res.ok || !json.api_key) {
        setToast(json.error ?? "Failed");
        return;
      }
      setApiKey(json.api_key);
      setToast("API key generated");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setToast("Copied");
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://segmiq.com";

  const example = `curl -X POST ${origin}/api/external-leads/submit \\
  -H "Content-Type: application/json" \\
  -d '{
  "api_key": "${apiKey ?? "YOUR_API_KEY"}",
  "source": "website",
  "listing_reference": "12 Oak Avenue",
  "agent_reference": "+263771234567",
  "name": "Jane Doe",
  "phone": "+263771234567",
  "email": "jane@example.com",
  "message": "Interested in viewing this weekend"
}'`;

  if (loading) return <p className="text-sm text-ink-tertiary">Loading…</p>;

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
        <div>
          <h3 className="font-display text-xl">Website Integration</h3>
          <p className="mt-1 text-sm text-ink-secondary">
            Generate an API key for your website or ad forms. Leads flow through the same
            assignment and WhatsApp pipeline as Segmiq forms.
          </p>
        </div>
      </div>

      {toast ? <p className="text-sm text-ink-secondary">{toast}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 font-mono text-xs">
          {apiKey ?? "No key generated yet"}
        </code>
        {apiKey ? (
          <button
            type="button"
            className="btn-ghost border border-[var(--border)] inline-flex items-center gap-1.5"
            onClick={() => copy(apiKey)}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy key
          </button>
        ) : null}
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-1.5"
          disabled={busy}
          onClick={() => void generate()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {apiKey ? "Rotate key" : "Generate key"}
        </button>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink-tertiary">
            Example request
          </p>
          <button
            type="button"
            className="text-xs text-ink-secondary hover:text-ink-primary"
            onClick={() => copy(example)}
          >
            Copy curl
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
          {example}
        </pre>
      </div>
    </div>
  );
}
