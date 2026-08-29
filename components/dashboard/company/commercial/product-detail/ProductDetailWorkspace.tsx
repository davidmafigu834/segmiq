"use client";

import { useMemo, useState } from "react";
import {
  Box,
  ClipboardList,
  Copy,
  FileText,
  History,
  Layers,
  LayoutList,
  Paperclip,
  CircleDollarSign,
  Warehouse,
} from "lucide-react";
import { Button, IconButton, Skeleton, StatusDot } from "@/components/sales/ui";
import { formatMoney } from "@/lib/quotations/totals";
import { cn } from "@/lib/ui/cn";
import { ProductOverviewSection } from "./ProductOverviewSection";
import {
  ProductActivitySection,
  ProductDocumentsSection,
  ProductInventorySection,
  ProductPricingSection,
  ProductQuotationSection,
  ProductSpecsSection,
  ProductVariantsSection,
} from "./ProductSections";
import {
  formatQty,
  statusLabel,
  stockLabel,
  type CategoryOption,
  type ProductFormState,
  type ProductRecord,
  type ProductSectionId,
  type UnitOption,
} from "./types";

const SECTIONS: Array<{
  id: ProductSectionId;
  label: string;
  icon: typeof LayoutList;
}> = [
  { id: "overview", label: "Overview", icon: LayoutList },
  { id: "variants", label: "Variants", icon: Layers },
  { id: "pricing", label: "Pricing", icon: CircleDollarSign },
  { id: "inventory", label: "Inventory", icon: Warehouse },
  { id: "quotation", label: "Quotation", icon: FileText },
  { id: "specifications", label: "Specifications", icon: ClipboardList },
  { id: "documents", label: "Documents", icon: Paperclip },
  { id: "activity", label: "Activity", icon: History },
];

