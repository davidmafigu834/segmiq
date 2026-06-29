"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  FileText,
  Send,
  Save,
  Loader2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  GripVertical,
  X,
} from "lucide-react";
import { openExternalUrl } from "@/lib/whatsapp-opener";
import { computeProposalTotals, lineAmount, formatMoney } from "@/lib/proposals/totals";
import type {
  ProposalLineItemRow,
  ProposalSectionKind,
  ProposalSectionRow,
  ProposalWithDetails,
} from "@/types";

type EditorItem = {
  key: string;
  item_name: string;
  description: string;
  unit_price: number;
  quantity: number;
  group_label: string;
};

type EditorSection = {
  key: string;
  kind: ProposalSectionKind;
  heading: string;
  body: string;
};

type Brand = {
  companyName: string;
  logoUrl: string | null;
  brandColor: string;
  companyEmail: string | null;
  companyPhone: string | null;
};

type Props = {
  proposal: ProposalWithDetails;
  onSaved: (p: ProposalWithDetails) => void;
  onSent: () => void;
  onClose: () => void;
};

const SECTION_KINDS: ProposalSectionKind[] = [
  "cover",
  "scope",
  "approach",
  "timeline",
  "investment",
  "terms",
  "custom",
];

const KIND_LABELS: Record<ProposalSectionKind, string> = {
  cover: "Cover",
  scope: "Scope",
  approach: "Approach",
  timeline: "Timeline",
  investment: "Investment",
  terms: "Terms",
  custom: "Section",
};

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `row-${keySeq}`;
}

function toEditorItems(items: ProposalLineItemRow[] | undefined): EditorItem[] {
  return (items ?? []).map((it) => ({
    key: nextKey(),
    item_name: it.item_name,
    description: it.description ?? "",
    unit_price: Number(it.unit_price) || 0,
    quantity: Number(it.quantity) || 1,
    group_label: it.group_label ?? "",
  }));
}

function toEditorSections(sections: ProposalSectionRow[] | undefined): EditorSection[] {
  return (sections ?? []).map((s) => ({
    key: nextKey(),
    kind: s.kind,
    heading: s.heading ?? "",
    body: s.body ?? "",
  }));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Borderless, auto-growing textarea that reads like document text. */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:text-[#c4c4c8] focus:ring-0 ${className}`}
    />
  );
}

