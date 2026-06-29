"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import type { ProposalSettingsRow } from "@/types";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors";
const labelCls = "mb-1 block font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]";

export function ProposalSettingsManager({ initialSettings }: { initialSettings: ProposalSettingsRow }) {
  const [form, setForm] = useState<ProposalSettingsRow>(initialSettings);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProposalSettingsRow>(key: K, value: ProposalSettingsRow[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/agency/proposal-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name,
          company_address: form.company_address,
          company_email: form.company_email,
          company_phone: form.company_phone,
          company_website: form.company_website,
          logo_url: form.logo_url,
          brand_color: form.brand_color,
          default_terms: form.default_terms,
          footer_note: form.footer_note,
          proposal_prefix: form.proposal_prefix,
          default_tax_rate: Number(form.default_tax_rate) || 0,
          default_validity_days: Number(form.default_validity_days) || 30,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { settings?: ProposalSettingsRow; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      if (json.settings) setForm(json.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Brand</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Company name</label>
            <input className={inputCls} value={form.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Logo URL</label>
            <input className={inputCls} value={form.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Brand colour</label>
            <input className={inputCls} placeholder="#0F7A4F" value={form.brand_color ?? ""} onChange={(e) => set("brand_color", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Contact details (PDF header / footer)</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} value={form.company_email ?? ""} onChange={(e) => set("company_email", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.company_phone ?? ""} onChange={(e) => set("company_phone", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input className={inputCls} value={form.company_website ?? ""} onChange={(e) => set("company_website", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <input className={inputCls} value={form.company_address ?? ""} onChange={(e) => set("company_address", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Footer note</label>
          <input className={inputCls} value={form.footer_note ?? ""} onChange={(e) => set("footer_note", e.target.value)} />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Defaults</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Number prefix</label>
            <input className={inputCls} value={form.proposal_prefix ?? "P"} onChange={(e) => set("proposal_prefix", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Default tax %</label>
            <input type="number" className={inputCls} value={form.default_tax_rate ?? 0} onChange={(e) => set("default_tax_rate", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Validity (days)</label>
            <input type="number" className={inputCls} value={form.default_validity_days ?? 30} onChange={(e) => set("default_validity_days", Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Default terms</label>
          <textarea
            className={`${inputCls} min-h-[8rem]`}
            rows={5}
            value={form.default_terms ?? ""}
            onChange={(e) => set("default_terms", e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {saved ? "Saved" : "Save settings"}
      </button>
    </div>
  );
}
