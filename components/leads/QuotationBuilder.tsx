"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileText, Send, Save, Loader2 } from "lucide-react";
import { openExternalUrl } from "@/lib/whatsapp-opener";
import { computeTotals, lineAmount, formatMoney } from "@/lib/quotations/totals";
import type { CatalogItemRow, QuotationLineItemRow, QuotationRow } from "@/types";

type EditorItem = {
  key: string;
  catalog_item_id: string | null;
  item_name: string;
  description: string;
  unit_price: number;
  quantity: number;
  group_label: string;
};

type QuotationWithItems = QuotationRow & { items?: QuotationLineItemRow[] };

type Props = {
  quotation: QuotationWithItems;
  clientId: string;
  leadPhone: string | null;
  onSaved: (q: QuotationWithItems) => void;
  onSent: () => void;
  onClose: () => void;
};

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `row-${keySeq}`;
}

function toEditorItems(items: QuotationLineItemRow[] | undefined): EditorItem[] {
  return (items ?? []).map((it) => ({
    key: nextKey(),
    catalog_item_id: it.catalog_item_id,
    item_name: it.item_name,
    description: it.description ?? "",
    unit_price: Number(it.unit_price) || 0,
    quantity: Number(it.quantity) || 1,
    group_label: it.group_label ?? "",
  }));
}

function titleCase(s: string): string {
  return s.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}

