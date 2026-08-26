"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CommercialModulePage } from "./CommercialModulePage";
import { Button, useSalesToast } from "@/components/sales/ui";
import type { UserRole } from "@/types";
import { ProductDetailWorkspace, UnsavedChangesDialog } from "./product-detail/ProductDetailWorkspace";
import {
  emptyProductForm,
  formFromProduct,
  type CategoryOption,
  type ProductFormState,
  type ProductRecord,
  type ProductSectionId,
  type UnitOption,
} from "./product-detail/types";

const TABS: ProductSectionId[] = [
  "overview",
  "variants",
  "pricing",
  "inventory",
  "quotation",
  "specifications",
  "documents",
  "activity",
];

export function CompanyProductEditorPage({
  clientId,
  chrome,
  productId,
}: {
  clientId: string;
  chrome: {
    companyName: string;
    companyLogoUrl?: string | null;
    userName: string;
    avatarUrl?: string | null;
    unreadNotifications: number;
    notificationRole: UserRole;
    whatsappBadge?: number;
  };
  productId?: string;
}) {
  const router = useRouter();
  const { toast } = useSalesToast();
  const [form, setFormState] = useState<ProductFormState>(emptyProductForm);
  const [baseline, setBaseline] = useState(() => JSON.stringify(emptyProductForm()));
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(Boolean(productId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [section, setSection] = useState<ProductSectionId>("overview");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const setForm = useCallback((patch: Partial<ProductFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  }, []);

  const dirty = useMemo(() => JSON.stringify(form) !== baseline, [form, baseline]);

  useEffect(() => {
    if (!productId && (section === "variants" || section === "inventory" || section === "activity" || section === "documents" || section === "specifications")) {
      setSection("overview");
    }
    if (form.item_type === "SERVICE" && section === "inventory") setSection("overview");
  }, [form.item_type, productId, section]);

  const load = useCallback(() => {
    if (!productId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    fetch(`/api/clients/${clientId}/products/${productId}`)
      .then(async (r) => {
        const j = (await r.json()) as { product?: ProductRecord; error?: string };
        if (!r.ok || !j.product) throw new Error(j.error || "Not found");
        setProduct(j.product);
        const next = formFromProduct(j.product);
        setFormState(next);
        setBaseline(JSON.stringify(next));
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [clientId, productId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/clients/${clientId}/products/categories`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/products?units=1&limit=1`).then((r) => r.json()),
    ]).then(([cats, unitsJson]: [{ categories?: CategoryOption[] }, { units?: Array<{ code: string; name: string }> }]) => {
      setCategories(cats.categories ?? []);
      setUnits((unitsJson.units ?? []).map((u) => ({ code: u.code, name: u.name || u.code })));
    }).catch(() => undefined);
  }, [clientId]);

  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  function requestLeave(href: string) {
    if (dirty) {
      setPendingHref(href);
      setLeaveOpen(true);
      return;
    }
    router.push(href);
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Product name is required", tone: "error" });
      setSection("overview");
      return;
    }
    if (!form.sku.trim()) {
      setSkuError("SKU is required");
      setSection("overview");
      return;
    }
    if (!form.category_id && categories.length > 0) {
      toast({ title: "Category is required", tone: "error" });
      setSection("overview");
      return;
    }
    setSkuError(null);
    setSaving(true);
    try {
      const payload = {
        ...form,
        selling_price: Number(form.selling_price) || 0,
        tax_rate: form.tax_rate === "" ? null : Number(form.tax_rate),
        cost_price: form.cost_price === "" ? null : Number(form.cost_price),
        sku: form.sku.trim(),
        brand: form.brand.trim() || null,
        barcode: form.barcode.trim() || null,
        category_id: form.category_id || null,
        primary_image_url: form.primary_image_url.trim() || null,
      };
      const res = await fetch(
        productId ? `/api/clients/${clientId}/products/${productId}` : `/api/clients/${clientId}/products`,
        {
          method: productId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = (await res.json()) as { product?: { id: string }; error?: string };
      if (!res.ok) {
        if (res.status === 409 && /sku/i.test(json.error || "")) setSkuError(json.error || "SKU already exists");
        toast({ title: json.error || "Could not save", tone: "error" });
        return;
      }
      toast({ title: "Saved", tone: "success" });
      setBaseline(JSON.stringify(form));
      const id = json.product?.id ?? productId;
      if (!productId && id) {
        router.push(`/client/products/${id}`);
        return;
      }
      load();
    } finally {
      setSaving(false);
    }
  }

  const canSeeCost = !productId || product == null || product.cost_price !== undefined;
  const saveLabel = saving ? "Saving…" : productId ? "Save changes" : "Create product";

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb={`Company / Products / ${productId ? "Detail" : "New"}`}
      hideTitleBlock
      primaryAction={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={() => requestLeave("/client/products")}>
            Back
          </Button>
          <Button size="md" onClick={() => void save()} disabled={saving || Boolean(loadError) || (Boolean(productId) && !dirty)}>
            {saveLabel}
          </Button>
        </div>
      }
    >
      <div className="mt-4">
        <ProductDetailWorkspace
          clientId={clientId}
          productId={productId}
          product={product}
          form={form}
          setForm={setForm}
          categories={categories}
          units={units}
          section={TABS.includes(section) ? section : "overview"}
          onSection={setSection}
          loading={loading}
          loadError={loadError}
          skuError={skuError}
          readOnly={false}
          canSeeCost={canSeeCost}
          onReload={load}
          onRetry={load}
        />
      </div>
      <UnsavedChangesDialog
        open={leaveOpen}
        onStay={() => {
          setLeaveOpen(false);
          setPendingHref(null);
        }}
        onDiscard={() => {
          const href = pendingHref;
          setLeaveOpen(false);
          setPendingHref(null);
          setBaseline(JSON.stringify(form));
          if (href) router.push(href);
        }}
      />
    </CommercialModulePage>
  );
}
