"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/quotations/totals";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableEl,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  EmptyState,
  FieldLabel,
  Input,
  Select,
  Switch,
  TextArea,
  useSalesToast,
} from "@/components/sales/ui";
import {
  formatQty,
  newRowId,
  type ProductFormState,
  type ProductRecord,
  type SpecRow,
} from "./types";

function SectionHead({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-sales-text-primary">{title}</h2>
        <p className="mt-1 text-[13px] text-sales-text-secondary">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-sales-border bg-sales-surface p-4 sm:p-5">
      {title ? <h3 className="mb-4 text-[13px] font-semibold text-sales-text-primary">{title}</h3> : null}
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-sales-border-subtle py-3 last:border-b-0">
      <span className="text-[13px] text-sales-text-primary">{label}</span>
      <div className="flex items-center gap-2">
        <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
        <span className="w-8 text-[12px] font-medium text-sales-text-secondary">{checked ? "On" : "Off"}</span>
      </div>
    </div>
  );
}

export function ProductVariantsSection({
  clientId,
  product,
  onReload,
  readOnly,
}: {
  clientId: string;
  product: ProductRecord | null;
  onReload: () => void;
  readOnly: boolean;
}) {
  const { toast } = useSalesToast();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [attrName, setAttrName] = useState("");
  const [attrOptions, setAttrOptions] = useState("");
  const defs = product?.attributeDefs ?? [];
  const variants = product?.variants ?? [];

  async function addAttr() {
    if (!product || !attrName.trim()) return;
    const res = await fetch(`/api/clients/${clientId}/products/${product.id}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "attribute",
        name: attrName.trim(),
        options: attrOptions.split(/[·,]/).map((s) => s.trim()).filter(Boolean),
      }),
    });
    if (!res.ok) {
      toast({ title: "Could not save option", tone: "error" });
      return;
    }
    setAttrName("");
    setAttrOptions("");
    onReload();
  }

  async function addVariant() {
    if (!product || !name.trim()) return;
    const res = await fetch(`/api/clients/${clientId}/products/${product.id}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        sku: sku || null,
        selling_price_override: price === "" ? null : Number(price),
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast({ title: json.error || "Could not add variant", tone: "error" });
      return;
    }
    setName("");
    setSku("");
    setPrice("");
    onReload();
  }

  return (
    <div className="space-y-5">
      <SectionHead
        title="Variants"
        subtitle="Manage product options such as size or colour."
        action={
          readOnly ? null : (
            <Button size="md" onClick={() => void addVariant()} disabled={!name.trim()}>
              + Add variant
            </Button>
          )
        }
      />
      <Panel title="Variant options">
        {defs.length === 0 ? (
          <p className="text-[13px] text-sales-text-muted">No options yet. Add an attribute such as Size or Colour.</p>
        ) : (
          <div className="space-y-3">
            {defs.map((d) => {
              const options = Array.isArray(d.options) ? (d.options as string[]) : [];
              return (
                <div key={String(d.id)}>
                  <div className="text-[13px] font-semibold text-sales-text-primary">{String(d.name)}</div>
                  <div className="mt-1 text-[13px] text-sales-text-secondary">
                    {options.length ? options.join(" · ") : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {readOnly ? null : (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input value={attrName} onChange={(e) => setAttrName(e.target.value)} placeholder="Attribute (e.g. Size)" />
            <Input value={attrOptions} onChange={(e) => setAttrOptions(e.target.value)} placeholder="Options, comma separated" />
            <Button variant="secondary" size="md" disabled={!attrName.trim()} onClick={() => void addAttr()}>
              Add option
            </Button>
          </div>
        )}
      </Panel>
      <Panel>
        {variants.length === 0 ? (
          <EmptyState title="No variants" description="Add a variant when this Product is sold in options such as size or colour." />
        ) : (
          <DataTable>
            <DataTableEl>
              <DataTableHead>
                <DataTableRow>
                  <DataTableTh>Variant</DataTableTh>
                  <DataTableTh>SKU</DataTableTh>
                  <DataTableTh className="text-right">Price</DataTableTh>
                  <DataTableTh>Status</DataTableTh>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {variants.map((v) => (
                  <DataTableRow key={String(v.id)}>
                    <DataTableTd className="font-medium">{String(v.name)}</DataTableTd>
                    <DataTableTd className="font-mono text-[12px]">{String(v.sku ?? "—")}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">
                      {v.selling_price_override == null
                        ? formatMoney(Number(product?.selling_price) || 0, product?.currency)
                        : formatMoney(Number(v.selling_price_override), product?.currency)}
                    </DataTableTd>
                    <DataTableTd>{String(v.status ?? "ACTIVE") === "ACTIVE" ? "Active" : String(v.status)}</DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </DataTable>
        )}
        {readOnly ? null : (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Variant name" />
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price override" />
            <Button variant="secondary" size="md" disabled={!name.trim()} onClick={() => void addVariant()}>
              Add
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function ProductPricingSection({
  form,
  setForm,
  canSeeCost,
  readOnly,
}: {
  form: ProductFormState;
  setForm: (patch: Partial<ProductFormState>) => void;
  canSeeCost: boolean;
  readOnly: boolean;
}) {
  const selling = Number(form.selling_price) || 0;
  const cost = form.cost_price === "" ? null : Number(form.cost_price);
  const margin =
    canSeeCost && cost != null && Number.isFinite(cost) && selling > 0 ? ((selling - cost) / selling) * 100 : null;
  return (
    <div className="space-y-5">
      <SectionHead title="Pricing" subtitle="Manage the Product's selling and commercial defaults." />
      <Panel title="Current pricing">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <FieldLabel>Selling price</FieldLabel>
            <Input
              value={form.selling_price}
              disabled={readOnly}
              onChange={(e) => setForm({ selling_price: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>Currency</FieldLabel>
            <Input value={form.currency} disabled={readOnly} onChange={(e) => setForm({ currency: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Unit</FieldLabel>
            <Input value={form.unit} disabled readOnly />
          </div>
          <div>
            <FieldLabel>Tax %</FieldLabel>
            <Input value={form.tax_rate} disabled={readOnly} onChange={(e) => setForm({ tax_rate: e.target.value })} />
          </div>
        </div>
      </Panel>
      <Panel title="Quotation pricing">
        <ToggleRow
          label="Allow salesperson price override"
          checked={form.price_editable_on_quote}
          onChange={(v) => setForm({ price_editable_on_quote: v })}
          disabled={readOnly}
        />
        <ToggleRow
          label="Discount allowed"
          checked={form.discount_allowed}
          onChange={(v) => setForm({ discount_allowed: v })}
          disabled={readOnly}
        />
      </Panel>
      {canSeeCost ? (
        <Panel title="Internal cost">
          <p className="mb-3 text-[12px] text-sales-text-muted">Visible only with cost permission.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Cost price</FieldLabel>
              <Input
                value={form.cost_price}
                disabled={readOnly}
                onChange={(e) => setForm({ cost_price: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Estimated base margin</FieldLabel>
              <div className="flex h-11 items-center text-[13px] font-medium tabular-nums text-sales-text-primary sm:h-10">
                {margin == null ? "—" : `${margin.toFixed(1)}%`}
              </div>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

export function ProductInventorySection({
  clientId,
  product,
  form,
  readOnly,
  onReload,
}: {
  clientId: string;
  product: ProductRecord | null;
  form: ProductFormState;
  readOnly: boolean;
  onReload: () => void;
}) {
  const { toast } = useSalesToast();
  const inv = product?.inventory;
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [movements, setMovements] = useState<Array<Record<string, unknown>>>([]);
  const [locationId, setLocationId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("Received");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("");
  const unit = form.unit || "Each";

  useEffect(() => {
    if (!product || form.item_type === "SERVICE" || !form.track_inventory) return;
    fetch(`/api/clients/${clientId}/inventory`)
      .then((r) => r.json())
      .then((j: { locations?: Array<{ id: string; name: string }> }) => {
        const locs = j.locations ?? [];
        setLocations(locs);
        if (!locationId && locs[0]) setLocationId(locs[0].id);
        if (!fromId && locs[0]) setFromId(locs[0].id);
        if (!toId && locs[1]) setToId(locs[1].id);
      })
      .catch(() => undefined);
    fetch(`/api/clients/${clientId}/inventory/movements?productId=${product.id}&limit=12`)
      .then((r) => r.json())
      .then((j: { movements?: Array<Record<string, unknown>> }) => setMovements(j.movements ?? []))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, product?.id, form.track_inventory, form.item_type]);

  if (form.item_type === "SERVICE") {
    return (
      <div>
        <SectionHead title="Inventory" subtitle="Inventory does not apply to Services." />
        <p className="mt-6 text-[13px] text-sales-text-secondary">Services are not stocked. Switch the Product type to Product to track inventory.</p>
      </div>
    );
  }
  if (!form.track_inventory) {
    return (
      <div>
        <SectionHead title="Inventory" subtitle="Track availability across company locations." />
        <p className="mt-6 text-[13px] text-sales-text-secondary">Inventory is not tracked for this Product. Enable Track inventory on Overview to start.</p>
      </div>
    );
  }

  async function adjust() {
    if (!product || !locationId || !delta) return;
    const res = await fetch(`/api/clients/${clientId}/inventory/movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "adjust",
        locationId,
        productId: product.id,
        delta: Number(delta),
        reason,
        note: reason === "Other" ? "Manual adjustment" : null,
        movementType: reason === "Received" ? "STOCK_RECEIVED" : "STOCK_ADJUSTMENT",
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast({ title: json.error || "Could not adjust stock", tone: "error" });
      return;
    }
    setDelta("");
    onReload();
  }

  async function transfer() {
    if (!product || !fromId || !toId || !qty) return;
    const res = await fetch(`/api/clients/${clientId}/inventory/movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transfer",
        fromLocationId: fromId,
        toLocationId: toId,
        productId: product.id,
        quantity: Number(qty),
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast({ title: json.error || "Could not transfer", tone: "error" });
      return;
    }
    setQty("");
    onReload();
  }

  const locName = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="space-y-5">
      <SectionHead
        title="Inventory"
        subtitle="Track availability across company locations."
        action={
          readOnly ? null : (
            <div className="flex gap-2">
              <Button variant="secondary" size="md" onClick={() => void adjust()} disabled={!delta || !locationId}>
                Adjust stock
              </Button>
              <Button variant="secondary" size="md" onClick={() => void transfer()} disabled={!qty || !fromId || !toId}>
                Transfer stock
              </Button>
            </div>
          )
        }
      />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-sales-border bg-sales-border md:grid-cols-4">
        {[
          ["On hand", formatQty(inv?.onHand, unit)],
          ["Reserved", formatQty(inv?.reserved, unit)],
          ["Available", formatQty(inv?.available, unit)],
          ["Reorder level", inv?.reorderLevel == null ? "—" : String(inv.reorderLevel)],
        ].map(([label, value]) => (
          <div key={label} className="bg-sales-surface px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">{label}</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-sales-text-primary">{value}</div>
          </div>
        ))}
      </div>
      {readOnly ? null : (
        <Panel title="Adjust / transfer">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Location</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Input value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="Qty (+/−)" />
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="Received">Received</option>
              <option value="Adjustment">Adjustment</option>
              <option value="Other">Other</option>
            </Select>
            <Button size="md" variant="secondary" onClick={() => void adjust()}>
              Apply adjust
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <Select value={fromId} onChange={(e) => setFromId(e.target.value)}>
              <option value="">From</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">To</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantity" />
            <Button size="md" variant="secondary" onClick={() => void transfer()}>
              Transfer
            </Button>
          </div>
        </Panel>
      )}
      <Panel title="Stock by location">
        {(inv?.locations ?? []).length === 0 ? (
          <p className="text-[13px] text-sales-text-muted">No location balances yet. Adjust stock to create a balance.</p>
        ) : (
          <DataTable>
            <DataTableEl>
              <DataTableHead>
                <DataTableRow>
                  <DataTableTh>Location</DataTableTh>
                  <DataTableTh className="text-right">On hand</DataTableTh>
                  <DataTableTh className="text-right">Reserved</DataTableTh>
                  <DataTableTh className="text-right">Available</DataTableTh>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {(inv?.locations ?? []).map((l) => (
                  <DataTableRow key={l.locationId}>
                    <DataTableTd>{l.name}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{l.onHand.toLocaleString()}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{l.reserved.toLocaleString()}</DataTableTd>
                    <DataTableTd className="text-right tabular-nums">{l.available.toLocaleString()}</DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </DataTable>
        )}
      </Panel>
      <Panel title="Recent movements">
        {movements.length === 0 ? (
          <p className="text-[13px] text-sales-text-muted">No movements recorded for this Product.</p>
        ) : (
          <ul className="space-y-3">
            {movements.map((m) => (
              <li key={String(m.id)} className="text-[13px]">
                <div className="font-medium text-sales-text-primary">
                  {String(m.reason ?? m.movement_type ?? "Movement")}
                </div>
                <div className="mt-0.5 text-sales-text-secondary">
                  {m.quantity != null ? `${Number(m.quantity) > 0 ? "+" : ""}${m.quantity}` : ""}
                  {m.location_id ? ` · ${locName.get(String(m.location_id)) ?? ""}` : ""}
                  {m.occurred_at ? ` · ${new Date(String(m.occurred_at)).toLocaleString()}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function ProductQuotationSection({
  form,
  setForm,
  readOnly,
}: {
  form: ProductFormState;
  setForm: (patch: Partial<ProductFormState>) => void;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-5">
      <SectionHead title="Quotation" subtitle="Control how this Product appears and behaves in customer quotations." />
      <Panel title="Availability">
        <ToggleRow label="Can be quoted" checked={form.can_be_quoted} onChange={(v) => setForm({ can_be_quoted: v })} disabled={readOnly} />
        <ToggleRow
          label="Requires technical confirmation"
          checked={form.requires_technical_confirmation}
          onChange={(v) => setForm({ requires_technical_confirmation: v })}
          disabled={readOnly}
        />
      </Panel>
      <Panel title="Customer presentation">
        <div className="space-y-4">
          <div>
            <FieldLabel>Customer-facing name</FieldLabel>
            <Input value={form.name} disabled={readOnly} onChange={(e) => setForm({ name: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Quotation description</FieldLabel>
            <TextArea
              rows={4}
              value={form.quotation_description}
              disabled={readOnly}
              onChange={(e) => setForm({ quotation_description: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>Warranty</FieldLabel>
            <Input value={form.warranty} disabled={readOnly} onChange={(e) => setForm({ warranty: e.target.value })} />
          </div>
        </div>
      </Panel>
      <Panel title="Commercial control">
        <ToggleRow
          label="Allow salesperson price override"
          checked={form.price_editable_on_quote}
          onChange={(v) => setForm({ price_editable_on_quote: v })}
          disabled={readOnly}
        />
        <ToggleRow
          label="Discount allowed"
          checked={form.discount_allowed}
          onChange={(v) => setForm({ discount_allowed: v })}
          disabled={readOnly}
        />
      </Panel>
    </div>
  );
}

export function ProductSpecsSection({
  form,
  setForm,
  readOnly,
}: {
  form: ProductFormState;
  setForm: (patch: Partial<ProductFormState>) => void;
  readOnly: boolean;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, SpecRow[]>();
    for (const row of form.specs) {
      const g = row.group.trim() || "General";
      map.set(g, [...(map.get(g) ?? []), row]);
    }
    return [...map.entries()];
  }, [form.specs]);

  function update(id: string, patch: Partial<SpecRow>) {
    setForm({ specs: form.specs.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }

  return (
    <div className="space-y-5">
      <SectionHead
        title="Specifications"
        subtitle="Technical information that can be used in quotations and approved Agent responses."
        action={
          readOnly ? null : (
            <Button
              size="md"
              onClick={() =>
                setForm({
                  specs: [...form.specs, { id: newRowId(), group: "General", name: "", value: "" }],
                })
              }
            >
              + Add specification
            </Button>
          )
        }
      />
      {grouped.length === 0 ? (
        <EmptyState title="No specifications" description="Add key/value technical fields for this Product. Groups are free-form." />
      ) : (
        grouped.map(([group, rows]) => (
          <Panel key={group} title={group.toUpperCase()}>
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-1 gap-2 md:grid-cols-[160px_1fr_1fr_auto]">
                  <Input value={row.group} disabled={readOnly} onChange={(e) => update(row.id, { group: e.target.value })} />
                  <Input value={row.name} disabled={readOnly} onChange={(e) => update(row.id, { name: e.target.value })} placeholder="Name" />
                  <Input value={row.value} disabled={readOnly} onChange={(e) => update(row.id, { value: e.target.value })} placeholder="Value" />
                  {readOnly ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ specs: form.specs.filter((s) => s.id !== row.id) })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}

export function ProductDocumentsSection({
  form,
  setForm,
  readOnly,
}: {
  form: ProductFormState;
  setForm: (patch: Partial<ProductFormState>) => void;
  readOnly: boolean;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("Datasheet");
  return (
    <div className="space-y-5">
      <SectionHead
        title="Documents"
        subtitle="Datasheets, warranties, brochures and technical files."
        action={
          readOnly ? null : (
            <Button
              size="md"
              disabled={!name.trim() || !url.trim()}
              onClick={() => {
                setForm({
                  documents: [
                    ...form.documents,
                    {
                      id: newRowId(),
                      name: name.trim(),
                      url: url.trim(),
                      category,
                      uploaded_at: new Date().toISOString(),
                    },
                  ],
                });
                setName("");
                setUrl("");
              }}
            >
              Upload
            </Button>
          )
        }
      />
      <Panel>
        <div className="mb-4">
          <FieldLabel>Product image URL</FieldLabel>
          <Input
            value={form.primary_image_url}
            disabled={readOnly}
            onChange={(e) => setForm({ primary_image_url: e.target.value })}
            placeholder="https://…"
          />
        </div>
        {form.documents.length === 0 ? (
          <p className="text-[13px] text-sales-text-muted">No documents yet.</p>
        ) : (
          <DataTable>
            <DataTableEl>
              <DataTableHead>
                <DataTableRow>
                  <DataTableTh>File</DataTableTh>
                  <DataTableTh>Category</DataTableTh>
                  <DataTableTh>Updated</DataTableTh>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {form.documents.map((d) => (
                  <DataTableRow key={d.id}>
                    <DataTableTd>
                      {d.url ? (
                        <a href={d.url} className="text-sales-brand-fg underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
                          {d.name}
                        </a>
                      ) : (
                        d.name
                      )}
                    </DataTableTd>
                    <DataTableTd>{d.category}</DataTableTd>
                    <DataTableTd>
                      {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : "—"}
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTableEl>
          </DataTable>
        )}
        {readOnly ? null : (
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="File name" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" />
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>Datasheet</option>
              <option>Warranty</option>
              <option>Technical</option>
              <option>Brochure</option>
              <option>Certificate</option>
            </Select>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function ProductActivitySection({
  clientId,
  productId,
}: {
  clientId: string;
  productId: string;
}) {
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    fetch(`/api/clients/${clientId}/products/${productId}/activity`)
      .then((r) => r.json())
      .then((j: { events?: Array<Record<string, unknown>> }) => setEvents(j.events ?? []))
      .catch(() => setEvents([]));
  }, [clientId, productId]);

  const groups = useMemo(() => {
    const map = new Map<string, Array<Record<string, unknown>>>();
    for (const e of events) {
      const d = e.created_at ? new Date(String(e.created_at)) : null;
      const key = d ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase() : "—";
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [events]);

  return (
    <div className="space-y-5">
      <SectionHead title="Activity" subtitle="Human-readable changes to this Product record." />
      {groups.length === 0 ? (
        <EmptyState title="No activity yet" description="Creates, price changes, status changes and package links will appear here." />
      ) : (
        groups.map(([day, rows]) => (
          <div key={day}>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">{day}</div>
            <ul className="space-y-4 border-l border-sales-border-subtle pl-4">
              {rows.map((e) => (
                <li key={String(e.id)}>
                  <div className="text-[11px] text-sales-text-muted">
                    {e.created_at ? new Date(String(e.created_at)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                  <div className="text-[13px] font-semibold text-sales-text-primary">{activityTitle(String(e.event_type))}</div>
                  <div className="text-[12px] text-sales-text-secondary">{activityDetail(e)}</div>
                  {e.actor_name ? <div className="mt-0.5 text-[12px] text-sales-text-muted">{String(e.actor_name)}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function activityTitle(type: string): string {
  if (type === "product.created") return "Product created";
  if (type === "product.price_changed") return "Selling price changed";
  if (type === "product.cost_changed") return "Cost price changed";
  if (type === "product.status_changed") return "Status changed";
  if (type === "product.archived") return "Product archived";
  if (type === "package.items_changed") return "Package contents changed";
  return type.replace(/[._]/g, " ");
}

function activityDetail(e: Record<string, unknown>): string {
  const data = (e.event_data ?? {}) as Record<string, unknown>;
  if (e.event_type === "product.price_changed") return `${data.old ?? "—"} → ${data.new ?? "—"}`;
  if (e.event_type === "product.status_changed") return `${data.old ?? "—"} → ${data.new ?? "—"}`;
  if (typeof data.name === "string") return data.name;
  return "";
}

