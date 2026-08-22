"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, TextArea } from "@/components/sales/ui";
import type { QuoteTemplateRow, QuotationLineItemInput } from "@/types";

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
        }),
      });
      await loadOne(template.id);
      flash("Template saved");
    } finally {
      setSaving(false);
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
            Pre-built quotations your team can start from — items, tax, terms and validity in one click.
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
              onToggle={() => {
                setExpandedId((cur) => (cur === t.id ? null : t.id));
                if (expandedId !== t.id) void loadOne(t.id);
              }}
              onSave={(items) => void saveTemplate(t, items)}
              onRemove={() => void removeTemplate(t.id)}
              onChange={(patch) =>
                setTemplates((prev) => prev.map((row) => (row.id === t.id ? { ...row, ...patch } : row)))
              }
            />
          ))}
        </ul>
      )}

      {toast ? <p className="text-[12px] text-sales-success-fg">{toast}</p> : null}
    </section>
  );
}

function TemplateEditorRow({
  template,
  expanded,
  saving,
  onToggle,
  onSave,
  onRemove,
  onChange,
}: {
  template: QuoteTemplateRow;
  expanded: boolean;
  saving: boolean;
  onToggle: () => void;
  onSave: (items: TemplateItemDraft[]) => void;
  onRemove: () => void;
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
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-sales-surface-hover"
      >
        <span className="text-[13px] font-semibold text-sales-text-primary">{template.name}</span>
        <span className="text-[12px] text-sales-text-muted">
          {template.is_active ? `${template.items?.length ?? 0} items` : "Archived"}
        </span>
      </button>

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
          />

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
            <Button variant="primary" size="sm" loading={saving} onClick={() => onSave(items)}>
              Save template
            </Button>
            <Button variant="ghost" size="sm" className="text-sales-danger" onClick={onRemove}>
              Remove
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