export function QuotationBuilder({ quotation, clientId, leadPhone, onSaved, onSent, onClose }: Props) {
  const [catalog, setCatalog] = useState<CatalogItemRow[]>([]);
  const [items, setItems] = useState<EditorItem[]>(() => toEditorItems(quotation.items));
  const [customerName, setCustomerName] = useState(quotation.customer_name ?? "");
  const [customerPhone, setCustomerPhone] = useState(quotation.customer_phone ?? "");
  const [customerEmail, setCustomerEmail] = useState(quotation.customer_email ?? "");
  const [taxRate, setTaxRate] = useState(Number(quotation.tax_rate) || 0);
  const [otherAmount, setOtherAmount] = useState(Number(quotation.other_amount) || 0);
  const [validUntil, setValidUntil] = useState(quotation.valid_until ?? "");
  const [notes, setNotes] = useState(quotation.notes ?? "");
  const [terms, setTerms] = useState(quotation.terms ?? "");
  const [catalogPick, setCatalogPick] = useState("");
  const [busy, setBusy] = useState<null | "save" | "preview" | "send">(null);
  const [error, setError] = useState("");

  const currency = quotation.currency || "USD";

  useEffect(() => {
    fetch(`/api/clients/${clientId}/catalog`)
      .then((r) => r.json())
      .then((d: { items?: CatalogItemRow[] }) => setCatalog(d.items ?? []))
      .catch(() => {});
  }, [clientId]);

  const totals = useMemo(
    () => computeTotals(items, taxRate, otherAmount),
    [items, taxRate, otherAmount]
  );

  function updateItem(key: string, patch: Partial<EditorItem>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeItem(key: string) {
    setItems((rows) => rows.filter((r) => r.key !== key));
  }
  function addBlank() {
    setItems((rows) => [
      ...rows,
      { key: nextKey(), catalog_item_id: null, item_name: "", description: "", unit_price: 0, quantity: 1, group_label: "" },
    ]);
  }
  function addFromCatalog(id: string) {
    const item = catalog.find((c) => c.id === id);
    if (!item) return;
    setItems((rows) => [
      ...rows,
      {
        key: nextKey(),
        catalog_item_id: item.id,
        item_name: item.name,
        description: item.description ?? "",
        unit_price: Number(item.unit_price) || 0,
        quantity: 1,
        group_label: item.category ? titleCase(item.category) : "",
      },
    ]);
    setCatalogPick("");
  }

  function payload() {
    return {
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      customer_email: customerEmail || null,
      tax_rate: taxRate,
      other_amount: otherAmount,
      valid_until: validUntil || null,
      notes: notes || null,
      terms: terms || null,
      items: items
        .filter((i) => i.item_name.trim())
        .map((i) => ({
          catalog_item_id: i.catalog_item_id,
          item_name: i.item_name,
          description: i.description,
          unit_price: i.unit_price,
          quantity: i.quantity,
          group_label: i.group_label,
        })),
    };
  }

  async function save(): Promise<QuotationWithItems | null> {
    const res = await fetch(`/api/quotations/${quotation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const json = (await res.json().catch(() => ({}))) as { quotation?: QuotationWithItems; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Save failed");
      return null;
    }
    if (json.quotation) onSaved(json.quotation);
    return json.quotation ?? null;
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
    if (saved) openExternalUrl(`/api/quotations/${quotation.id}/pdf`);
  }

  async function handleSend() {
    if (!items.some((i) => i.item_name.trim())) {
      setError("Add at least one line item first");
      return;
    }
    setBusy("send");
    setError("");
    const saved = await save();
    if (!saved) {
      setBusy(null);
      return;
    }
    const res = await fetch(`/api/quotations/${quotation.id}/send`, { method: "POST" });
    const json = (await res.json().catch(() => ({}))) as {
      pdfUrl?: string;
      waMessage?: string;
      error?: string;
    };
    setBusy(null);
    if (!res.ok) {
      setError(json.error ?? "Send failed");
      return;
    }
    // Open the rep's own WhatsApp with the quote link pre-filled.
    const digits = String(customerPhone || leadPhone || "").replace(/\D+/g, "");
    const text = encodeURIComponent(json.waMessage ?? `Here is your quotation: ${json.pdfUrl ?? ""}`);
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const url = isMobile
      ? digits
        ? `whatsapp://send?phone=${digits}&text=${text}`
        : `whatsapp://send?text=${text}`
      : digits
        ? `https://wa.me/${digits}?text=${text}`
        : `https://wa.me/?text=${text}`;
    openExternalUrl(url);
    onSent();
  }

  const grouped = useMemo(() => {
    const byCat: Record<string, CatalogItemRow[]> = {};
    for (const c of catalog) {
      const cat = c.category ? titleCase(c.category) : "Other";
      (byCat[cat] ??= []).push(c);
    }
    return byCat;
  }, [catalog]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">
          {quotation.quote_number ? `Quotation ${quotation.quote_number}` : "New quotation"}
        </p>
        <button type="button" onClick={onClose} className="text-[12px] text-ink-secondary hover:text-ink-primary">
          ← Back to quotes
        </button>
      </div>

      {/* Customer */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input className="input-base" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <input className="input-base" placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        <input className="input-base" placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-tertiary">Line items</span>
          <div className="flex items-center gap-2">
            <select
              className="input-base h-8 max-w-[160px] text-[12px]"
              value={catalogPick}
              onChange={(e) => {
                setCatalogPick(e.target.value);
                if (e.target.value) addFromCatalog(e.target.value);
              }}
            >
              <option value="">+ From catalog…</option>
              {Object.entries(grouped).map(([cat, list]) => (
                <optgroup key={cat} label={cat}>
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {formatMoney(c.unit_price, currency)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              onClick={addBlank}
              className="flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-[12px] text-ink-secondary hover:bg-surface-card-alt hover:text-ink-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Row
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-ink-tertiary">
            No items yet — add from the catalog or a blank row.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it) => (
              <div key={it.key} className="space-y-2 px-3 py-3">
                <div className="flex items-start gap-2">
                  <input
                    className="input-base flex-1"
                    placeholder="Item name"
                    value={it.item_name}
                    onChange={(e) => updateItem(it.key, { item_name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="mt-1.5 shrink-0 text-ink-tertiary hover:text-[var(--danger)]"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  className="input-base w-full text-[13px]"
                  placeholder="Description (optional)"
                  value={it.description}
                  onChange={(e) => updateItem(it.key, { description: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">Unit price</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="input-base w-full"
                      value={it.unit_price}
                      onChange={(e) => updateItem(it.key, { unit_price: Number(e.target.value) })}
                    />
                  </div>
                  <div className="w-20">
                    <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">Qty</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="input-base w-full"
                      value={it.quantity}
                      onChange={(e) => updateItem(it.key, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="w-28 text-right">
                    <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">Amount</label>
                    <p className="py-2 text-[13px] font-semibold text-ink-primary">
                      {formatMoney(lineAmount(it.unit_price, it.quantity), currency)}
                    </p>
                  </div>
                </div>
                <input
                  className="input-base w-full text-[12px]"
                  placeholder="Group (e.g. System, Accessories, Labour)"
                  value={it.group_label}
                  onChange={(e) => updateItem(it.key, { group_label: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between gap-2 py-1">
          <span className="text-[12px] text-ink-secondary">Subtotal</span>
          <span className="text-[13px] font-semibold text-ink-primary">{formatMoney(totals.subtotal, currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 py-1">
          <span className="flex items-center gap-2 text-[12px] text-ink-secondary">
            Tax
            <input
              type="number"
              inputMode="decimal"
              className="input-base h-7 w-16 text-[12px]"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
            />
            %
          </span>
          <span className="text-[13px] text-ink-primary">{formatMoney(totals.taxAmount, currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 py-1">
          <span className="flex items-center gap-2 text-[12px] text-ink-secondary">
            Other
            <input
              type="number"
              inputMode="decimal"
              className="input-base h-7 w-24 text-[12px]"
              value={otherAmount}
              onChange={(e) => setOtherAmount(Number(e.target.value))}
            />
          </span>
          <span className="text-[13px] text-ink-primary">{formatMoney(otherAmount, currency)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="text-[13px] font-bold text-ink-primary">TOTAL</span>
          <span className="text-[16px] font-bold text-[var(--accent)]">{formatMoney(totals.total, currency)}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">Valid until</label>
          <input type="date" className="input-base w-full" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">Note to customer</label>
        <input className="input-base w-full" placeholder="e.g. Please note all prices are in USD" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block font-mono text-[9px] uppercase tracking-wider text-ink-tertiary">Terms &amp; conditions</label>
        <textarea className="textarea-base min-h-[10rem]" rows={6} value={terms} onChange={(e) => setTerms(e.target.value)} />
      </div>

      {error ? <p className="text-[12px] text-[var(--danger)]">{error}</p> : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold text-ink-primary hover:bg-surface-card-alt disabled:opacity-50"
        >
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save draft
        </button>
        <button
          type="button"
          onClick={() => void handlePreview()}
          disabled={busy !== null}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[13px] font-semibold text-ink-primary hover:bg-surface-card-alt disabled:opacity-50"
        >
          {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Preview PDF
        </button>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={busy !== null}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-2 text-[13px] font-bold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send via WhatsApp
        </button>
      </div>
    </div>
  );
}
