"use client";

import { Field, Input, Select, Switch, TextArea } from "@/components/sales/ui";
import type { CategoryOption, ProductFormState, UnitOption } from "./types";

export function ProductOverviewSection({
  form,
  setForm,
  categories,
  units,
  skuError,
  isNew,
  readOnly,
}: {
  form: ProductFormState;
  setForm: (patch: Partial<ProductFormState>) => void;
  categories: CategoryOption[];
  units: UnitOption[];
  skuError: string | null;
  isNew: boolean;
  readOnly: boolean;
}) {
  const isService = form.item_type === "SERVICE";
  return (
    <div>
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-sales-text-primary">Overview</h2>
        <p className="mt-1 text-[13px] text-sales-text-secondary">
          Manage the core information used across sales, inventory and quotations.
        </p>
      </div>

      {isNew ? (
        <p className="mt-5 text-[13px] text-sales-text-secondary">
          Choose Product or Service first. Inventory tracking is only available for Products.
        </p>
      ) : null}

      <section className="mt-5 rounded-[12px] border border-sales-border bg-sales-surface p-4 sm:p-5">
        <h3 className="text-[13px] font-semibold text-sales-text-primary">Basic information</h3>
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-3">
          <Field label="Product name" required>
            <Input
              value={form.name}
              disabled={readOnly}
              onChange={(e) => setForm({ name: e.target.value })}
              placeholder="Product name"
            />
          </Field>
          <Field label="Product type" required>
            <Select
              value={form.item_type}
              disabled={readOnly}
              onChange={(e) => {
                const item_type = e.target.value === "SERVICE" ? "SERVICE" : "PRODUCT";
                setForm({
                  item_type,
                  track_inventory: item_type === "SERVICE" ? false : form.track_inventory,
                });
              }}
            >
              <option value="PRODUCT">Product</option>
              <option value="SERVICE">Service</option>
            </Select>
          </Field>
          <Field label="Category" required>
            <Select
              value={form.category_id}
              disabled={readOnly}
              onChange={(e) => setForm({ category_id: e.target.value })}
            >
              <option value="">Select category</option>
              {categories
                .filter((c) => c.status === "ACTIVE" || c.id === form.category_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>

          <Field label="SKU" required error={skuError ?? undefined}>
            <Input
              value={form.sku}
              disabled={readOnly}
              invalid={Boolean(skuError)}
              onChange={(e) => setForm({ sku: e.target.value })}
              placeholder="SKU"
            />
          </Field>
          <Field label="Brand">
            <Input
              value={form.brand}
              disabled={readOnly}
              onChange={(e) => setForm({ brand: e.target.value })}
              placeholder="Brand"
            />
          </Field>
          <Field label="Barcode">
            <Input
              value={form.barcode}
              disabled={readOnly}
              onChange={(e) => setForm({ barcode: e.target.value })}
              placeholder="Enter barcode (optional)"
            />
          </Field>

          <Field label="Unit" required>
            <Select value={form.unit} disabled={readOnly} onChange={(e) => setForm({ unit: e.target.value })}>
              {(units.length ? units : [{ code: "Each", name: "Each" }]).map((u) => (
                <option key={u.code} value={u.code}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="hidden md:block" />
          <div className="hidden md:block" />

          <Field label="Description" className="md:col-span-3">
            <TextArea
              rows={5}
              value={form.description}
              disabled={readOnly}
              onChange={(e) => setForm({ description: e.target.value })}
              placeholder="Internal description"
            />
          </Field>

          <Field label="Status" required>
            <Select value={form.status} disabled={readOnly} onChange={(e) => setForm({ status: e.target.value })}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </Field>
          <Field label="Track inventory">
            <div className="flex h-11 items-center gap-3 sm:h-10">
              <Switch
                checked={form.track_inventory && !isService}
                disabled={readOnly || isService}
                onCheckedChange={(v) => setForm({ track_inventory: v })}
                aria-label="Track inventory"
              />
              <span className="text-[13px] font-medium text-sales-text-primary">
                {form.track_inventory && !isService ? "Yes" : "No"}
              </span>
            </div>
          </Field>
        </div>
      </section>
    </div>
  );
}
