"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, TextArea } from "@/components/sales/ui";
import type { QuoteTemplateRow, QuotationLineItemInput } from "@/types";
import { RESIDENTIAL_PREMIUM_SOLAR_KEY } from "@/lib/quotations/layouts/types";
import { QuoteTemplatePreviewDialog } from "@/components/client-settings/QuoteTemplatePreviewDialog";

type TemplateItemDraft = QuotationLineItemInput & { key: string };

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `t-${keySeq}`;
}

export function QuoteTemplatesManager({
  clientId,
  embedded = false,
}: {
  clientId: string;
  embedded?: boolean;
}) {
  const [templates, setTemplates] = useState<QuoteTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/quote-templates?all=1`)
      .then((r) => r.json())
      .then((d: { templates?: QuoteTemplateRow[] }) => setTemplates(d.templates ?? []))
      .finally(() => setLoading(false));
  }, [clientId]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }

  async function loadOne(id: string) {
    const res = await fetch(`/api/clients/${clientId}/quote-templates/${id}`);
    const json = (await res.json()) as { template?: QuoteTemplateRow };
    if (json.template) {
      setTemplates((prev) => prev.map((t) => (t.id === id ? json.template! : t)));
    }
  }

  async function addTemplate() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/quote-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), items: [] }),
      });
      const json = (await res.json()) as { template?: QuoteTemplateRow };
      if (json.template) {
        setTemplates((prev) => [...prev, json.template!]);
        setNewName("");
        setExpandedId(json.template.id);
        flash("Template created");
      }
    } finally {
      setAdding(false);
    }
  }

  async function saveTemplate(template: QuoteTemplateRow, items: TemplateItemDraft[]) {
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}/quote-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          tax_rate: template.tax_rate,
          other_amount: template.other_amount,
          notes: template.notes,
          terms: template.terms,
          valid_for_days: template.valid_for_days,
          items: items
            .filter((i) => i.item_name.trim())
            .map((i) => ({
              item_name: i.item_name,
              description: i.description,
              unit_price: i.unit_price,
              quantity: i.quantity,
              group_label: i.group_label,
            })),
          presentation: template.presentation,
        }),
      });
      await loadOne(template.id);
      flash("Template saved");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTemplate(template: QuoteTemplateRow) {
    const name = `${template.name} — copy`;
    const res = await fetch(`/api/clients/${clientId}/quote-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicate_from: template.id, name }),
    });
    const json = (await res.json()) as { template?: QuoteTemplateRow; error?: string };
    if (json.template) {
      setTemplates((prev) => [...prev, json.template!]);
      setExpandedId(json.template.id);
      flash("Template duplicated");
    } else {
      flash(json.error ?? "Couldn't duplicate");
    }
  }

  async function removeTemplate(id: string) {
    await fetch(`/api/clients/${clientId}/quote-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    flash("Template removed");
  }

  if (loading) return <p className="text-[13px] text-sales-text-muted">Loading templates…</p>;

  return (
    <section className="space-y-3">
      {embedded ? null : (
        <div>
          <h3 className="text-[15px] font-semibold text-sales-text-primary">Quote templates</h3>
          <p className="mt-0.5 text-[13px] text-sales-text-secondary">
            Starting points for common offers. Click Residential Premium Solar to preview the full populated layout.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          compact
          className="min-w-[200px] flex-1"
          placeholder="New template name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={adding || !newName.trim()}
          loading={adding}
          leftIcon={<Plus size={14} />}
          onClick={() => void addTemplate()}
        >
          Add template
        </Button>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-sales-border px-4 py-8 text-center text-[13px] text-sales-text-muted">
          No templates yet. Create one for your most common packages.
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <TemplateEditorRow
              key={t.id}
              template={t}
              expanded={expandedId === t.id}
              saving={saving}
              onPreview={
                t.layout_key === RESIDENTIAL_PREMIUM_SOLAR_KEY || t.builtin_key === RESIDENTIAL_PREMIUM_SOLAR_KEY
                  ? () => setPreview({ id: t.id, name: t.name })
                  : undefined
              }
              onToggle={() => {
                setExpandedId((cur) => (cur === t.id ? null : t.id));
                if (expandedId !== t.id) void loadOne(t.id);
              }}
              onSave={(items) => void saveTemplate(t, items)}
              onRemove={() => void removeTemplate(t.id)}
              onDuplicate={() => void duplicateTemplate(t)}
              onChange={(patch) =>
                setTemplates((prev) => prev.map((row) => (row.id === t.id ? { ...row, ...patch } : row)))
              }
            />
          ))}
        </ul>
      )}

      {preview ? (
        <QuoteTemplatePreviewDialog
          clientId={clientId}
          templateId={preview.id}
          templateName={preview.name}
          onClose={() => setPreview(null)}
        />
      ) : null}

      {toast ? <p className="text-[12px] text-sales-success-fg">{toast}</p> : null}
    </section>
  );
}

function TemplateEditorRow({
  template,
  expanded,
  saving,
  onPreview,
  onToggle,
  onSave,
  onRemove,
  onDuplicate,
  onChange,
}: {
  template: QuoteTemplateRow;
  expanded: boolean;
  saving: boolean;
  onPreview?: () => void;
  onToggle: () => void;
  onSave: (items: TemplateItemDraft[]) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onChange: (patch: Partial<QuoteTemplateRow>) => void;
}) {
  const [items, setItems] = useState<TemplateItemDraft[]>([]);

  useEffect(() => {
    if (!expanded) return;
    setItems(
      (template.items ?? []).map((it) => ({
        key: nextKey(),
        item_name: it.item_name,
        description: it.description ?? "",
        unit_price: Number(it.unit_price) || 0,
        quantity: Number(it.quantity) || 1,
        group_label: it.group_label ?? "",
      }))
    );
  }, [expanded, template.items, template.id]);

  function addRow() {
    setItems((rows) => [
      ...rows,
      { key: nextKey(), item_name: "", description: "", unit_price: 0, quantity: 1, group_label: "" },
    ]);
  }

  return (
    <li className="rounded-[10px] border border-sales-border">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onPreview ?? onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-sales-surface-hover"
        >
          {template.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={template.thumbnail}
              alt=""
              className="h-14 w-10 shrink-0 rounded border border-sales-border-subtle bg-[#F3F3F3] object-cover object-top"
            />
          ) : null}
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-sales-text-primary">
              {template.name}
              {template.is_builtin ? (
                <span className="ml-2 rounded-full bg-sales-surface-hover px-1.5 py-0.5 text-[10px] font-medium text-sales-text-muted">
                  Built-in
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-[12px] text-sales-text-muted">
              {onPreview
                ? "Click to preview the full populated quotation"
                : template.is_active
                  ? `${template.items?.length ?? 0} items`
                  : "Archived"}
            </span>
          </span>
        </button>
        {onPreview ? (
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 px-3 text-[12px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
          >
            {expanded ? "Hide details" : "Details"}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-sales-border-subtle px-4 py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              compact
              value={template.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
            <Input
              compact
              type="number"
              placeholder="Valid for (days)"
              value={template.valid_for_days}
              onChange={(e) => onChange({ valid_for_days: Number(e.target.value) || 30 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              compact
              type="number"
              placeholder="Tax %"
              value={template.tax_rate}
              onChange={(e) => onChange({ tax_rate: Number(e.target.value) })}
            />
            <Input
              compact
              type="number"
              placeholder="Other amount"
              value={template.other_amount}
              onChange={(e) => onChange({ other_amount: Number(e.target.value) })}
            />
          </div>
          <TextArea
            placeholder="Default terms"
            value={template.terms ?? ""}
            onChange={(e) => onChange({ terms: e.target.value })}
            disabled={template.is_builtin}
          />
          {template.layout_key === "residential-premium-solar" && !template.is_builtin ? (
            <div className="space-y-2 rounded-[10px] border border-sales-border-subtle p-3">
              <p className="text-[12px] font-semibold">Presentation</p>
              <Input
                compact
                placeholder="Hero headline"
                value={String(template.presentation?.heroHeadline ?? "")}
                onChange={(e) =>
                  onChange({ presentation: { ...(template.presentation ?? {}), heroHeadline: e.target.value } })
                }
              />
              <TextArea
                placeholder="Hero supporting copy"
                value={String(template.presentation?.heroSubcopy ?? "")}
                onChange={(e) =>
                  onChange({ presentation: { ...(template.presentation ?? {}), heroSubcopy: e.target.value } })
                }
              />
              <Input
                compact
                placeholder="Accent colour #A3C639"
                value={String(template.presentation?.accent ?? "")}
                onChange={(e) =>
                  onChange({ presentation: { ...(template.presentation ?? {}), accent: e.target.value } })
                }
              />
              <Input
                compact
                placeholder="Default hero image URL"
                value={String(template.presentation?.heroImageUrl ?? "")}
                onChange={(e) =>
                  onChange({ presentation: { ...(template.presentation ?? {}), heroImageUrl: e.target.value } })
                }
              />
            </div>
          ) : null}

          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.key} className="grid grid-cols-12 gap-2">
                <Input
                  compact
                  className="col-span-4"
                  placeholder="Item"
                  value={it.item_name}
                  onChange={(e) =>
                    setItems((rows) =>
                      rows.map((r) => (r.key === it.key ? { ...r, item_name: e.target.value } : r))
                    )
                  }
                />
                <Input
                  compact
                  type="number"
                  className="col-span-2"
                  placeholder="Price"
                  value={it.unit_price || ""}
                  onChange={(e) =>
                    setItems((rows) =>
                      rows.map((r) => (r.key === it.key ? { ...r, unit_price: Number(e.target.value) } : r))
                    )
                  }
                />
                <Input
                  compact
                  type="number"
                  className="col-span-2"
                  placeholder="Qty"
                  value={it.quantity}
                  onChange={(e) =>
                    setItems((rows) =>
                      rows.map((r) => (r.key === it.key ? { ...r, quantity: Number(e.target.value) } : r))
                    )
                  }
                />
                <Input
                  compact
                  className="col-span-3"
                  placeholder="Group"
                  value={it.group_label ?? ""}
                  onChange={(e) =>
                    setItems((rows) =>
                      rows.map((r) => (r.key === it.key ? { ...r, group_label: e.target.value } : r))
                    )
                  }
                />
                <button
                  type="button"
                  className="col-span-1 text-sales-text-muted hover:text-sales-danger"
                  onClick={() => setItems((rows) => rows.filter((r) => r.key !== it.key))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={addRow} className="text-[12px] font-medium text-sales-text-secondary hover:text-sales-text-primary">
              + Add line item
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {template.is_builtin ? (
              <p className="w-full text-[12px] text-sales-text-secondary">
                Built-in templates cannot be edited. Duplicate to customise hero, headline and accent.
              </p>
            ) : null}
            {onPreview ? (
              <Button variant={template.is_builtin ? "primary" : "secondary"} size="sm" onClick={onPreview}>
                Preview
              </Button>
            ) : null}
            {!template.is_builtin ? (
              <Button variant="primary" size="sm" loading={saving} onClick={() => onSave(items)}>
                Save template
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={onDuplicate}>
              Duplicate / customise
            </Button>
            <Button variant="ghost" size="sm" className="text-sales-danger" onClick={onRemove}>
              {template.is_builtin ? "Hide" : "Remove"}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
