"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CommercialModulePage } from "./CommercialModulePage";
import { Button, FieldLabel, Input, Select, Switch, TextArea, useSalesToast } from "@/components/sales/ui";
import type { UserRole } from "@/types";

const UNITS = ["Each", "Pair", "Set", "Box", "Pack", "Roll", "Metre", "m²", "Kilogram", "Litre", "Hour", "Day", "Month", "Service"];

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
  const [itemType, setItemType] = useState<"PRODUCT" | "SERVICE">("PRODUCT");
  const [form, setForm] = useState({
    name: "",
    sku: "",
    brand: "",
    unit: "Each",
    selling_price: "",
    currency: "USD",
    tax_rate: "",
    cost_price: "",
    description: "",
    quotation_description: "",
    warranty: "",
    track_inventory: false,
    allow_fractional_qty: false,
    can_be_quoted: true,
    status: "ACTIVE",
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("overview");
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/clients/${clientId}/products/${productId}`)
      .then((r) => r.json())
      .then((j: { product?: Record<string, unknown> }) => {
        const p = j.product;
        if (!p) return;
        setProduct(p);
        setItemType(p.item_type === "SERVICE" ? "SERVICE" : "PRODUCT");
        setForm({
          name: String(p.name ?? ""),
          sku: String(p.sku ?? ""),
          brand: String(p.brand ?? ""),
          unit: String(p.unit ?? "Each"),
          selling_price: String(p.selling_price ?? ""),
          currency: String(p.currency ?? "USD"),
          tax_rate: p.tax_rate == null ? "" : String(p.tax_rate),
          cost_price: p.cost_price == null ? "" : String(p.cost_price),
          description: String(p.description ?? ""),
          quotation_description: String(p.quotation_description ?? ""),
          warranty: String(p.warranty ?? ""),
          track_inventory: Boolean(p.track_inventory),
          allow_fractional_qty: Boolean(p.allow_fractional_qty),
          can_be_quoted: p.can_be_quoted !== false,
          status: String(p.status ?? "ACTIVE"),
        });
      });
  }, [clientId, productId]);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        item_type: itemType,
        selling_price: Number(form.selling_price) || 0,
        tax_rate: form.tax_rate === "" ? null : Number(form.tax_rate),
        cost_price: form.cost_price === "" ? null : Number(form.cost_price),
        sku: form.sku || null,
        brand: form.brand || null,
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
        toast({ title: json.error || "Could not save", tone: "error" });
        return;
      }
      toast({ title: "Saved", tone: "success" });
      router.push(`/client/products/${json.product?.id ?? productId}`);
    } finally {
      setSaving(false);
    }
  }

  const title = productId ? String(product?.name ?? "Product") : "New Product";

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb={`Company / Products / ${productId ? "Detail" : "New"}`}
      title={title}
      description={productId ? `SKU: ${form.sku || "—"}` : "Product: physical item, may track stock. Service: work, no stock."}
      primaryAction={
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={() => router.push("/client/products")}>
            Back
          </Button>
          <Button size="md" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="mt-4 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="flex flex-col gap-1 text-[13px]">
          {["overview", "pricing", itemType === "PRODUCT" ? "inventory" : null, "quotation"].filter(Boolean).map((id) => (
            <button
              key={id as string}
              type="button"
              className={`rounded-[8px] px-3 py-2 text-left ${tab === id ? "bg-sales-surface-subtle font-medium" : "text-sales-text-secondary"}`}
              onClick={() => setTab(id as string)}
            >
              {id === "overview" ? "Overview" : id === "pricing" ? "Pricing" : id === "inventory" ? "Inventory" : "Quotation"}
            </button>
          ))}
        </nav>
        <div className="max-w-xl space-y-4">
          {tab === "overview" ? (
            <>
              {!productId ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={itemType === "PRODUCT" ? "primary" : "secondary"} size="md" onClick={() => setItemType("PRODUCT")}>
                    Product
                  </Button>
                  <Button variant={itemType === "SERVICE" ? "primary" : "secondary"} size="md" onClick={() => setItemType("SERVICE")}>
                    Service
                  </Button>
                </div>
              ) : null}
              <div>
                <FieldLabel>Name</FieldLabel>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>SKU</FieldLabel>
                  <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>Brand</FieldLabel>
                  <Input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
                </div>
              </div>
              <div>
                <FieldLabel>Unit</FieldLabel>
                <Select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel>Description</FieldLabel>
                <TextArea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </div>
            </>
          ) : null}
          {tab === "pricing" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Selling price</FieldLabel>
                  <Input value={form.selling_price} onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
                </div>
              </div>
              <div>
                <FieldLabel>Tax %</FieldLabel>
                <Input value={form.tax_rate} onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>Cost price</FieldLabel>
                <Input value={form.cost_price} onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))} />
              </div>
            </>
          ) : null}
          {tab === "inventory" && itemType === "PRODUCT" ? (
            <>
              <label className="flex items-center justify-between gap-3 text-[13px]">
                Track inventory
                <Switch checked={form.track_inventory} onCheckedChange={(v) => setForm((f) => ({ ...f, track_inventory: v }))} />
              </label>
              <label className="flex items-center justify-between gap-3 text-[13px]">
                Allow fractional quantity
                <Switch checked={form.allow_fractional_qty} onCheckedChange={(v) => setForm((f) => ({ ...f, allow_fractional_qty: v }))} />
              </label>
              {form.track_inventory && productId ? (
                <InventorySummary balances={(product?.balances as Array<Record<string, unknown>>) ?? []} />
              ) : null}
              {productId ? <VariantsEditor clientId={clientId} productId={productId} variants={(product?.variants as Array<Record<string, unknown>>) ?? []} /> : null}
            </>
          ) : null}
          {tab === "quotation" ? (
            <>
              <div>
                <FieldLabel>Quotation description</FieldLabel>
                <TextArea
                  value={form.quotation_description}
                  onChange={(e) => setForm((f) => ({ ...f, quotation_description: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel>Warranty</FieldLabel>
                <Input value={form.warranty} onChange={(e) => setForm((f) => ({ ...f, warranty: e.target.value }))} />
              </div>
              <label className="flex items-center justify-between gap-3 text-[13px]">
                Can be quoted
                <Switch checked={form.can_be_quoted} onCheckedChange={(v) => setForm((f) => ({ ...f, can_be_quoted: v }))} />
              </label>
            </>
          ) : null}
        </div>
      </div>
    </CommercialModulePage>
  );
}

function InventorySummary({
  balances,
}: {
  balances: Array<Record<string, unknown>>;
}) {
  const onHand = balances.reduce((s, b) => s + (Number(b.on_hand) || 0), 0);
  const reserved = balances.reduce((s, b) => s + (Number(b.reserved) || 0), 0);
  const available = onHand - reserved;
  const reorder = balances
    .map((b) => (b.reorder_level == null ? null : Number(b.reorder_level)))
    .filter((n): n is number => n != null);
  return (
    <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
      {[
        ["On hand", onHand],
        ["Reserved", reserved],
        ["Available", available],
        ["Reorder", reorder.length ? Math.min(...reorder) : "—"],
      ].map(([label, value]) => (
        <div key={String(label)} className="rounded-[8px] border border-sales-border px-3 py-2">
          <div className="text-[11px] uppercase text-sales-text-muted">{label}</div>
          <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  );
}

function VariantsEditor({
  clientId,
  productId,
  variants,
}: {
  clientId: string;
  productId: string;
  variants: Array<Record<string, unknown>>;
}) {
  const { toast } = useSalesToast();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  async function add() {
    const res = await fetch(`/api/clients/${clientId}/products/${productId}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sku: sku || null }),
    });
    if (!res.ok) {
      toast({ title: "Could not add variant", tone: "error" });
      return;
    }
    setName("");
    setSku("");
    toast({ title: "Variant added", tone: "success" });
  }
  return (
    <div className="space-y-2">
      <h3 className="text-[13px] font-semibold">Variants</h3>
      {variants.map((v) => (
        <div key={String(v.id)} className="flex items-center justify-between rounded-[8px] border border-sales-border px-3 py-2 text-[13px]">
          <span>{String(v.name)}</span>
          <span className="text-sales-text-muted">{String(v.sku ?? "—")}</span>
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Variant name" />
        <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />
        <Button size="md" variant="secondary" disabled={!name.trim()} onClick={() => void add()}>
          Add
        </Button>
      </div>
    </div>
  );
}