export function ProductDetailWorkspace({
  clientId,
  productId,
  product,
  form,
  setForm,
  categories,
  units,
  section,
  onSection,
  loading,
  loadError,
  skuError,
  readOnly,
  canSeeCost,
  onReload,
  onRetry,
}: {
  clientId: string;
  productId?: string;
  product: ProductRecord | null;
  form: ProductFormState;
  setForm: (patch: Partial<ProductFormState>) => void;
  categories: CategoryOption[];
  units: UnitOption[];
  section: ProductSectionId;
  onSection: (id: ProductSectionId) => void;
  loading: boolean;
  loadError: string | null;
  skuError: string | null;
  readOnly: boolean;
  canSeeCost: boolean;
  onReload: () => void;
  onRetry: () => void;
}) {
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isNew = !productId;
  const unit = form.unit || "Each";
  const categoryName = useMemo(() => {
    if (product?.category?.name) return product.category.name;
    return categories.find((c) => c.id === form.category_id)?.name ?? "";
  }, [product?.category?.name, categories, form.category_id]);
  const meta = [categoryName, form.brand.trim()].filter(Boolean).join(" · ");
  const visibleSections = SECTIONS.filter((s) => {
    if (isNew && (s.id === "variants" || s.id === "inventory" || s.id === "activity" || s.id === "documents" || s.id === "specifications")) {
      return false;
    }
    if (s.id === "inventory" && form.item_type === "SERVICE") return false;
    return true;
  });
  const stock =
    form.item_type === "SERVICE" || !form.track_inventory
      ? "NOT_TRACKED"
      : (product?.inventory?.status ?? "NOT_TRACKED");

  if (loadError) {
    return (
      <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface px-5 py-10 text-center">
        <p className="text-[15px] font-semibold text-sales-text-primary">This Product could not be loaded.</p>
        <p className="mt-1 text-[13px] text-sales-text-secondary">{loadError}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" size="md" onClick={onRetry}>
            Retry
          </Button>
          <Button variant="secondary" size="md" onClick={() => (window.location.href = "/client/products")}>
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
      {loading ? (
        <IdentitySkeleton />
      ) : (
        <div className="grid gap-5 border-b border-sales-border-subtle p-4 sm:p-5 lg:grid-cols-[132px_minmax(0,1.15fr)_minmax(240px,0.95fr)] lg:items-start">
          <div className="relative mx-auto flex h-[132px] w-[132px] items-center justify-center overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface-subtle lg:mx-0">
            {form.primary_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.primary_image_url} alt="" className="h-full w-full object-contain" />
            ) : (
              <Box size={36} strokeWidth={1.5} className="text-sales-text-muted" />
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-sales-text-primary sm:text-[30px]">
              {form.name.trim() || (isNew ? "New Product" : "Product")}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-sales-text-secondary">
              <span>SKU: {form.sku.trim() || "—"}</span>
              {form.sku.trim() ? (
                <IconButton
                  size="sm"
                  aria-label={copied ? "Copied" : "Copy SKU"}
                  className="h-7 w-7 min-h-7 min-w-7"
                  onClick={() => {
                    void navigator.clipboard.writeText(form.sku).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1200);
                    });
                  }}
                >
                  <Copy size={14} />
                </IconButton>
              ) : null}
            </div>
            {meta ? <p className="mt-1 text-[13px] text-sales-text-muted">{meta}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sales-border bg-sales-surface-subtle px-2.5 py-1 text-[12px] font-medium text-sales-text-primary">
                <StatusDot tone={form.status === "ACTIVE" ? "brand" : form.status === "ARCHIVED" ? "neutral" : "warning"} size={6} />
                {statusLabel(form.status)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sales-border bg-sales-surface-subtle px-2.5 py-1 text-[12px] font-medium text-sales-text-secondary">
                <Warehouse size={13} strokeWidth={1.8} />
                {stockLabel(stock)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-sales-border bg-sales-border">
            <SummaryCell label="Selling price" value={`${formatMoney(Number(form.selling_price) || 0, form.currency)} / ${unit}`} />
            {isNew || !form.track_inventory || form.item_type === "SERVICE" ? (
              <SummaryCell label="Inventory" value="Not tracked" />
            ) : (
              <SummaryCell
                label="Reserved quantity"
                value={formatQty(product?.inventory?.reserved, unit)}
                tone="warning"
              />
            )}
            {isNew || !form.track_inventory || form.item_type === "SERVICE" ? (
              <SummaryCell label="Available quantity" value="—" />
            ) : (
              <SummaryCell
                label="Available quantity"
                value={formatQty(product?.inventory?.available, unit)}
                tone="brand"
              />
            )}
            {isNew || !form.track_inventory || form.item_type === "SERVICE" ? (
              <SummaryCell label="On-hand quantity" value="—" />
            ) : (
              <SummaryCell label="On-hand quantity" value={formatQty(product?.inventory?.onHand, unit)} />
            )}
            <button
              type="button"
              className="col-span-2 bg-sales-surface px-3.5 py-2.5 text-left disabled:cursor-default"
              disabled={!product?.packageCount}
              onClick={() => product?.packageCount && setPackagesOpen(true)}
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">Used in</div>
              <div className={cn("mt-0.5 text-[15px] font-semibold", product?.packageCount ? "text-sales-brand-fg" : "text-sales-text-primary")}>
                {isNew ? "—" : `${product?.packageCount ?? 0} package${product?.packageCount === 1 ? "" : "s"}`}
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="grid min-h-[520px] lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto border-b border-sales-border-subtle p-2 lg:sticky lg:top-0 lg:flex-col lg:overflow-x-visible lg:border-b-0 lg:border-r lg:p-3">
          {visibleSections.map((s) => {
            const active = section === s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSection(s.id)}
                className={cn(
                  "relative flex min-h-10 shrink-0 items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[13px] transition-colors",
                  active
                    ? "bg-sales-brand-soft font-medium text-sales-text-primary"
                    : "font-medium text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
                )}
              >
                {active ? (
                  <span className="absolute bottom-2 left-0 top-2 hidden w-[3px] rounded-full bg-sales-brand lg:block" />
                ) : null}
                <Icon size={16} strokeWidth={1.8} className="shrink-0" />
                {s.label}
              </button>
            );
          })}
        </nav>
        <div className="min-w-0 p-4 sm:p-6">
          {section === "overview" ? (
            <ProductOverviewSection
              form={form}
              setForm={setForm}
              categories={categories}
              units={units}
              skuError={skuError}
              isNew={isNew}
              readOnly={readOnly}
            />
          ) : null}
          {section === "variants" && product ? (
            <ProductVariantsSection clientId={clientId} product={product} onReload={onReload} readOnly={readOnly} />
          ) : null}
          {section === "pricing" ? (
            <ProductPricingSection form={form} setForm={setForm} canSeeCost={canSeeCost} readOnly={readOnly} />
          ) : null}
          {section === "inventory" ? (
            <ProductInventorySection
              clientId={clientId}
              product={product}
              form={form}
              readOnly={readOnly}
              onReload={onReload}
            />
          ) : null}
          {section === "quotation" ? (
            <ProductQuotationSection form={form} setForm={setForm} readOnly={readOnly} />
          ) : null}
          {section === "specifications" ? (
            <ProductSpecsSection form={form} setForm={setForm} readOnly={readOnly} />
          ) : null}
          {section === "documents" ? (
            <ProductDocumentsSection form={form} setForm={setForm} readOnly={readOnly} />
          ) : null}
          {section === "activity" && productId ? (
            <ProductActivitySection clientId={clientId} productId={productId} />
          ) : null}
        </div>
      </div>

      {packagesOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setPackagesOpen(false)}>
          <div
            className="w-full max-w-md workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-4 shadow-sales-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-semibold">Used in packages</h3>
            <ul className="mt-3 space-y-1">
              {(product?.usedInPackages ?? []).map((pkg) => (
                <li key={pkg.id}>
                  <a href={`/client/packages/${pkg.id}`} className="block rounded-[8px] px-3 py-2 text-[13px] hover:bg-sales-surface-hover">
                    {pkg.name}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" size="md" onClick={() => setPackagesOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brand" | "warning";
}) {
  return (
    <div className="bg-sales-surface px-3.5 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-sales-text-muted">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-[15px] font-semibold tabular-nums",
          tone === "brand" ? "text-sales-brand-fg" : tone === "warning" ? "text-sales-warning-fg" : "text-sales-text-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function IdentitySkeleton() {
  return (
    <div className="grid gap-5 border-b border-sales-border-subtle p-5 lg:grid-cols-[132px_1fr_1fr]">
      <Skeleton className="h-[132px] w-[132px] rounded-[12px]" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-28 w-full rounded-[12px]" />
    </div>
  );
}

export function UnsavedChangesDialog({
  open,
  onDiscard,
  onStay,
}: {
  open: boolean;
  onDiscard: () => void;
  onStay: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-sm workspace-card rounded-[14px] border border-sales-border bg-sales-surface p-5 shadow-sales-popover">
        <p className="text-[15px] font-semibold text-sales-text-primary">You have unsaved changes.</p>
        <p className="mt-1 text-[13px] text-sales-text-secondary">Discard changes or continue editing this Product.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onDiscard}>
            Discard changes
          </Button>
          <Button size="md" onClick={onStay}>
            Continue editing
          </Button>
        </div>
      </div>
    </div>
  );
}