export function ProposalBuilder({ proposal, onSaved, onSent, onClose }: Props) {
  const [title, setTitle] = useState(proposal.title ?? "Proposal");
  const [companyName, setCompanyName] = useState(proposal.company_name ?? "");
  const [recipientName, setRecipientName] = useState(proposal.recipient_name ?? "");
  const [recipientEmail, setRecipientEmail] = useState(proposal.recipient_email ?? "");
  const [recipientPhone, setRecipientPhone] = useState(proposal.recipient_phone ?? "");
  const [proposedMode, setProposedMode] = useState<"team" | "solo">(proposal.proposed_mode ?? "team");
  const [proposedPlan, setProposedPlan] = useState<"starter" | "professional" | "business">(
    proposal.proposed_plan ?? "starter"
  );
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(proposal.billing_cycle ?? "monthly");
  const [sections, setSections] = useState<EditorSection[]>(() => toEditorSections(proposal.sections));
  const [items, setItems] = useState<EditorItem[]>(() => toEditorItems(proposal.items));
  const [discount, setDiscount] = useState(Number(proposal.discount) || 0);
  const [taxRate, setTaxRate] = useState(Number(proposal.tax_rate) || 0);
  const [validUntil, setValidUntil] = useState(proposal.valid_until ?? "");
  const [terms, setTerms] = useState(proposal.terms ?? "");
  const [busy, setBusy] = useState<null | "save" | "preview" | "send" | "ai">(null);
  const [error, setError] = useState("");
  const [sendResult, setSendResult] = useState<{ link: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [brand, setBrand] = useState<Brand>({
    companyName: "Segmiq",
    logoUrl: null,
    brandColor: "#0F7A4F",
    companyEmail: null,
    companyPhone: null,
  });

  const currency = proposal.currency || "USD";
  const totals = useMemo(() => computeProposalTotals(items, discount, taxRate), [items, discount, taxRate]);

  useEffect(() => {
    fetch("/api/agency/proposal-settings")
      .then((r) => r.json())
      .then((d: { settings?: Record<string, unknown> }) => {
        const s = d.settings;
        if (!s) return;
        setBrand({
          companyName: (s.company_name as string | null) || "Segmiq",
          logoUrl: (s.logo_url as string | null) ?? null,
          brandColor: (s.brand_color as string | null) || "#0F7A4F",
          companyEmail: (s.company_email as string | null) ?? null,
          companyPhone: (s.company_phone as string | null) ?? null,
        });
      })
      .catch(() => {});
  }, []);

  // ── Sections ──
  function updateSection(key: string, patch: Partial<EditorSection>) {
    setSections((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeSection(key: string) {
    setSections((rows) => rows.filter((r) => r.key !== key));
  }
  function addSection(kind: ProposalSectionKind) {
    setSections((rows) => [
      ...rows,
      { key: nextKey(), kind, heading: kind === "custom" ? "" : KIND_LABELS[kind], body: "" },
    ]);
    setAddMenuOpen(false);
  }
  function moveSection(key: string, dir: -1 | 1) {
    setSections((rows) => {
      const idx = rows.findIndex((r) => r.key === key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= rows.length) return rows;
      const copy = [...rows];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  // ── Line items ──
  function updateItem(key: string, patch: Partial<EditorItem>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeItem(key: string) {
    setItems((rows) => rows.filter((r) => r.key !== key));
  }
  function addItem() {
    setItems((rows) => [
      ...rows,
      { key: nextKey(), item_name: "", description: "", unit_price: 0, quantity: 1, group_label: "" },
    ]);
  }

  function payload() {
    return {
      title: title || "Proposal",
      company_name: companyName || null,
      recipient_name: recipientName || null,
      recipient_email: recipientEmail || null,
      recipient_phone: recipientPhone || null,
      proposed_mode: proposedMode,
      proposed_plan: proposedPlan,
      billing_cycle: billingCycle,
      discount,
      tax_rate: taxRate,
      valid_until: validUntil || null,
      terms: terms || null,
      sections: sections
        .filter((s) => s.heading.trim() || s.body.trim())
        .map((s) => ({ kind: s.kind, heading: s.heading, body: s.body })),
      items: items
        .filter((i) => i.item_name.trim())
        .map((i) => ({
          item_name: i.item_name,
          description: i.description,
          unit_price: i.unit_price,
          quantity: i.quantity,
          group_label: i.group_label,
        })),
    };
  }

  async function save(): Promise<ProposalWithDetails | null> {
    const res = await fetch(`/api/agency/proposals/${proposal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const json = (await res.json().catch(() => ({}))) as { proposal?: ProposalWithDetails; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Save failed");
      return null;
    }
    if (json.proposal) onSaved(json.proposal);
    return json.proposal ?? null;
  }

  async function handleSave() {
    setBusy("save");
    setError("");
    await save();
    setBusy(null);
  }

  async function handlePreview() {
    setBusy("preview");
    setError("");
    const saved = await save();
    setBusy(null);
    if (saved) openExternalUrl(`/api/agency/proposals/${proposal.id}/pdf`);
  }

  async function handleAiDraft() {
    setBusy("ai");
    setError("");
    try {
      const res = await fetch(`/api/agency/proposals/${proposal.id}/draft-sections`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        sections?: { kind?: string; heading?: string | null; body?: string | null }[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not draft sections");
        return;
      }
      const drafted = (json.sections ?? []).map((s) => ({
        key: nextKey(),
        kind: (SECTION_KINDS.includes(s.kind as ProposalSectionKind)
          ? (s.kind as ProposalSectionKind)
          : "custom") as ProposalSectionKind,
        heading: s.heading ?? "",
        body: s.body ?? "",
      }));
      if (drafted.length) setSections((rows) => [...rows, ...drafted]);
    } catch {
      setError("Could not draft sections");
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    if (!recipientEmail.trim()) {
      setError("Add a recipient email in the sidebar first");
      return;
    }
    setBusy("send");
    setError("");
    const saved = await save();
    if (!saved) {
      setBusy(null);
      return;
    }
    const res = await fetch(`/api/agency/proposals/${proposal.id}/send`, { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as { link?: string; emailSent?: boolean; error?: string };
    setBusy(null);
    if (!res.ok || !json.link) {
      setError(json.error ?? "Send failed");
      return;
    }
    setSendResult({ link: json.link, emailSent: Boolean(json.emailSent) });
    onSent();
  }

  function copyLink() {
    if (!sendResult) return;
    void navigator.clipboard.writeText(sendResult.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const accent = brand.brandColor || "#0F7A4F";
  const hasItems = items.length > 0;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 layout:h-[calc(100dvh-8rem)] layout:flex-row layout:items-stretch layout:overflow-hidden">
      {/* ───────────────────── Document canvas (own scrollbar) ───────────────────── */}
      <div className="min-w-0 flex-1 layout:h-full layout:overflow-y-auto layout:pr-1.5">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">
            {proposal.proposal_number ? `Proposal ${proposal.proposal_number}` : "Draft"}
          </p>
          <button type="button" onClick={onClose} className="text-[12px] text-ink-secondary hover:text-ink-primary">
            ← Back to proposals
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e4e4e7] bg-white shadow-sm">
          {/* Branded header band */}
          <div className="px-8 py-6" style={{ background: accent }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt="" className="h-11 w-11 rounded bg-white/90 object-contain p-1" />
                ) : null}
                <span className="text-xl font-bold text-white">{brand.companyName}</span>
              </div>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                Proposal
              </span>
            </div>
          </div>

          {/* Title + meta */}
          <div className="border-b border-[#f1f1f3] px-8 pb-5 pt-6">
            <AutoTextarea
              value={title}
              onChange={setTitle}
              placeholder="Proposal title…"
              className="text-[28px] font-bold leading-tight text-[#09090b]"
            />
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#a1a1aa]">Prepared for</p>
                <p className="mt-0.5 font-semibold text-[#3f3f46]">
                  {companyName || recipientName || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#a1a1aa]">Valid until</p>
                <p className="mt-0.5 font-semibold text-[#3f3f46]">{formatDate(validUntil || null)}</p>
              </div>
              {hasItems ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[#a1a1aa]">Total</p>
                  <p className="mt-0.5 font-semibold" style={{ color: accent }}>
                    {formatMoney(totals.total, currency)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Section blocks */}
          <div className="px-8">
            {sections.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[#a1a1aa]">Your proposal is empty.</p>
                <button
                  type="button"
                  onClick={() => void handleAiDraft()}
                  disabled={busy !== null}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                  style={{ background: accent }}
                >
                  {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Draft it with AI
                </button>
              </div>
            ) : (
              sections.map((s, idx) => (
                <div key={s.key} className="group relative border-b border-[#f6f6f7] py-4 last:border-b-0">
                  {/* Hover toolbar (top-right, never clips) */}
                  <div className="absolute right-0 top-3 z-10 hidden items-center gap-0.5 rounded-lg border border-[#e4e4e7] bg-white px-1 py-0.5 shadow-sm group-hover:flex">
                    <GripVertical className="h-3.5 w-3.5 text-[#d4d4d8]" />
                    <button type="button" onClick={() => moveSection(s.key, -1)} disabled={idx === 0} className="rounded p-1 text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#52525b] disabled:opacity-30" aria-label="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moveSection(s.key, 1)} disabled={idx === sections.length - 1} className="rounded p-1 text-[#a1a1aa] hover:bg-[#f4f4f5] hover:text-[#52525b] disabled:opacity-30" aria-label="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => removeSection(s.key)} className="rounded p-1 text-[#a1a1aa] hover:bg-[#fef2f2] hover:text-red-600" aria-label="Delete section">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <select
                    value={s.kind}
                    onChange={(e) => updateSection(s.key, { kind: e.target.value as ProposalSectionKind })}
                    className="-ml-0.5 mb-0.5 cursor-pointer border-0 bg-transparent p-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa] outline-none focus:ring-0"
                  >
                    {SECTION_KINDS.map((k) => (
                      <option key={k} value={k}>{KIND_LABELS[k]}</option>
                    ))}
                  </select>
                  <AutoTextarea
                    value={s.heading}
                    onChange={(v) => updateSection(s.key, { heading: v })}
                    placeholder="Section heading"
                    className="text-[18px] font-bold leading-snug text-[#09090b]"
                  />
                  <AutoTextarea
                    value={s.body}
                    onChange={(v) => updateSection(s.key, { body: v })}
                    placeholder="Write this section… (or use AI draft)"
                    className="mt-1 text-[14.5px] leading-relaxed text-[#3f3f46]"
                  />
                </div>
              ))
            )}
          </div>

          {/* Pricing table block */}
          <div className="border-t border-[#f1f1f3] px-8 py-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Investment</h3>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-[#52525b] hover:bg-[#f4f4f5]"
              >
                <Plus className="h-3.5 w-3.5" /> Add line
              </button>
            </div>

            {hasItems ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#e4e4e7] text-left text-[10px] uppercase tracking-wide text-[#a1a1aa]">
                      <th className="py-2 pr-3 font-semibold">Item</th>
                      <th className="py-2 pr-3 text-right font-semibold">Unit price</th>
                      <th className="py-2 pr-3 text-right font-semibold">Qty</th>
                      <th className="py-2 pr-1 text-right font-semibold">Amount</th>
                      <th className="w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.key} className="group/row border-b border-[#f6f6f7] align-top">
                        <td className="py-3 pr-3">
                          <input
                            className="w-full border-0 bg-transparent p-0 text-[14px] font-semibold text-[#18181b] outline-none placeholder:text-[#c4c4c8] focus:ring-0"
                            placeholder="Item name"
                            value={it.item_name}
                            onChange={(e) => updateItem(it.key, { item_name: e.target.value })}
                          />
                          <input
                            className="mt-0.5 w-full border-0 bg-transparent p-0 text-[12.5px] text-[#71717a] outline-none placeholder:text-[#c4c4c8] focus:ring-0"
                            placeholder="Description (optional)"
                            value={it.description}
                            onChange={(e) => updateItem(it.key, { description: e.target.value })}
                          />
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <input
                            type="number"
                            inputMode="decimal"
                            className="w-24 border-0 bg-transparent p-0 text-right text-[14px] text-[#18181b] outline-none focus:ring-0"
                            value={it.unit_price}
                            onChange={(e) => updateItem(it.key, { unit_price: Number(e.target.value) })}
                          />
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <input
                            type="number"
                            inputMode="decimal"
                            className="w-14 border-0 bg-transparent p-0 text-right text-[14px] text-[#18181b] outline-none focus:ring-0"
                            value={it.quantity}
                            onChange={(e) => updateItem(it.key, { quantity: Number(e.target.value) })}
                          />
                        </td>
                        <td className="py-3 pr-1 text-right text-[14px] font-semibold text-[#18181b]">
                          {formatMoney(lineAmount(it.unit_price, it.quantity), currency)}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(it.key)}
                            className="text-[#d4d4d8] opacity-0 transition group-hover/row:opacity-100 hover:text-red-600"
                            aria-label="Remove line"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="mt-4 flex justify-end">
                  <div className="w-full max-w-[280px] space-y-1.5">
                    <div className="flex justify-between text-[13px] text-[#52525b]">
                      <span>Subtotal</span>
                      <span>{formatMoney(totals.subtotal, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px] text-[#52525b]">
                      <span className="flex items-center gap-1.5">
                        Discount
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-20 rounded border border-[#e4e4e7] bg-white px-1.5 py-0.5 text-right text-[12px] outline-none focus:border-[#a1a1aa]"
                          value={discount}
                          onChange={(e) => setDiscount(Number(e.target.value))}
                        />
                      </span>
                      <span>-{formatMoney(discount, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[13px] text-[#52525b]">
                      <span className="flex items-center gap-1.5">
                        Tax
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-14 rounded border border-[#e4e4e7] bg-white px-1.5 py-0.5 text-right text-[12px] outline-none focus:border-[#a1a1aa]"
                          value={taxRate}
                          onChange={(e) => setTaxRate(Number(e.target.value))}
                        />
                        %
                      </span>
                      <span>{formatMoney(totals.taxAmount, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#e4e4e7] pt-2 text-[15px] font-bold text-[#09090b]">
                      <span>Total</span>
                      <span style={{ color: accent }}>{formatMoney(totals.total, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-[#a1a1aa]">
                No pricing yet — add a line, or leave empty for a narrative-only proposal.
              </p>
            )}
          </div>

          {/* Terms block */}
          <div className="border-t border-[#f1f1f3] px-8 py-6">
            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
              Terms &amp; conditions
            </h3>
            <AutoTextarea
              value={terms}
              onChange={setTerms}
              placeholder="Add your terms and conditions…"
              className="text-[13px] leading-relaxed text-[#52525b]"
            />
          </div>
        </div>

        {/* Add-section control under the page */}
        <div className="mt-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddMenuOpen((v) => !v)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-3 text-[13px] font-semibold text-ink-secondary hover:border-[var(--accent)] hover:text-ink-primary"
            >
              <Plus className="h-4 w-4" /> Add section
            </button>
            {addMenuOpen ? (
              <div className="absolute left-1/2 z-10 mt-1 w-56 -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] shadow-lg">
                {SECTION_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => addSection(k)}
                    className="block w-full px-4 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
                  >
                    {KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ───────────────────── Settings / actions sidebar (own scrollbar) ───────────────────── */}
      <aside className="w-full shrink-0 layout:h-full layout:w-[340px] layout:overflow-y-auto layout:pl-1.5">
        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
          {/* Actions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-[13px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send proposal
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy !== null}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold text-ink-primary hover:bg-surface-card-alt disabled:opacity-50"
              >
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={busy !== null}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold text-ink-primary hover:bg-surface-card-alt disabled:opacity-50"
              >
                {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                PDF
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleAiDraft()}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold text-ink-primary hover:bg-surface-card-alt disabled:opacity-50"
            >
              {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Draft sections with AI
            </button>
          </div>

          {error ? <p className="text-[12px] text-[var(--danger)]">{error}</p> : null}

          {sendResult ? (
            <div className="rounded-xl border border-[var(--accent)] p-3">
              <p className="text-[12px] font-semibold text-ink-primary">
                Sent {sendResult.emailSent ? "— email delivered" : "(email not sent)"}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <input className="input-base h-8 flex-1 text-[11px]" readOnly value={sendResult.link} />
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-[11px] text-ink-secondary hover:bg-surface-card-alt"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ) : null}

          {/* Recipient */}
          <Group label="Recipient">
            <Field label="Company">
              <input className="input-base w-full" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" />
            </Field>
            <Field label="Contact name">
              <input className="input-base w-full" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Email">
              <input className="input-base w-full" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="name@company.com" />
            </Field>
            <Field label="Phone">
              <input className="input-base w-full" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="+263 …" />
            </Field>
          </Group>

          {/* Pricing meta */}
          <Group label="Pricing & validity">
            <Field label="Valid until">
              <input type="date" className="input-base w-full" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </Field>
          </Group>

          {/* Provisioning */}
          <Group label="On acceptance — provision as">
            <Field label="Plan">
              <select className="input-base w-full" value={proposedPlan} onChange={(e) => setProposedPlan(e.target.value as typeof proposedPlan)}>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="business">Business</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Mode">
                <select className="input-base w-full" value={proposedMode} onChange={(e) => setProposedMode(e.target.value as typeof proposedMode)}>
                  <option value="team">Team</option>
                  <option value="solo">Solo</option>
                </select>
              </Field>
              <Field label="Billing">
                <select className="input-base w-full" value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as typeof billingCycle)}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </Field>
            </div>
          </Group>
        </div>
      </aside>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t border-[var(--border)] pt-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">{label}</label>
      {children}
    </div>
  );
}
