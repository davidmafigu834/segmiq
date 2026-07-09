import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Plus, Save, Send, Trash2, Bookmark } from "lucide-react";
import { apiGet, apiPatch, apiPost, API_BASE } from "../lib/api";
import { formatMoney } from "../lib/format";
import { computeTotals, lineAmount } from "../lib/quotation-totals";
import { getToken } from "../lib/session";
import { fetchQuotationPdfBlob, shareQuotationPdf } from "../lib/share-quotation-pdf";
import { CrmButton } from "./crm";

type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  category: string | null;
  currency: string;
};

type SavedItem = {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  category: string | null;
};

type QuotationLineItem = {
  id?: string;
  catalog_item_id: string | null;
  item_name: string;
  description: string | null;
  unit_price: number;
  quantity: number;
  group_label: string | null;
};

type QuotationRow = {
  id: string;
  quote_number: string | null;
  status: string;
  total?: number;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  tax_rate: number;
  other_amount: number;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  currency: string | null;
  pdf_url: string | null;
  items?: QuotationLineItem[];
};

type EditorItem = {
  key: string;
  catalog_item_id: string | null;
  item_name: string;
  description: string;
  unit_price: number;
  quantity: number;
  group_label: string;
};

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `row-${keySeq}`;
}

function toEditorItems(items: QuotationLineItem[] | undefined): EditorItem[] {
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

type Props = {
  quotation: QuotationRow;
  clientId: string;
  leadPhone: string | null;
  onSaved: (q: QuotationRow) => void;
  onSent: () => void;
  onClose: () => void;
};

export function QuotationBuilder({
  quotation,
  clientId,
  leadPhone,
  onSaved,
  onSent,
  onClose,
}: Props) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [items, setItems] = useState<EditorItem[]>(() => toEditorItems(quotation.items));
  const [customerName, setCustomerName] = useState(quotation.customer_name ?? "");
  const [customerPhone, setCustomerPhone] = useState(quotation.customer_phone ?? leadPhone ?? "");
  const [customerEmail, setCustomerEmail] = useState(quotation.customer_email ?? "");
  const [taxRate, setTaxRate] = useState(Number(quotation.tax_rate) || 0);
  const [otherAmount, setOtherAmount] = useState(Number(quotation.other_amount) || 0);
  const [validUntil, setValidUntil] = useState(quotation.valid_until ?? "");
  const [notes, setNotes] = useState(quotation.notes ?? "");
  const [terms, setTerms] = useState(quotation.terms ?? "");
  const [catalogPick, setCatalogPick] = useState("");
  const [savedPick, setSavedPick] = useState("");
  const [busy, setBusy] = useState<null | "save" | "preview" | "send">(null);
  const [savingItemKey, setSavingItemKey] = useState<string | null>(null);
  const [saveItemToast, setSaveItemToast] = useState("");
  const [error, setError] = useState("");

  const currency = quotation.currency || "USD";

  useEffect(() => {
    void apiGet<{ items?: CatalogItem[] }>(`/api/clients/${clientId}/catalog`).then((res) => {
      if (res.ok) setCatalog(res.data.items ?? []);
    });
    void apiGet<{ items?: SavedItem[] }>(`/api/clients/${clientId}/saved-items`).then((res) => {
      if (res.ok) setSavedItems(res.data.items ?? []);
    });
  }, [clientId]);

  useEffect(() => {
    if (!saveItemToast) return;
    const t = window.setTimeout(() => setSaveItemToast(""), 2500);
    return () => window.clearTimeout(t);
  }, [saveItemToast]);

  const totals = useMemo(() => computeTotals(items, taxRate, otherAmount), [items, taxRate, otherAmount]);

  const grouped = useMemo(() => {
    const byCat: Record<string, CatalogItem[]> = {};
    for (const c of catalog) {
      const cat = c.category ? titleCase(c.category) : "Other";
      (byCat[cat] ??= []).push(c);
    }
    return byCat;
  }, [catalog]);

  const groupedSaved = useMemo(() => {
    const byCat: Record<string, SavedItem[]> = {};
    for (const c of savedItems) {
      const cat = c.category ? titleCase(c.category) : "My items";
      (byCat[cat] ??= []).push(c);
    }
    return byCat;
  }, [savedItems]);

  function updateItem(key: string, patch: Partial<EditorItem>) {
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeItem(key: string) {
    setItems((rows) => rows.filter((r) => r.key !== key));
  }

  function addBlank() {
    setItems((rows) => [
      ...rows,
      {
        key: nextKey(),
        catalog_item_id: null,
        item_name: "",
        description: "",
        unit_price: 0,
        quantity: 1,
        group_label: "",
      },
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

  function addFromSaved(id: string) {
    const item = savedItems.find((c) => c.id === id);
    if (!item) return;
    setItems((rows) => [
      ...rows,
      {
        key: nextKey(),
        catalog_item_id: null,
        item_name: item.name,
        description: item.description ?? "",
        unit_price: Number(item.unit_price) || 0,
        quantity: 1,
        group_label: item.category ? titleCase(item.category) : "",
      },
    ]);
    setSavedPick("");
  }

  async function saveRowToLibrary(row: EditorItem) {
    if (!row.item_name.trim()) return;
    setSavingItemKey(row.key);
    try {
      const res = await apiPost<{ item?: SavedItem; updated?: boolean; error?: string }>(
        `/api/clients/${clientId}/saved-items`,
        {
          name: row.item_name.trim(),
          description: row.description.trim() || null,
          unit_price: row.unit_price,
          category: row.group_label.trim() || null,
        }
      );
      if (!res.ok || !res.data.item) {
        setError(res.data.error ?? "Could not save item");
        return;
      }
      setSavedItems((prev) => {
        const rest = prev.filter((s) => s.id !== res.data.item!.id);
        return [...rest, res.data.item!].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSaveItemToast(res.data.updated ? "Item updated in your library" : "Item saved to your library");
    } catch {
      setError("Could not save item");
    } finally {
      setSavingItemKey(null);
    }
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

  async function save(): Promise<QuotationRow | null> {
    const res = await apiPatch<{ quotation?: QuotationRow; error?: string }>(
      `/api/quotations/${quotation.id}`,
      payload()
    );
    if (!res.ok) {
      setError(res.data.error ?? "Save failed");
      return null;
    }
    if (res.data.quotation) {
      onSaved(res.data.quotation);
      return res.data.quotation;
    }
    return null;
  }

  async function handlePreview() {
    setBusy("preview");
    setError("");
    const saved = await save();
    if (saved?.pdf_url) {
      window.open(saved.pdf_url, "_blank");
      setBusy(null);
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/quotations/${quotation.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch {
      setError("Could not preview PDF.");
    }
    setBusy(null);
  }

  async function handleSave() {
    setBusy("save");
    setError("");
    await save();
    setBusy(null);
  }

  async function handleSend() {
    if (!items.some((i) => i.item_name.trim())) {
      setError("Add at least one line item first.");
      return;
    }
    setBusy("send");
    setError("");
    const saved = await save();
    if (!saved) {
      setBusy(null);
      return;
    }
    const res = await apiPost<{ waMessage?: string; pdfUrl?: string; quoteNumber?: string; error?: string }>(
      `/api/quotations/${quotation.id}/send`,
      {}
    );
    if (!res.ok || !res.data.waMessage || !res.data.pdfUrl) {
      setBusy(null);
      setError(res.data.error ?? "Send failed");
      return;
    }
    try {
      const token = await getToken();
      const pdfBlob = await fetchQuotationPdfBlob(res.data.pdfUrl, token);
      const fileName = `quotation-${res.data.quoteNumber ?? quotation.id}.pdf`;
      const shared = await shareQuotationPdf({
        pdfBlob,
        fileName,
        phone: customerPhone || leadPhone,
        message: res.data.waMessage,
      });
      setBusy(null);
      if (!shared.ok) {
        setError(shared.error ?? "Could not share PDF via WhatsApp.");
        return;
      }
    } catch {
      setBusy(null);
      setError("Could not prepare PDF for WhatsApp.");
      return;
    }
    onSent();
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-[16px] text-ink-primary outline-none focus:border-border-focus";

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <p className="eyebrow mb-0">
          {quotation.quote_number ? `Quote ${quotation.quote_number}` : "New quotation"}
        </p>
        <button type="button" onClick={onClose} className="text-[13px] font-semibold text-accent">
          ← Back
        </button>
      </div>

      <input className={inputClass} placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      <input className={inputClass} placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
      <input className={inputClass} placeholder="Email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />

      <div className="rounded-xl border border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-3">
          <span className="eyebrow mb-0">Line items</span>
          <div className="flex flex-wrap gap-2">
            {savedItems.length > 0 ? (
              <select
                className="max-w-[180px] rounded-lg border border-border bg-bg-primary px-3 py-2 text-[13px] text-ink-primary"
                value={savedPick}
                onChange={(e) => {
                  setSavedPick(e.target.value);
                  if (e.target.value) addFromSaved(e.target.value);
                }}
              >
                <option value="">+ My items</option>
                {Object.entries(groupedSaved).map(([cat, list]) => (
                  <optgroup key={cat} label={cat}>
                    {list.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : null}
            <select
              className="max-w-[180px] rounded-lg border border-border bg-bg-primary px-3 py-2 text-[13px] text-ink-primary"
              value={catalogPick}
              onChange={(e) => {
                setCatalogPick(e.target.value);
                if (e.target.value) addFromCatalog(e.target.value);
              }}
            >
              <option value="">+ Catalog</option>
              {Object.entries(grouped).map(([cat, list]) => (
                <optgroup key={cat} label={cat}>
                  {list.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              onClick={addBlank}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-[13px] text-ink-secondary"
            >
              <Plus size={14} /> Row
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-tertiary">
            Add items from your saved library, catalog, or a blank row.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((it) => (
              <div key={it.key} className="space-y-2 px-3 py-3">
                <div className="flex items-start gap-2">
                  <input
                    className={`${inputClass} flex-1`}
                    placeholder="Item name"
                    value={it.item_name}
                    onChange={(e) => updateItem(it.key, { item_name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => void saveRowToLibrary(it)}
                    disabled={!it.item_name.trim() || savingItemKey === it.key}
                    className="mt-3 text-ink-tertiary disabled:opacity-40"
                    aria-label="Save to my items"
                  >
                    {savingItemKey === it.key ? <Loader2 size={18} className="animate-spin" /> : <Bookmark size={18} />}
                  </button>
                  <button type="button" onClick={() => removeItem(it.key)} className="mt-3 text-ink-tertiary">
                    <Trash2 size={18} />
                  </button>
                </div>
                <input
                  className={`${inputClass} text-[14px]`}
                  placeholder="Description"
                  value={it.description}
                  onChange={(e) => updateItem(it.key, { description: e.target.value })}
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase text-ink-tertiary">Price</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputClass}
                      value={it.unit_price}
                      onChange={(e) => updateItem(it.key, { unit_price: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase text-ink-tertiary">Qty</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputClass}
                      value={it.quantity}
                      onChange={(e) => updateItem(it.key, { quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex flex-col justify-end pb-3 text-right">
                    <p className="text-[13px] font-semibold text-ink-primary">
                      {formatMoney(lineAmount(it.unit_price, it.quantity), currency)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border p-4 space-y-2">
        <div className="flex justify-between text-[14px]">
          <span className="text-ink-secondary">Subtotal</span>
          <span>{formatMoney(totals.subtotal, currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[14px]">
          <span className="flex items-center gap-2 text-ink-secondary">
            Tax
            <input
              type="number"
              className="w-16 rounded border border-border bg-bg-primary px-2 py-1 text-[14px]"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
            />
            %
          </span>
          <span>{formatMoney(totals.taxAmount, currency)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-[14px]">
          <span className="flex items-center gap-2 text-ink-secondary">
            Other
            <input
              type="number"
              className="w-24 rounded border border-border bg-bg-primary px-2 py-1 text-[14px]"
              value={otherAmount}
              onChange={(e) => setOtherAmount(Number(e.target.value))}
            />
          </span>
          <span>{formatMoney(otherAmount, currency)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 text-[16px] font-bold">
          <span>Total</span>
          <span className="text-accent">{formatMoney(totals.total, currency)}</span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[12px] text-ink-secondary">Valid until</label>
        <input type="date" className={inputClass} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-[12px] text-ink-secondary">Note to customer</label>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-[12px] text-ink-secondary">Terms</label>
        <textarea className={`${inputClass} min-h-[120px] resize-none`} rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} />
      </div>

      {saveItemToast ? <p className="text-[13px] text-accent">{saveItemToast}</p> : null}
      {error ? <p className="text-[13px] text-[var(--error)]">{error}</p> : null}

      <div className="flex flex-col gap-2">
        <CrmButton variant="secondary" disabled={busy !== null} onClick={() => void handleSave()}>
          {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save draft
        </CrmButton>
        <CrmButton variant="secondary" disabled={busy !== null} onClick={() => void handlePreview()}>
          {busy === "preview" ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          Preview PDF
        </CrmButton>
        <CrmButton disabled={busy !== null} onClick={() => void handleSend()}>
          {busy === "send" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Send via WhatsApp
        </CrmButton>
      </div>
    </div>
  );
}
