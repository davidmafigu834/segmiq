"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  MoreHorizontal,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  MessageCircle,
  AlertCircle,
  Loader2,
  Calendar,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Skeleton,
  useSalesToast,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import {
  computeQuotationTotals,
  formatMoneyCompact,
  sectionSubtotal,
  type QuoteTotals,
} from "@/lib/quotations/totals";
import {
  runCommercialCheck,
} from "@/lib/quotations/commercial-check";
import {
  evaluateGovernance,
  marginHealthLabel,
} from "@/lib/quotations/governance";
import { evaluateApprovalRequirement } from "@/lib/quotations/approval-engine";
import {
  LIFECYCLE_LABELS,
  resolveLifecycleIndex,
  quotationStatusLabel,
  approvalStatusLabel,
  daysUntil,
  isQuotationEditable,
  type QuotationLifecycleStage,
} from "@/lib/quotations/lifecycle";
import { quotationEventLabel } from "@/lib/quotations/events";
import { QUOTE_UNITS } from "@/lib/quotations/units";
import { expandPackageToLineItems } from "@/lib/quotations/packages";
import { formatQuoteIdentity, getQuoteStatusTone } from "@/lib/sales/quotes";
import type {
  CatalogItemRow,
  QuotationLineItemInput,
  QuotationLineItemRow,
  QuotationNoteBlock,
  QuotationOfferOption,
  QuotationSectionDef,
  QuotationStatus,
  QuotationTimelineMilestone,
} from "@/types";
import type { QuotationWorkspacePayload } from "@/lib/quotations/workspace-data";

function getQuoteStatusToneSafe(status: string) {
  return getQuoteStatusTone(status as QuotationStatus);
}

const FIELD =
  "w-full rounded-sales-md border border-sales-border-strong bg-sales-surface px-3 py-2 text-[13px] text-sales-text-primary outline-none focus:border-sales-brand disabled:opacity-70";

type TabId = "overview" | "items" | "options" | "payment" | "timeline" | "activity";

type EditorItem = QuotationLineItemInput & { key: string };

type SaveState = "idle" | "saving" | "saved" | "error";

let keySeq = 0;
function nextKey() {
  keySeq += 1;
  return `row-${keySeq}`;
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
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
    section_id: it.section_id ?? null,
    unit: it.unit ?? "Each",
    sku: it.sku ?? null,
    discount_percent: Number(it.discount_percent) || 0,
    discount_amount: Number(it.discount_amount) || 0,
    tax_rate: it.tax_rate ?? null,
    tax_inclusive: Boolean(it.tax_inclusive),
    is_optional: Boolean(it.is_optional),
    option_group: it.option_group ?? null,
    cost_price: it.cost_price ?? null,
    image_url: it.image_url ?? null,
  }));
}

function ensureDefaultSections(
  sections: QuotationSectionDef[] | undefined,
  items: EditorItem[]
): QuotationSectionDef[] {
  if (sections && sections.length > 0) return [...sections].sort((a, b) => a.sort_order - b.sort_order);
  const labels: string[] = [];
  for (const it of items) {
    const label = (it.group_label ?? "").trim() || "Items";
    if (!labels.includes(label)) labels.push(label);
  }
  if (labels.length === 0) labels.push("Items");
  return labels.map((title, idx) => ({ id: newId("sec"), title, sort_order: idx }));
}

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "items", label: "Items" },
  { id: "options", label: "Options" },
  { id: "payment", label: "Payment & Terms" },
  { id: "timeline", label: "Timeline" },
  { id: "activity", label: "Activity" },
];

type Props = {
  quotationId: string;
  initial?: QuotationWorkspacePayload | null;
};

export function QuotationWorkspace({ quotationId, initial }: Props) {
  const router = useRouter();
  const { toast } = useSalesToast();
  const [payload, setPayload] = useState<QuotationWorkspacePayload | null>(initial ?? null);
  const [loading, setLoading] = useState(!initial);
  const [tab, setTab] = useState<TabId>("items");
  const [items, setItems] = useState<EditorItem[]>([]);
  const [sections, setSections] = useState<QuotationSectionDef[]>([]);
  const [noteBlocks, setNoteBlocks] = useState<QuotationNoteBlock[]>([]);
  const [milestones, setMilestones] = useState<QuotationTimelineMilestone[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [validUntil, setValidUntil] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [otherAmount, setOtherAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [commercialNotes, setCommercialNotes] = useState("");
  const [offerOptions, setOfferOptions] = useState<QuotationOfferOption[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [packages, setPackages] = useState<Array<{ id: string; name: string; description: string | null; pricing_model: string; flexibility: string; fixed_price: number | null; discount_percent: number; components: Array<Record<string, unknown>> }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<{ sectionId: string } | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItemRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const skipFirstSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = payload?.quotation;
  const approvalPending = q?.approval_status === "pending";
  const readOnly = q ? !isQuotationEditable(q.status) || approvalPending : true;
  const clientId = q?.client_id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/workspace`);
      const json = (await res.json()) as QuotationWorkspacePayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setPayload(json);
      hydrate(json);
    } catch (e) {
      toast({
        tone: "error",
        title: "Couldn't load quotation",
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [quotationId, toast]);

  function hydrate(data: QuotationWorkspacePayload) {
    const quote = data.quotation;
    const editorItems = toEditorItems(quote.items);
    const secs = ensureDefaultSections(quote.sections, editorItems);
    const withSections = editorItems.map((it) => {
      if (it.section_id && secs.some((s) => s.id === it.section_id)) return it;
      const byTitle = secs.find(
        (s) => s.title.toLowerCase() === (it.group_label || "Items").toLowerCase()
      );
      return { ...it, section_id: byTitle?.id ?? secs[0]?.id ?? null };
    });
    setItems(withSections);
    setSections(secs);
    setNoteBlocks(quote.note_blocks ?? []);
    setMilestones(quote.timeline_milestones ?? []);
    setCurrency(quote.currency || data.settings?.default_currency || "USD");
    setValidUntil(quote.valid_until ?? "");
    setPaymentTerms(quote.payment_terms_label ?? data.settings?.default_payment_terms ?? "");
    setTaxRate(Number(quote.tax_rate) || Number(data.settings?.default_tax_rate) || 0);
    setOtherAmount(Number(quote.other_amount) || 0);
    setDiscountPercent(Number(quote.discount_percent) || 0);
    setTerms(quote.terms ?? "");
    setNotes(quote.notes ?? "");
    setDeliveryTerms(quote.delivery_terms ?? "");
    setWarrantyTerms(quote.warranty_terms ?? "");
    setCommercialNotes(quote.commercial_notes ?? "");
    setOfferOptions(quote.offer_options ?? []);
    setSavedAt(quote.updated_at ? new Date(quote.updated_at) : null);
    dirtyRef.current = false;
    skipFirstSave.current = true;
  }

  useEffect(() => {
    if (initial) {
      hydrate(initial);
      setLoading(false);
    } else {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/clients/${clientId}/catalog`)
      .then((r) => r.json())
      .then((j: { items?: CatalogItemRow[] }) => setCatalog(j.items ?? []))
      .catch(() => setCatalog([]));
    fetch(`/api/clients/${clientId}/quotation-packages`)
      .then((r) => r.json())
      .then((j: { packages?: typeof packages }) => setPackages(j.packages ?? []))
      .catch(() => setPackages([]));
  }, [clientId]);

  const totals: QuoteTotals = useMemo(
    () =>
      computeQuotationTotals(items, {
        fallbackTaxRate: taxRate,
        otherAmount,
        discountPercent,
      }),
    [items, taxRate, otherAmount, discountPercent]
  );

  const governance = useMemo(
    () =>
      evaluateGovernance({
        items,
        totals,
        settings: payload?.settings,
        role: payload?.permissions.canApprove ? "CLIENT_MANAGER" : "SALESPERSON",
        paymentTermsLabel: paymentTerms,
        defaultPaymentTerms: payload?.settings?.default_payment_terms,
      }),
    [items, totals, payload, paymentTerms]
  );

  const approvalEval = useMemo(
    () =>
      evaluateApprovalRequirement({
        items,
        totals,
        settings: payload?.settings ?? null,
        policies: payload?.policies ?? [],
        role: payload?.permissions.canApprove ? "CLIENT_MANAGER" : "SALESPERSON",
        paymentTermsLabel: paymentTerms,
      }),
    [items, totals, payload, paymentTerms]
  );

  const commercial = useMemo(
    () =>
      runCommercialCheck({
        status: q?.status ?? "draft",
        approvalStatus: q?.approval_status ?? (approvalEval.required ? "required" : "not_required"),
        customerName: payload?.customer.name,
        dealId: payload?.deal?.id ?? q?.deal_id,
        currency,
        validUntil,
        paymentTermsLabel: paymentTerms,
        items,
        totals,
        governance,
        approval: approvalEval,
      }),
    [q, payload, currency, validUntil, paymentTerms, items, totals, governance, approvalEval]
  );

  const persist = useCallback(async () => {
    if (readOnly || !q) return;
    setSaveState("saving");
    try {
      const body = {
        customer_name: payload?.customer.name ?? q.customer_name,
        customer_phone: payload?.customer.phone ?? q.customer_phone,
        customer_email: payload?.customer.email ?? q.customer_email,
        valid_until: validUntil || null,
        notes: notes || null,
        terms: terms || null,
        tax_rate: taxRate,
        other_amount: otherAmount,
        discount_percent: discountPercent,
        currency,
        payment_terms_label: paymentTerms || null,
        delivery_terms: deliveryTerms || null,
        warranty_terms: warrantyTerms || null,
        commercial_notes: commercialNotes || null,
        sections,
        note_blocks: noteBlocks,
        timeline_milestones: milestones,
        offer_options: offerOptions,
        expected_updated_at: q.updated_at,
        items: items.map((it) => {
          const { key, ...rest } = it;
          void key;
          return rest;
        }),
        silent: true,
      };
      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { quotation?: QuotationWorkspacePayload["quotation"]; error?: string };
      if (!res.ok) throw new Error(json.error || "Save failed");
      dirtyRef.current = false;
      setSaveState("saved");
      setSavedAt(new Date());
      if (json.quotation && payload) {
        setPayload({ ...payload, quotation: { ...payload.quotation, ...json.quotation } });
      }
    } catch (e) {
      setSaveState("error");
      console.error("[quotation autosave]", e);
    }
  }, [
    readOnly,
    q,
    payload,
    validUntil,
    notes,
    terms,
    taxRate,
    otherAmount,
    discountPercent,
    currency,
    paymentTerms,
    deliveryTerms,
    warrantyTerms,
    commercialNotes,
    offerOptions,
    sections,
    noteBlocks,
    milestones,
    items,
    quotationId,
  ]);

  const markDirty = useCallback(() => {
    if (readOnly) return;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist();
    }, 900);
  }, [readOnly, persist]);

  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    items,
    sections,
    noteBlocks,
    milestones,
    currency,
    validUntil,
    paymentTerms,
    taxRate,
    otherAmount,
    discountPercent,
    terms,
    notes,
    deliveryTerms,
    warrantyTerms,
    commercialNotes,
    offerOptions,
  ]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const quoteNumberLabel = formatQuoteIdentity(q?.quote_number);
  const versionLabel = `Version ${q?.revision_number ?? 1}`;
  const statusLabel = quotationStatusLabel(q?.status ?? "draft");
  const sendBlocked = !commercial.canSend && !commercial.approvalRequired;
  const needsRequestApproval =
    commercial.approvalRequired &&
    q?.approval_status !== "approved" &&
    q?.approval_status !== "pending";
  const sendHelper =
    approvalPending
      ? "Waiting for commercial approval"
      : needsRequestApproval
        ? "Request approval before sending"
        : sendBlocked && commercial.blockingCount > 0
          ? commercial.items.find((c) => c.status === "block")?.action ?? "Complete commercial check"
          : undefined;

  function onPrimaryCta() {
    if (needsRequestApproval) {
      setApprovalOpen(true);
      return;
    }
    if (approvalPending) {
      toast({ tone: "warning", title: "Approval pending", description: "This quotation cannot be sent yet." });
      return;
    }
    if (!commercial.canSend) {
      setTab("items");
      setRailOpen(true);
      toast({
        tone: "warning",
        title: "Complete commercial check",
        description: sendHelper,
      });
      return;
    }
    setSendOpen(true);
  }

  const primaryCtaLabel = approvalPending
    ? "Approval pending"
    : needsRequestApproval
      ? "Request approval"
      : sendBlocked
        ? "Complete quotation"
        : "Send quotation";

  async function revise() {
    setBusy("revise");
    try {
      const res = await fetch(`/api/quotations/${quotationId}/revise`, { method: "POST" });
      const json = (await res.json()) as { quotation?: { id: string }; error?: string };
      if (!res.ok || !json.quotation) throw new Error(json.error || "Failed");
      toast({ tone: "success", title: "Revision created" });
      router.push(`/sales/quotes/${json.quotation.id}`);
    } catch (e) {
      toast({ tone: "error", title: "Couldn't create revision", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  }

  async function duplicate() {
    setBusy("duplicate");
    try {
      const res = await fetch(`/api/quotations/${quotationId}/duplicate`, { method: "POST" });
      const json = (await res.json()) as { quotation?: { id: string }; error?: string };
      if (!res.ok || !json.quotation) throw new Error(json.error || "Failed");
      toast({ tone: "success", title: "Quotation duplicated" });
      router.push(`/sales/quotes/${json.quotation.id}`);
    } catch {
      toast({ tone: "error", title: "Couldn't duplicate" });
    } finally {
      setBusy(null);
      setMoreOpen(false);
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    try {
      const res = await fetch(`/api/quotations/${quotationId}/pdf`);
      if (!res.ok) throw new Error("fail");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${q?.quote_number || "quotation"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ tone: "error", title: "Couldn't download PDF" });
    } finally {
      setBusy(null);
    }
  }

  async function preview() {
    if (q?.public_token) {
      window.open(`/quote/${q.public_token}`, "_blank");
      return;
    }
    await downloadPdf();
  }

  async function deleteDraft() {
    if (!confirm("Delete this draft quotation?")) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/quotations/${quotationId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("fail");
      toast({ tone: "success", title: "Draft deleted" });
      router.push("/sales/quotes");
    } catch {
      toast({ tone: "error", title: "Couldn't delete draft" });
    } finally {
      setBusy(null);
    }
  }

  function addSection() {
    const id = newId("sec");
    setSections((prev) => [
      ...prev,
      { id, title: `Section ${prev.length + 1}`, sort_order: prev.length },
    ]);
    setCollapsed((c) => ({ ...c, [id]: false }));
  }

  function moveSection(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex((s) => s.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= sorted.length) return prev;
      const next = [...sorted];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((s, i) => ({ ...s, sort_order: i }));
    });
  }

  function addNoteBlock() {
    setNoteBlocks((prev) => [
      ...prev,
      {
        id: newId("note"),
        title: "Note",
        body: "",
        sort_order: prev.length,
      },
    ]);
  }

  function addCustomItem(sectionId: string, optional = false) {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        catalog_item_id: null,
        item_name: "",
        description: "",
        unit_price: 0,
        quantity: 1,
        section_id: sectionId,
        unit: "Each",
        discount_percent: 0,
        discount_amount: 0,
        is_optional: optional,
      },
    ]);
  }

  function addPackage(sectionId: string, pkg: {
    id: string;
    name: string;
    description: string | null;
    pricing_model?: string;
    flexibility?: string;
    fixed_price?: number | null;
    discount_percent?: number;
    components?: Array<Record<string, unknown>>;
  }) {
    const comps = (pkg.components ?? []).map((c) => ({
      catalog_item_id: (c.catalog_item_id as string | null) ?? null,
      item_name: String(c.item_name ?? ""),
      description: (c.description as string | null) ?? null,
      quantity: Number(c.quantity) || 1,
      unit: String(c.unit ?? "Each"),
      unit_price: Number(c.unit_price) || 0,
      cost_price: c.cost_price != null ? Number(c.cost_price) : null,
      sku: (c.sku as string | null) ?? null,
      is_optional: Boolean(c.is_optional),
    }));
    const lines = expandPackageToLineItems({
      packageId: pkg.id,
      packageName: pkg.name,
      pricingModel: pkg.pricing_model || "component_total",
      flexibility: pkg.flexibility || "flexible",
      fixedPrice: pkg.fixed_price ?? null,
      discountPercent: Number(pkg.discount_percent) || 0,
      components: comps,
      sectionId,
    });
    setItems((prev) => [
      ...prev,
      ...lines.map((it) => ({ ...it, key: nextKey(), is_optional: tab === "options" ? true : it.is_optional })),
    ]);
    setPickerOpen(null);
  }

  function addCatalogItem(sectionId: string, cat: CatalogItemRow, optional = false) {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        catalog_item_id: cat.id,
        item_name: cat.name,
        description: cat.description ?? "",
        unit_price: Number(cat.unit_price) || 0,
        quantity: 1,
        section_id: sectionId,
        unit: cat.unit || "Each",
        sku: cat.sku ?? null,
        cost_price: cat.cost_price ?? null,
        tax_rate: cat.tax_rate ?? null,
        image_url: cat.image_url ?? null,
        catalog_unit_price: Number(cat.unit_price) || 0,
        price_override: false,
        discount_percent: 0,
        discount_amount: 0,
        is_optional: optional,
      },
    ]);
    setPickerOpen(null);
  }

  function updateItem(key: string, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  const baseItems = items.filter((it) => !it.is_optional);
  const optionItems = items.filter((it) => it.is_optional);

  const daysLeft = daysUntil(validUntil);

  const autoSaveLabel = (() => {
    if (saveState === "saving") return "Saving...";
    if (saveState === "error") return "Changes not saved";
    if (saveState === "saved" || savedAt) {
      if (!savedAt) return "Saved";
      const mins = Math.max(0, Math.round((Date.now() - savedAt.getTime()) / 60000));
      if (mins < 1) return "Saved";
      return `Auto-saved ${mins}m ago`;
    }
    return "";
  })();

  if (loading && !payload) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-16 w-full rounded-sales-md" />
        <Skeleton className="h-10 w-full rounded-sales-md" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Skeleton className="h-[480px] rounded-sales-md" />
          <Skeleton className="h-[480px] rounded-sales-md" />
        </div>
      </div>
    );
  }

  if (!payload || !q) {
    return (
      <div className="rounded-sales-md border border-sales-border bg-sales-surface p-8 text-center">
        <p className="text-[15px] font-semibold text-sales-text-primary">Quotation not found</p>
        <Button className="mt-4" variant="secondary" onClick={() => router.push("/sales/quotes")}>
          Back to quotations
        </Button>
      </div>
    );
  }

  const lifecycle = resolveLifecycleIndex(q.status, {
    hasViewTracking: Boolean(q.viewed_at || q.status === "viewed"),
  });

  return (
    <div className="relative flex flex-col pb-16">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-sales-border pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[18px] font-semibold tracking-tight text-sales-text-primary sm:text-[20px]">
              Quotation {quoteNumberLabel}
            </h1>
            <span className="inline-flex items-center rounded-full bg-sales-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-sales-text-secondary">
              {statusLabel}
            </span>
            <span className="inline-flex items-center rounded-full bg-[var(--sales-brand-soft-solid)] px-2.5 py-0.5 text-[11px] font-semibold text-sales-brand-text">
              {versionLabel}
            </span>
            {q.approval_status && q.approval_status !== "not_required" ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  q.approval_status === "approved" && "bg-sales-success-soft text-sales-success",
                  q.approval_status === "pending" && "bg-sales-warning-soft text-sales-warning",
                  q.approval_status === "changes_requested" && "bg-sales-warning-soft text-sales-warning",
                  q.approval_status === "rejected" && "bg-sales-danger-soft text-sales-danger",
                  q.approval_status === "required" && "bg-sales-warning-soft text-sales-warning"
                )}
              >
                {approvalStatusLabel(q.approval_status)}
              </span>
            ) : null}
          </div>
          {approvalPending ? (
            <p className="mt-2 rounded-sales-sm border border-sales-warning/30 bg-sales-warning-soft px-3 py-2 text-[12.5px] text-sales-text-secondary">
              Commercial changes are locked while approval is pending. Create a revision or wait for the decision.
            </p>
          ) : null}
          <p className="mt-1 text-[12.5px] text-sales-text-muted">
            Build the commercial offer attached to the Deal.
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-sales-text-secondary">
            {payload.deal ? (
              <Link
                href={`/sales/deals/${payload.deal.id}`}
                className="font-medium text-sales-text-primary hover:underline"
              >
                Deal: {payload.deal.title}
              </Link>
            ) : (
              <span className="text-sales-danger">No Deal linked</span>
            )}
            <span className="text-sales-border-strong">·</span>
            <span className="inline-flex items-center gap-1">
              Customer:{" "}
              <Link
                href={`/sales/leads?leadId=${payload.customer.leadId}`}
                className="font-medium text-sales-text-primary hover:underline"
              >
                {payload.customer.name}
              </Link>
              {payload.customer.hasWhatsApp ? (
                <MessageCircle className="h-3.5 w-3.5 text-[var(--sales-whatsapp)]" aria-label="WhatsApp" />
              ) : null}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<MoreHorizontal className="h-3.5 w-3.5" />}
              onClick={() => setMoreOpen((o) => !o)}
            >
              More actions
            </Button>
            {moreOpen ? (
              <div className="absolute right-0 z-30 mt-1 w-52 rounded-sales-md border border-sales-border bg-sales-surface py-1 shadow-sales-card">
                <MoreItem label="Duplicate quotation" onClick={() => void duplicate()} />
                {readOnly ? (
                  <MoreItem label="Create revision" onClick={() => void revise()} />
                ) : null}
                <MoreItem label="View version history" onClick={() => { setHistoryOpen(true); setMoreOpen(false); }} />
                {payload.permissions.canDeleteDraft ? (
                  <MoreItem label="Delete draft" danger onClick={() => void deleteDraft()} />
                ) : null}
              </div>
            ) : null}
          </div>
          <Button variant="secondary" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => void preview()} loading={busy === "pdf"}>
            Preview
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => void downloadPdf()} loading={busy === "pdf"}>
            Download PDF
          </Button>
          <div className="hidden flex-col items-end sm:flex">
            <Button
              size="sm"
              leftIcon={needsRequestApproval ? <ShieldCheck className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              onClick={onPrimaryCta}
              disabled={q.status === "accepted" || q.status === "superseded" || approvalPending}
              title={sendHelper}
            >
              {primaryCtaLabel}
            </Button>
            {sendHelper ? (
              <span className="mt-1 max-w-[220px] text-right text-[11px] text-sales-text-muted">
                {sendHelper}
              </span>
            ) : null}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="lg:hidden"
            onClick={() => setRailOpen(true)}
          >
            Summary
          </Button>
        </div>
      </div>

      {/* Tabs + autosave */}
      <div className="mt-1 flex items-end justify-between gap-3 border-b border-sales-border">
        <div className="flex min-w-0 flex-1 gap-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                tab === t.id
                  ? "border-sales-brand text-sales-text-primary"
                  : "border-transparent text-sales-text-secondary hover:text-sales-text-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 pb-2.5 text-[12px] text-sales-text-muted sm:flex">
          {saveState === "error" ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-sales-danger" />
              <button type="button" className="text-sales-danger underline" onClick={() => void persist()}>
                {autoSaveLabel} · Retry
              </button>
            </>
          ) : saveState === "saving" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{autoSaveLabel}</span>
            </>
          ) : autoSaveLabel ? (
            <>
              <Check className="h-3.5 w-3.5 text-sales-success" />
              <span>{autoSaveLabel}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
        <div className="min-w-0 space-y-3">
          {tab === "overview" ? (
            <OverviewTab
              totals={totals}
              currency={currency}
              paymentTerms={paymentTerms}
              validUntil={validUntil}
              status={q.status}
              version={q.revision_number}
              offerOptions={offerOptions}
              readOnly={readOnly}
              onChangeOptions={(next) => setOfferOptions(next)}
            />
          ) : null}

          {tab === "items" ? (
            <ItemsTab
              readOnly={readOnly}
              currency={currency}
              validUntil={validUntil}
              paymentTerms={paymentTerms}
              taxRate={taxRate}
              sections={sections}
              items={baseItems}
              noteBlocks={noteBlocks}
              collapsed={collapsed}
              totals={totals}
              onEditDetails={() => setDetailsOpen(true)}
              onToggleSection={(id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
              onRenameSection={(id, title) =>
                setSections((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)))
              }
              onRemoveSection={(id) => {
                const hasItems = items.some((it) => it.section_id === id && !it.is_optional);
                if (hasItems) {
                  toast({ tone: "warning", title: "Remove or move items first" });
                  return;
                }
                setSections((prev) => prev.filter((s) => s.id !== id));
              }}
              onAddItem={(sectionId) => setPickerOpen({ sectionId })}
              onAddCustom={(sectionId) => addCustomItem(sectionId)}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
              onMoveSection={moveSection}
              onAddSection={addSection}
              onAddNote={addNoteBlock}
              onUpdateNote={(id, patch) =>
                setNoteBlocks((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)))
              }
              onRemoveNote={(id) => setNoteBlocks((prev) => prev.filter((n) => n.id !== id))}
            />
          ) : null}

          {tab === "options" ? (
            <OptionsTab
              readOnly={readOnly}
              currency={currency}
              items={optionItems}
              sections={sections}
              onAdd={() => {
                const sid = sections[0]?.id ?? newId("sec");
                if (!sections.length) {
                  setSections([{ id: sid, title: "Options", sort_order: 0 }]);
                }
                addCustomItem(sid, true);
              }}
              onPickCatalog={() => {
                const sid = sections[0]?.id ?? newId("sec");
                if (!sections.length) setSections([{ id: sid, title: "Options", sort_order: 0 }]);
                setPickerOpen({ sectionId: sid });
              }}
              onUpdateItem={updateItem}
              onRemoveItem={removeItem}
              onMakeMandatory={(key) => updateItem(key, { is_optional: false })}
            />
          ) : null}

          {tab === "payment" ? (
            <PaymentTab
              readOnly={readOnly}
              paymentTerms={paymentTerms}
              setPaymentTerms={setPaymentTerms}
              validUntil={validUntil}
              setValidUntil={setValidUntil}
              terms={terms}
              setTerms={setTerms}
              deliveryTerms={deliveryTerms}
              setDeliveryTerms={setDeliveryTerms}
              warrantyTerms={warrantyTerms}
              setWarrantyTerms={setWarrantyTerms}
              commercialNotes={commercialNotes}
              setCommercialNotes={setCommercialNotes}
              discountPercent={discountPercent}
              setDiscountPercent={setDiscountPercent}
              otherAmount={otherAmount}
              setOtherAmount={setOtherAmount}
              taxRate={taxRate}
              setTaxRate={setTaxRate}
              currency={currency}
            />
          ) : null}

          {tab === "timeline" ? (
            <TimelineTab
              readOnly={readOnly}
              milestones={milestones}
              onChange={setMilestones}
            />
          ) : null}

          {tab === "activity" ? (
            <ActivityTab events={payload.events} />
          ) : null}
        </div>

        {/* Commercial rail — desktop */}
        <aside className="hidden lg:block lg:sticky lg:top-4 lg:self-start">
            <CommercialRail
              payload={payload}
              totals={totals}
              currency={currency}
              validUntil={validUntil}
              daysLeft={daysLeft}
              commercial={commercial}
              governance={governance}
              onNavigateTab={(t) => setTab(t)}
              onOpenSend={onPrimaryCta}
              onViewHistory={() => setHistoryOpen(true)}
              onCall={() => {
                if (payload.customer.phone) window.open(`tel:${payload.customer.phone}`);
              }}
              onFollowUp={() => {
                router.push(`/sales/tasks?leadId=${payload.customer.leadId}`);
              }}
            />
        </aside>
      </div>

      {/* Lifecycle strip */}
      <div className="mt-4">
        <LifecycleStrip
          stages={lifecycle.stages}
          activeIndex={lifecycle.activeIndex}
          terminal={lifecycle.terminal}
          status={q.status}
        />
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sales-border bg-sales-surface p-3 sm:hidden">
        <Button
          className="w-full"
          leftIcon={needsRequestApproval ? <ShieldCheck className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          onClick={onPrimaryCta}
          disabled={approvalPending}
        >
          {primaryCtaLabel}
        </Button>
      </div>

      {/* Mobile rail sheet */}
      {railOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/30" onClick={() => setRailOpen(false)} aria-label="Close" />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-sales-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-semibold">Commercial summary</p>
              <button type="button" onClick={() => setRailOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <CommercialRail
              payload={payload}
              totals={totals}
              currency={currency}
              validUntil={validUntil}
              daysLeft={daysLeft}
              commercial={commercial}
              governance={governance}
              onNavigateTab={(t) => {
                setTab(t);
                setRailOpen(false);
              }}
              onOpenSend={() => {
                setRailOpen(false);
                onPrimaryCta();
              }}
              onViewHistory={() => setHistoryOpen(true)}
              onCall={() => {
                if (payload.customer.phone) window.open(`tel:${payload.customer.phone}`);
              }}
              onFollowUp={() => router.push(`/sales/tasks?leadId=${payload.customer.leadId}`)}
            />
          </div>
        </div>
      ) : null}

      {detailsOpen ? (
        <DetailsModal
          currency={currency}
          setCurrency={setCurrency}
          validUntil={validUntil}
          setValidUntil={setValidUntil}
          paymentTerms={paymentTerms}
          setPaymentTerms={setPaymentTerms}
          supported={payload.settings?.supported_currencies ?? ["USD", "ZiG", "ZAR", "BWP"]}
          onClose={() => setDetailsOpen(false)}
          readOnly={readOnly}
        />
      ) : null}

      {pickerOpen ? (
        <ProductPicker
          catalog={catalog}
          packages={packages}
          onClose={() => setPickerOpen(null)}
          onSelect={(cat) => {
            const optional = tab === "options";
            addCatalogItem(pickerOpen.sectionId, cat, optional);
          }}
          onSelectPackage={(pkg) => addPackage(pickerOpen.sectionId, pkg)}
          onCustom={() => {
            addCustomItem(pickerOpen.sectionId, tab === "options");
            setPickerOpen(null);
          }}
        />
      ) : null}

      {sendOpen ? (
        <SendModal
          quoteNumber={quoteNumberLabel}
          version={q.revision_number}
          customer={payload.customer.name}
          total={formatMoneyCompact(totals.total, currency)}
          validUntil={validUntil}
          hasWhatsApp={payload.customer.hasWhatsApp}
          publicToken={q.public_token}
          commercial={commercial}
          approvalStatus={q.approval_status}
          dealId={payload.deal?.id ?? q.deal_id}
          leadId={payload.customer.leadId}
          onClose={() => setSendOpen(false)}
          onSent={() => {
            toast({ tone: "success", title: "Quotation sent" });
            void load();
          }}
          quotationId={quotationId}
        />
      ) : null}

      {approvalOpen && payload && q ? (
        <ApprovalRequestModal
          payload={payload}
          totals={totals}
          currency={currency}
          governance={governance}
          reasons={approvalEval.reasons}
          quotationId={quotationId}
          onClose={() => setApprovalOpen(false)}
          onSubmitted={() => {
            setApprovalOpen(false);
            toast({ tone: "success", title: "Submitted for approval" });
            void load();
          }}
        />
      ) : null}

      {historyOpen ? (
        <HistoryModal versions={payload.versions} onClose={() => setHistoryOpen(false)} currency={currency} />
      ) : null}
    </div>
  );
}

function MoreItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block w-full px-3 py-2 text-left text-[13px] hover:bg-sales-surface-hover",
        danger ? "text-sales-danger" : "text-sales-text-primary"
      )}
    >
      {label}
    </button>
  );
}

function RailCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-sales-md border border-sales-border bg-sales-surface">
      <div className="flex items-center justify-between border-b border-sales-border px-3.5 py-2.5">
        <p className="text-[13px] font-semibold text-sales-text-primary">{title}</p>
        {action}
      </div>
      <div className="px-3.5 py-3">{children}</div>
    </div>
  );
}

function CommercialRail({
  payload,
  totals,
  currency,
  validUntil,
  daysLeft,
  commercial,
  governance,
  onNavigateTab,
  onOpenSend,
  onViewHistory,
  onCall,
  onFollowUp,
}: {
  payload: QuotationWorkspacePayload;
  totals: QuoteTotals;
  currency: string;
  validUntil: string;
  daysLeft: number | null;
  commercial: ReturnType<typeof runCommercialCheck>;
  governance: ReturnType<typeof evaluateGovernance>;
  onNavigateTab: (tab: TabId) => void;
  onOpenSend: () => void;
  onViewHistory: () => void;
  onCall: () => void;
  onFollowUp: () => void;
}) {
  const q = payload.quotation;
  const status = q.status;
  const nba = nextBestAction(payload, commercial);

  return (
    <div className="space-y-3">
      <RailCard
        title="Quotation Summary"
        action={
          <Badge tone={getQuoteStatusToneSafe(status)}>
            {quotationStatusLabel(status)}
          </Badge>
        }
      >
        <p className="text-[12px] text-sales-text-muted">Grand total ({currency})</p>
        <p className="mt-0.5 text-[26px] font-bold tracking-tight text-sales-text-primary">
          {formatMoneyCompact(totals.total, currency)}
        </p>
        <div className="mt-3 space-y-1.5 text-[12.5px]">
          <Row label="Subtotal" value={formatMoneyCompact(totals.subtotal, currency)} />
          <Row
            label="Discount"
            value={
              totals.discountTotal > 0
                ? `−${formatMoneyCompact(totals.discountTotal, currency)}`
                : formatMoneyCompact(0, currency)
            }
          />
          <Row label={`Tax (${Number(q.tax_rate) || 0}%)`} value={formatMoneyCompact(totals.taxAmount, currency)} />
          <div className="my-2 border-t border-sales-border" />
          <Row label="Grand total" value={formatMoneyCompact(totals.total, currency)} bold />
        </div>
      </RailCard>

      <RailCard title="Commercial Overview">
        <div className="space-y-2.5 text-[12.5px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sales-text-secondary">Version</span>
            <span className="inline-flex items-center gap-2 font-medium">
              {q.revision_number}
              <button type="button" className="text-[12px] font-semibold text-sales-text-secondary underline" onClick={onViewHistory}>
                View history
              </button>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sales-text-secondary">Valid until</span>
            <span
              className={cn(
                "font-medium",
                daysLeft != null && daysLeft <= 14 ? "text-amber-700 dark:text-amber-400" : "text-sales-text-primary"
              )}
            >
              {validUntil
                ? `${formatDisplayDate(validUntil)}${daysLeft != null ? ` (${daysLeft} days left)` : ""}`
                : "Not set"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sales-text-secondary">Discount</span>
            <span className="font-medium">{totals.effectiveDiscountPercent}%</span>
          </div>
          {payload.permissions.canSeeCost && totals.costTotal != null ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sales-text-secondary">Estimated cost</span>
              <span className="font-medium">{formatMoneyCompact(totals.costTotal, currency)}</span>
            </div>
          ) : null}
          {payload.permissions.canSeeCost && totals.costTotal != null ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sales-text-secondary">Gross profit</span>
              <span className="font-medium">{formatMoneyCompact(totals.total - totals.costTotal, currency)}</span>
            </div>
          ) : null}
          {payload.permissions.canSeeMargin && totals.marginPercent != null ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sales-text-secondary">Margin</span>
              <span className="font-medium">{totals.marginPercent}%</span>
            </div>
          ) : null}
          {payload.permissions.canSeeMarginHealth ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sales-text-secondary">Margin health</span>
              <span className="font-medium">{marginHealthLabel(governance.marginHealth)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sales-text-secondary">Pricing authority</span>
            <span className="font-medium">
              {governance.pricingAuthority === "within_authority" ? "Within authority" : "Approval required"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sales-text-secondary">Last activity</span>
            <span className="font-medium">
              {payload.events[0]?.created_at
                ? formatDisplayDate(payload.events[0].created_at)
                : formatDisplayDate(q.updated_at)}
            </span>
          </div>
        </div>
      </RailCard>

      {(payload.quotation.approval_status && payload.quotation.approval_status !== "not_required") ||
      commercial.approvalRequired ? (
        <RailCard title="Approval">
          <div className="space-y-1.5 text-[12.5px]">
            <Row
              label="Status"
              value={approvalStatusLabel(payload.quotation.approval_status ?? (commercial.approvalRequired ? "required" : "not_required"))}
            />
            {payload.quotation.approval_note ? (
              <p className="text-[12px] text-sales-text-secondary">{payload.quotation.approval_note}</p>
            ) : null}
          </div>
        </RailCard>
      ) : null}

      {payload.quotation.sent_at ? (
        <RailCard title="Customer Engagement">
          <div className="space-y-1.5 text-[12.5px]">
            <Row label="Sent" value={formatDisplayDate(payload.quotation.sent_at)} />
            <Row
              label="First viewed"
              value={payload.quotation.viewed_at ? formatDisplayDate(payload.quotation.viewed_at) : "Not viewed"}
            />
            <Row label="Views" value={String(payload.quotation.view_count ?? (payload.quotation.viewed_at ? 1 : 0))} />
            <Row
              label="Last viewed"
              value={
                payload.quotation.last_viewed_at
                  ? formatDisplayDate(payload.quotation.last_viewed_at)
                  : payload.quotation.viewed_at
                    ? formatDisplayDate(payload.quotation.viewed_at)
                    : "—"
              }
            />
            <Row
              label="Response"
              value={
                payload.quotation.customer_response_type ||
                (payload.quotation.status === "accepted"
                  ? "Accepted"
                  : payload.quotation.status === "rejected"
                    ? "Declined"
                    : "None")
              }
            />
          </div>
        </RailCard>
      ) : null}

      <RailCard title="Linked Records">
        <div className="space-y-2 text-[12.5px]">
          <LinkRow label="Customer" value={payload.customer.name} href={`/sales/leads?leadId=${payload.customer.leadId}`} />
          <LinkRow
            label="Deal"
            value={payload.deal?.title ?? "No Deal linked"}
            href={payload.deal ? `/sales/deals/${payload.deal.id}` : undefined}
          />
          <div className="flex justify-between gap-2">
            <span className="text-sales-text-secondary">Owner</span>
            <span className="font-medium text-sales-text-primary">{payload.owner.name}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-sales-text-secondary">Created</span>
            <span className="text-sales-text-primary">{formatDisplayDate(q.created_at)}</span>
          </div>
          {payload.companyName ? (
            <div className="flex justify-between gap-2">
              <span className="text-sales-text-secondary">Company</span>
              <span className="text-right font-medium text-sales-text-primary">{payload.companyName}</span>
            </div>
          ) : null}
        </div>
      </RailCard>

      <RailCard title="Next Best Action">
        <p className="text-[14px] font-semibold text-sales-text-primary">{nba.title}</p>
        {nba.detail ? (
          <p className="mt-1 text-[12px] text-sales-text-secondary">{nba.detail}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {nba.goTab ? (
            <Button size="sm" onClick={() => onNavigateTab(nba.goTab!)}>
              {nba.title}
            </Button>
          ) : null}
          {nba.send ? (
            <Button size="sm" leftIcon={<Send className="h-3.5 w-3.5" />} onClick={onOpenSend}>
              Send quotation
            </Button>
          ) : null}
          {nba.actions.map((a) => (
            <Button
              key={a.label}
              size="sm"
              variant={a.primary ? "primary" : "secondary"}
              leftIcon={a.icon === "phone" ? <Phone className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
              onClick={a.icon === "phone" ? onCall : onFollowUp}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </RailCard>

      <div className="rounded-sales-md border border-sales-border bg-sales-surface px-3.5 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-sales-text-primary">Commercial Check</p>
          <p className="text-[11px] text-sales-text-muted">
            {commercial.readyCount} of {commercial.totalCount} ready
          </p>
        </div>
        <ul className="space-y-1.5">
          {commercial.items.map((c) => {
            const clickable = c.status !== "pass" && c.tab;
            const row = (
              <span className="flex min-w-0 flex-1 items-start gap-1.5">
                <span
                  className={cn(
                    "mt-0.5 shrink-0 text-[12px]",
                    c.status === "pass" && "text-sales-success",
                    c.status === "warn" && "text-amber-600 dark:text-amber-400",
                    c.status === "block" && "text-sales-danger"
                  )}
                  aria-hidden
                >
                  {c.status === "pass" ? "✓" : c.status === "warn" ? "⚠" : "✕"}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "text-[12px]",
                      c.status === "pass" ? "text-sales-text-secondary" : "font-medium text-sales-text-primary"
                    )}
                  >
                    {c.status === "pass" ? c.label : c.action || c.label}
                  </span>
                </span>
              </span>
            );
            return (
              <li key={c.id}>
                {clickable ? (
                  <button
                    type="button"
                    className="flex w-full rounded-sales-sm px-0.5 py-0.5 text-left hover:bg-sales-surface-hover"
                    onClick={() => onNavigateTab(c.tab as TabId)}
                  >
                    {row}
                  </button>
                ) : (
                  <div className="flex px-0.5 py-0.5">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
        {commercial.blockingCount > 0 ? (
          <p className="mt-2 text-[11px] font-medium text-sales-danger">
            {commercial.blockingCount} item{commercial.blockingCount === 1 ? "" : "s"} need attention
          </p>
        ) : commercial.approvalRequired ? (
          <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">Approval required</p>
        ) : (
          <p className="mt-2 text-[11px] font-medium text-sales-success">Ready to send</p>
        )}
      </div>
    </div>
  );
}

function nextBestAction(
  payload: QuotationWorkspacePayload,
  commercial: ReturnType<typeof runCommercialCheck>
): {
  title: string;
  detail?: string;
  actions: { label: string; icon: "phone" | "calendar"; primary?: boolean }[];
  goTab?: TabId;
  send?: boolean;
} {
  const q = payload.quotation;
  const blocker = commercial.items.find((c) => c.status === "block");

  if (q.approval_status === "pending") {
    return { title: "Waiting for approval", detail: "Commercial exception is under review", actions: [] };
  }
  if (q.approval_status === "changes_requested") {
    return { title: "Update quotation and resubmit", detail: q.approval_note || "Manager requested changes", actions: [], goTab: "items" };
  }
  if (q.approval_status === "rejected") {
    return { title: "Revise quotation", detail: q.approval_note || "Approval was rejected", actions: [], goTab: "items" };
  }
  if (q.status === "draft" || q.status === "approved") {
    if (commercial.approvalRequired && q.approval_status !== "approved") {
      return { title: "Request commercial approval", detail: "This offer is outside current authority", actions: [] };
    }
    if (!payload.deal?.id) {
      return { title: "Link quotation to Deal", detail: "Quotations belong to a Deal", actions: [], goTab: "overview" };
    }
    if (blocker?.id === "items") {
      return { title: "Add products or services", actions: [], goTab: "items" };
    }
    if (blocker?.id === "payment") {
      return { title: "Add payment terms", actions: [], goTab: "payment" };
    }
    if (blocker?.id === "validity") {
      return { title: "Set validity date", actions: [], goTab: "payment" };
    }
    if (blocker) {
      return { title: blocker.action || blocker.label, actions: [], goTab: (blocker.tab as TabId) || "items" };
    }
    return { title: "Send quotation", detail: "Commercial check complete", actions: [], send: true };
  }
  if (q.status === "sent" || q.status === "viewed") {
    const sentAgo = q.sent_at ? relativeDays(q.sent_at) : null;
    const viewed = q.viewed_at ? `Viewed ${relativeDays(q.viewed_at)}` : null;
    return {
      title: "Schedule follow-up",
      detail: [sentAgo ? `Quotation sent ${sentAgo}` : null, viewed].filter(Boolean).join(" · ") || undefined,
      actions: [
        { label: "Call customer", icon: "phone" },
        { label: "Schedule follow-up", icon: "calendar", primary: true },
      ],
    };
  }
  if (q.status === "accepted") {
    return {
      title: "Continue the Deal",
      detail: "Quotation accepted — Deal is not automatically Won",
      actions: [{ label: "Open Deal", icon: "calendar", primary: true }],
    };
  }
  if (q.status === "rejected") {
    return {
      title: "Review Deal",
      detail: "Customer declined this quotation",
      actions: [{ label: "Schedule follow-up", icon: "calendar", primary: true }],
    };
  }
  return { title: "Review quotation", actions: [] };
}

function relativeDays(iso: string): string {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

function formatDisplayDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-2", bold && "font-semibold")}>
      <span className="text-sales-text-secondary">{label}</span>
      <span className="text-sales-text-primary">{value}</span>
    </div>
  );
}

function LinkRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-sales-text-secondary">{label}</span>
      {href ? (
        <Link href={href} className="text-right font-medium text-blue-600 hover:underline">
          {value}
        </Link>
      ) : (
        <span className="text-right font-medium">{value}</span>
      )}
    </div>
  );
}

function LifecycleStrip({
  stages,
  activeIndex,
  terminal,
  status,
}: {
  stages: readonly QuotationLifecycleStage[];
  activeIndex: number;
  terminal?: string;
  status: string;
}) {
  if (terminal) {
    return (
      <div className="mt-4 rounded-sales-md border border-sales-border bg-sales-surface px-3 py-2.5">
        <p className="text-center text-[12.5px] font-medium text-sales-text-secondary">
          Status: {quotationStatusLabel(status)}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 hidden overflow-x-auto rounded-sales-md border border-sales-border bg-sales-surface px-2 py-2 sm:block">
      <div className="flex min-w-max items-center gap-1">
        {stages.map((stage, idx) => {
          const done = idx < activeIndex;
          const active = idx === activeIndex;
          const label =
            stage in LIFECYCLE_LABELS
              ? LIFECYCLE_LABELS[stage as QuotationLifecycleStage]
              : stage;
          return (
            <div
              key={stage}
              className={cn(
                "flex items-center gap-1.5 rounded-sales-sm px-2.5 py-1.5 text-[11.5px] font-medium",
                active && "bg-[var(--sales-brand-soft-solid)] text-sales-brand-text",
                done && !active && "text-sales-text-secondary",
                !done && !active && "text-sales-text-muted"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                  active && "bg-sales-brand text-sales-brand-text",
                  done && !active && "bg-sales-neutral-200 text-sales-text-secondary",
                  !done && !active && "bg-sales-neutral-100 text-sales-text-muted"
                )}
              >
                {done ? <Check className="h-3 w-3" /> : active ? <ShieldCheck className="h-3 w-3" /> : idx + 1}
              </span>
              {label}
              {active && stage === "draft" ? (
                <span className="text-[10px] font-normal text-sales-text-muted">(You)</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Tabs ---------- */

function OverviewTab({
  totals,
  currency,
  paymentTerms,
  validUntil,
  status,
  version,
  offerOptions,
  readOnly,
  onChangeOptions,
}: {
  totals: QuoteTotals;
  currency: string;
  paymentTerms: string;
  validUntil: string;
  status: string;
  version: number;
  offerOptions: QuotationOfferOption[];
  readOnly: boolean;
  onChangeOptions: (next: QuotationOfferOption[]) => void;
}) {
  function enableOptions() {
    onChangeOptions([
      { id: "essential", label: "Essential", description: "" },
      { id: "recommended", label: "Recommended", description: "", is_recommended: true },
      { id: "premium", label: "Premium", description: "" },
    ]);
  }
  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-sales-md border border-sales-border bg-sales-surface p-4">
        <h2 className="text-[15px] font-semibold">Commercial summary</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Meta label="Status" value={quotationStatusLabel(status)} />
          <Meta label="Version" value={String(version)} />
          <Meta label="Total" value={formatMoneyCompact(totals.total, currency)} />
          <Meta label="Currency" value={currency} />
          <Meta label="Valid until" value={validUntil ? formatDisplayDate(validUntil) : "—"} />
          <Meta label="Payment terms" value={paymentTerms || "—"} />
          <Meta label="Effective discount" value={`${totals.effectiveDiscountPercent}%`} />
        </div>
      </div>
      <div className="space-y-3 rounded-sales-md border border-sales-border bg-sales-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Commercial alternatives</h2>
            <p className="mt-0.5 text-[12.5px] text-sales-text-secondary">
              Optional Good / Better / Best choices for the customer. Not required on every quotation.
            </p>
          </div>
          {offerOptions.length === 0 && !readOnly ? (
            <Button size="sm" variant="secondary" onClick={enableOptions}>
              Add options
            </Button>
          ) : null}
        </div>
        {offerOptions.length === 0 ? (
          <p className="text-[12.5px] text-sales-text-muted">This quotation uses a single commercial offer.</p>
        ) : (
          <ul className="space-y-2">
            {offerOptions.map((opt, idx) => (
              <li key={opt.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                <input
                  className={FIELD}
                  disabled={readOnly}
                  value={opt.label}
                  onChange={(e) =>
                    onChangeOptions(offerOptions.map((o, i) => (i === idx ? { ...o, label: e.target.value } : o)))
                  }
                />
                <input
                  className={FIELD}
                  disabled={readOnly}
                  placeholder="What this option includes"
                  value={opt.description ?? ""}
                  onChange={(e) =>
                    onChangeOptions(
                      offerOptions.map((o, i) => (i === idx ? { ...o, description: e.target.value } : o))
                    )
                  }
                />
                {!readOnly ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onChangeOptions(offerOptions.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-sales-text-muted">{label}</p>
      <p className="mt-0.5 text-[13.5px] font-medium text-sales-text-primary">{value}</p>
    </div>
  );
}

function ItemsTab(props: {
  readOnly: boolean;
  currency: string;
  validUntil: string;
  paymentTerms: string;
  taxRate: number;
  sections: QuotationSectionDef[];
  items: EditorItem[];
  noteBlocks: QuotationNoteBlock[];
  collapsed: Record<string, boolean>;
  totals: QuoteTotals;
  onEditDetails: () => void;
  onToggleSection: (id: string) => void;
  onRenameSection: (id: string, title: string) => void;
  onRemoveSection: (id: string) => void;
  onMoveSection?: (id: string, dir: -1 | 1) => void;
  onAddItem: (sectionId: string) => void;
  onAddCustom: (sectionId: string) => void;
  onUpdateItem: (key: string, patch: Partial<EditorItem>) => void;
  onRemoveItem: (key: string) => void;
  onAddSection: () => void;
  onAddNote: () => void;
  onUpdateNote: (id: string, patch: Partial<QuotationNoteBlock>) => void;
  onRemoveNote: (id: string) => void;
}) {
  const {
    readOnly,
    currency,
    validUntil,
    paymentTerms,
    taxRate,
    sections,
    items,
    noteBlocks,
    collapsed,
    totals,
    onEditDetails,
  } = props;
  const [sectionMenu, setSectionMenu] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {/* Commercial settings strip */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-sales-md border border-[var(--sales-brand-border)] bg-[var(--sales-brand-soft-solid)]/70 px-3.5 py-2.5">
        <StripField label="Quote currency" value={currency} />
        <StripField
          label="Valid until"
          value={validUntil ? formatDisplayDate(validUntil) : "—"}
        />
        <StripField label="Payment terms" value={paymentTerms || "—"} />
        <div className="ml-auto">
          <Button size="sm" variant="secondary" onClick={onEditDetails} disabled={readOnly}>
            Edit details
          </Button>
        </div>
      </div>

      {sections.length === 0 ? (
        <EmptyBlock
          title="No items yet"
          detail="Add your first product or service"
          action={
            !readOnly ? (
              <Button size="sm" onClick={props.onAddSection}>
                Add section
              </Button>
            ) : null
          }
        />
      ) : null}

      {sections.map((sec, idx) => {
        const sectionItems = items.filter((it) => it.section_id === sec.id);
        const isCollapsed = collapsed[sec.id] ?? idx > 0;
        const sub = sectionSubtotal(sectionItems, taxRate);
        return (
          <div key={sec.id} className="rounded-sales-md border border-sales-border bg-sales-surface">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
              onClick={() => props.onToggleSection(sec.id)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-sales-text-muted" />
              ) : (
                <ChevronDown className="h-4 w-4 text-sales-text-muted" />
              )}
              <span className="flex-1 text-[13.5px] font-semibold text-sales-text-primary">
                {idx + 1}.{" "}
                {readOnly ? (
                  sec.title
                ) : (
                  <input
                    className="bg-transparent font-semibold outline-none"
                    value={sec.title}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => props.onRenameSection(sec.id, e.target.value)}
                  />
                )}
              </span>
              {isCollapsed ? (
                <span className="text-[13px] font-medium text-sales-text-secondary">
                  {formatMoneyCompact(sub, currency)}
                </span>
              ) : null}
              {!readOnly && props.onMoveSection ? (
                <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="rounded p-1 text-sales-text-muted hover:bg-sales-surface-hover disabled:opacity-30"
                    disabled={idx === 0}
                    aria-label="Move section up"
                    onClick={() => props.onMoveSection?.(sec.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-sales-text-muted hover:bg-sales-surface-hover disabled:opacity-30"
                    disabled={idx === sections.length - 1}
                    aria-label="Move section down"
                    onClick={() => props.onMoveSection?.(sec.id, 1)}
                  >
                    ↓
                  </button>
                </span>
              ) : null}
            </button>

            {!isCollapsed ? (
              <div className="border-t border-sales-border">
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[720px] text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-sales-border text-[11px] uppercase tracking-wide text-sales-text-muted">
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 font-medium">Qty</th>
                        <th className="px-3 py-2 font-medium">Unit</th>
                        <th className="px-3 py-2 font-medium">Unit Price</th>
                        <th className="px-3 py-2 font-medium">Discount</th>
                        <th className="px-3 py-2 font-medium">Tax</th>
                        <th className="px-3 py-2 font-medium">Total</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {sectionItems.map((it) => (
                        <LineRow
                          key={it.key}
                          item={it}
                          currency={currency}
                          taxRate={taxRate}
                          readOnly={readOnly}
                          onChange={(p) => props.onUpdateItem(it.key, p)}
                          onRemove={() => props.onRemoveItem(it.key)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="space-y-2 p-3 md:hidden">
                  {sectionItems.map((it) => (
                    <MobileLineCard
                      key={it.key}
                      item={it}
                      currency={currency}
                      taxRate={taxRate}
                      readOnly={readOnly}
                      onChange={(p) => props.onUpdateItem(it.key, p)}
                      onRemove={() => props.onRemoveItem(it.key)}
                    />
                  ))}
                </div>

                {!readOnly ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-sales-border px-3.5 py-2.5">
                    {sectionItems.length === 0 ? (
                      <p className="w-full text-[12.5px] text-sales-text-muted">
                        No items in this section yet.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-sales-brand-fg"
                      onClick={() => props.onAddItem(sec.id)}
                    >
                      + Add item
                    </button>
                    <button
                      type="button"
                      className="text-[13px] text-sales-text-secondary"
                      onClick={() => props.onAddCustom(sec.id)}
                    >
                      Custom item
                    </button>
                    {sectionItems.length === 0 && props.sections.length > 1 ? (
                      <div className="relative ml-auto">
                        <button
                          type="button"
                          className="rounded p-1 text-sales-text-muted hover:bg-sales-surface-hover hover:text-sales-text-primary"
                          aria-label="Section actions"
                          onClick={() =>
                            setSectionMenu((m) => (m === sec.id ? null : sec.id))
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {sectionMenu === sec.id ? (
                          <div className="absolute right-0 z-20 mt-1 w-40 rounded-sales-md border border-sales-border bg-sales-surface py-1 shadow-sales-card">
                            <button
                              type="button"
                              className="w-full px-3 py-1.5 text-left text-[12px] text-sales-danger hover:bg-sales-surface-hover"
                              onClick={() => {
                                setSectionMenu(null);
                                props.onRemoveSection(sec.id);
                              }}
                            >
                              Remove section
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {noteBlocks.map((n) => (
        <div key={n.id} className="rounded-sales-md border border-dashed border-sales-border bg-sales-surface-subtle px-3.5 py-3">
          {readOnly ? (
            <>
              <p className="text-[13px] font-semibold">{n.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-sales-text-secondary">{n.body}</p>
            </>
          ) : (
            <>
              <input
                className="w-full bg-transparent text-[13px] font-semibold outline-none"
                value={n.title}
                onChange={(e) => props.onUpdateNote(n.id, { title: e.target.value })}
                placeholder="Note title"
              />
              <textarea
                className="mt-1 w-full resize-y bg-transparent text-[12.5px] text-sales-text-secondary outline-none"
                rows={2}
                value={n.body}
                onChange={(e) => props.onUpdateNote(n.id, { body: e.target.value })}
                placeholder="Delivery note, warranty, scope clarification…"
              />
              <button
                type="button"
                className="mt-1 text-[12px] text-sales-danger"
                onClick={() => props.onRemoveNote(n.id)}
              >
                Remove note
              </button>
            </>
          )}
        </div>
      ))}

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={props.onAddSection}>
            Add section
          </Button>
          <Button size="sm" variant="ghost" onClick={props.onAddNote}>
            Add note block
          </Button>
          <span className="ml-auto text-[13px] font-semibold text-sales-text-primary">
            Subtotal {formatMoneyCompact(totals.subtotal, currency)}
          </span>
        </div>
      ) : (
        <div className="text-right text-[13px] font-semibold">
          Subtotal {formatMoneyCompact(totals.subtotal, currency)}
        </div>
      )}
    </div>
  );
}

function StripField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-sales-text-muted">{label}</p>
      <p className="text-[13px] font-semibold text-sales-text-primary">{value}</p>
    </div>
  );
}

function LineRow({
  item,
  currency,
  taxRate,
  readOnly,
  onChange,
  onRemove,
}: {
  item: EditorItem;
  currency: string;
  taxRate: number;
  readOnly: boolean;
  onChange: (p: Partial<EditorItem>) => void;
  onRemove: () => void;
}) {
  const lineTotal = sectionSubtotal([item], taxRate);
  const rate = item.tax_rate != null ? Number(item.tax_rate) : taxRate;

  return (
    <tr className="border-b border-sales-border/80 align-top last:border-0">
      <td className="px-3 py-2.5">
        <div className="flex gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-sales-sm border border-sales-border bg-sales-surface-subtle">
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] font-semibold text-sales-text-muted">
                {(item.item_name || "?").slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            {readOnly ? (
              <p className="font-semibold text-sales-text-primary">{item.item_name}</p>
            ) : (
              <input
                className="w-full bg-transparent font-semibold outline-none"
                value={item.item_name}
                onChange={(e) => onChange({ item_name: e.target.value })}
                placeholder="Item name"
              />
            )}
            {item.sku ? <p className="text-[11px] text-sales-text-muted">{item.sku}</p> : null}
            {!item.catalog_item_id ? (
              <p className="text-[10px] font-medium uppercase tracking-wide text-sales-text-muted">Custom</p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        {readOnly ? (
          <span className="text-sales-text-secondary">{item.description}</span>
        ) : (
          <input
            className="w-full bg-transparent text-sales-text-secondary outline-none"
            value={item.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Description"
          />
        )}
      </td>
      <td className="px-3 py-2.5">
        <NumInput readOnly={readOnly} value={item.quantity} onChange={(v) => onChange({ quantity: v })} className="w-14" />
      </td>
      <td className="px-3 py-2.5">
        {readOnly ? (
          item.unit
        ) : (
          <select
            className="rounded border border-sales-border bg-sales-surface px-1 py-0.5"
            value={item.unit || "Each"}
            onChange={(e) => onChange({ unit: e.target.value })}
          >
            {QUOTE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="px-3 py-2.5">
        <NumInput
          readOnly={readOnly}
          value={item.unit_price}
          onChange={(v) => onChange({ unit_price: v })}
          className="w-20"
          prefix="$"
        />
      </td>
      <td className="px-3 py-2.5">
        <NumInput
          readOnly={readOnly}
          value={Number(item.discount_percent) || 0}
          onChange={(v) => onChange({ discount_percent: v })}
          className="w-14"
          suffix="%"
        />
      </td>
      <td className="px-3 py-2.5 text-sales-text-secondary">
        {rate > 0 ? `${rate}%` : "—"}
      </td>
      <td className="px-3 py-2.5 font-semibold">{formatMoneyCompact(lineTotal, currency)}</td>
      <td className="px-2 py-2.5">
        {!readOnly ? (
          <button type="button" className="rounded p-1 hover:bg-sales-surface-hover" onClick={onRemove} aria-label="Remove">
            <MoreHorizontal className="h-4 w-4 text-sales-text-muted" />
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function MobileLineCard({
  item,
  currency,
  taxRate,
  readOnly,
  onChange,
  onRemove,
}: {
  item: EditorItem;
  currency: string;
  taxRate: number;
  readOnly: boolean;
  onChange: (p: Partial<EditorItem>) => void;
  onRemove: () => void;
}) {
  const lineTotal = sectionSubtotal([item], taxRate);
  return (
    <div className="rounded-sales-md border border-sales-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sales-text-primary">{item.item_name || "Untitled item"}</p>
          <p className="text-[12px] text-sales-text-secondary">
            {item.quantity} × {formatMoneyCompact(item.unit_price, currency)}
            {Number(item.discount_percent) > 0 ? ` · −${item.discount_percent}%` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{formatMoneyCompact(lineTotal, currency)}</p>
          {!readOnly ? (
            <button type="button" className="mt-1 text-[11px] text-sales-danger" onClick={onRemove}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {!readOnly ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <NumInput value={item.quantity} onChange={(v) => onChange({ quantity: v })} className="w-full" />
          <NumInput value={item.unit_price} onChange={(v) => onChange({ unit_price: v })} className="w-full" />
          <NumInput
            value={Number(item.discount_percent) || 0}
            onChange={(v) => onChange({ discount_percent: v })}
            className="w-full"
            suffix="%"
          />
        </div>
      ) : null}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  readOnly,
  className,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  readOnly?: boolean;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  if (readOnly) {
    return (
      <span className={className}>
        {prefix}
        {value}
        {suffix}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {prefix ? <span className="text-sales-text-muted">{prefix}</span> : null}
      <input
        type="number"
        className="w-full min-w-0 rounded border border-sales-border bg-sales-surface px-1.5 py-0.5 outline-none focus:border-sales-brand"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      {suffix ? <span className="text-sales-text-muted">{suffix}</span> : null}
    </span>
  );
}

function OptionsTab({
  readOnly,
  currency,
  items,
  onAdd,
  onPickCatalog,
  onUpdateItem,
  onRemoveItem,
  onMakeMandatory,
}: {
  readOnly: boolean;
  currency: string;
  items: EditorItem[];
  sections: QuotationSectionDef[];
  onAdd: () => void;
  onPickCatalog: () => void;
  onUpdateItem: (key: string, patch: Partial<EditorItem>) => void;
  onRemoveItem: (key: string) => void;
  onMakeMandatory: (key: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyBlock
        title="No optional items"
        detail="Add upgrades, alternatives, or customer-selectable additions. Optional items are not included in the base total."
        action={
          !readOnly ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={onPickCatalog}>
                Add option
              </Button>
              <Button size="sm" variant="secondary" onClick={onAdd}>
                Custom option
              </Button>
            </div>
          ) : null
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-sales-text-secondary">
        Optional items stay outside the base quotation total until selected.
      </p>
      {items.map((it) => (
        <div key={it.key} className="flex flex-wrap items-center gap-3 rounded-sales-md border border-sales-border bg-sales-surface px-3.5 py-3">
          <div className="min-w-0 flex-1">
            {readOnly ? (
              <p className="font-semibold">{it.item_name}</p>
            ) : (
              <input
                className="w-full bg-transparent font-semibold outline-none"
                value={it.item_name}
                onChange={(e) => onUpdateItem(it.key, { item_name: e.target.value })}
                placeholder="Option name"
              />
            )}
            <p className="text-[12px] text-sales-text-secondary">{it.description}</p>
          </div>
          <NumInput
            readOnly={readOnly}
            value={it.unit_price}
            onChange={(v) => onUpdateItem(it.key, { unit_price: v })}
            className="w-24"
          />
          <span className="font-semibold">{formatMoneyCompact(it.unit_price * it.quantity, currency)}</span>
          {!readOnly ? (
            <div className="flex gap-2">
              <button type="button" className="text-[12px] text-sales-text-secondary underline" onClick={() => onMakeMandatory(it.key)}>
                Make required
              </button>
              <button type="button" className="text-[12px] text-sales-danger" onClick={() => onRemoveItem(it.key)}>
                Remove
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {!readOnly ? (
        <Button size="sm" variant="secondary" onClick={onPickCatalog}>
          + Add option
        </Button>
      ) : null}
    </div>
  );
}

function PaymentTab(props: {
  readOnly: boolean;
  paymentTerms: string;
  setPaymentTerms: (v: string) => void;
  validUntil: string;
  setValidUntil: (v: string) => void;
  terms: string;
  setTerms: (v: string) => void;
  deliveryTerms: string;
  setDeliveryTerms: (v: string) => void;
  warrantyTerms: string;
  setWarrantyTerms: (v: string) => void;
  commercialNotes: string;
  setCommercialNotes: (v: string) => void;
  discountPercent: number;
  setDiscountPercent: (v: number) => void;
  otherAmount: number;
  setOtherAmount: (v: number) => void;
  taxRate: number;
  setTaxRate: (v: number) => void;
  currency: string;
}) {
  const r = props.readOnly;
  return (
    <div className="space-y-4 rounded-sales-md border border-sales-border bg-sales-surface p-4">
      <Field label="Payment terms">
        <input
          disabled={r}
          className={cn(FIELD, "w-full")}
          value={props.paymentTerms}
          onChange={(e) => props.setPaymentTerms(e.target.value)}
          placeholder="e.g. 50% deposit, 50% on completion"
        />
      </Field>
      <Field label="Valid until">
        <input
          type="date"
          disabled={r}
          className={cn(FIELD, "w-full max-w-xs")}
          value={props.validUntil}
          onChange={(e) => props.setValidUntil(e.target.value)}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Document discount %">
          <NumInput readOnly={r} value={props.discountPercent} onChange={props.setDiscountPercent} className="w-full" suffix="%" />
        </Field>
        <Field label={`Other (${props.currency})`}>
          <NumInput readOnly={r} value={props.otherAmount} onChange={props.setOtherAmount} className="w-full" />
        </Field>
        <Field label="Default tax %">
          <NumInput readOnly={r} value={props.taxRate} onChange={props.setTaxRate} className="w-full" suffix="%" />
        </Field>
      </div>
      <Field label="Delivery terms">
        <textarea disabled={r} className={cn(FIELD, "w-full")} rows={2} value={props.deliveryTerms} onChange={(e) => props.setDeliveryTerms(e.target.value)} />
      </Field>
      <Field label="Warranty">
        <textarea disabled={r} className={cn(FIELD, "w-full")} rows={2} value={props.warrantyTerms} onChange={(e) => props.setWarrantyTerms(e.target.value)} />
      </Field>
      <Field label="Terms and conditions">
        <textarea disabled={r} className={cn(FIELD, "w-full")} rows={4} value={props.terms} onChange={(e) => props.setTerms(e.target.value)} />
      </Field>
      <Field label="Commercial notes">
        <textarea disabled={r} className={cn(FIELD, "w-full")} rows={2} value={props.commercialNotes} onChange={(e) => props.setCommercialNotes(e.target.value)} />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-sales-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function TimelineTab({
  readOnly,
  milestones,
  onChange,
}: {
  readOnly: boolean;
  milestones: QuotationTimelineMilestone[];
  onChange: (m: QuotationTimelineMilestone[]) => void;
}) {
  if (milestones.length === 0 && readOnly) {
    return <EmptyBlock title="No project timeline added" detail="Fulfilment milestones will appear here." />;
  }
  return (
    <div className="space-y-2">
      {milestones.map((m, idx) => (
        <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-sales-md border border-sales-border bg-sales-surface px-3 py-2.5">
          <span className="text-[12px] text-sales-text-muted">{idx + 1}.</span>
          <input
            disabled={readOnly}
            className="min-w-[140px] flex-1 bg-transparent font-medium outline-none"
            value={m.title}
            onChange={(e) =>
              onChange(milestones.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))
            }
            placeholder="Milestone"
          />
          <input
            type="date"
            disabled={readOnly}
            className="rounded border border-sales-border px-2 py-1 text-[12px]"
            value={m.due_date ?? ""}
            onChange={(e) =>
              onChange(milestones.map((x) => (x.id === m.id ? { ...x, due_date: e.target.value || null } : x)))
            }
          />
          {!readOnly ? (
            <button
              type="button"
              className="text-[12px] text-sales-danger"
              onClick={() => onChange(milestones.filter((x) => x.id !== m.id))}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}
      {!readOnly ? (
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={() =>
            onChange([
              ...milestones,
              { id: newId("ms"), title: "", due_date: null, sort_order: milestones.length },
            ])
          }
        >
          Add milestone
        </Button>
      ) : null}
    </div>
  );
}

function ActivityTab({ events }: { events: QuotationWorkspacePayload["events"] }) {
  if (!events.length) {
    return <EmptyBlock title="No quotation activity yet" detail="Sends, approvals, and responses will appear here." />;
  }
  return (
    <ul className="space-y-0 rounded-sales-md border border-sales-border bg-sales-surface">
      {events.map((ev) => (
        <li key={ev.id} className="flex gap-3 border-b border-sales-border px-3.5 py-3 last:border-0">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sales-brand" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-sales-text-primary">
              {quotationEventLabel(ev.event_type)}
            </p>
            <p className="text-[12px] text-sales-text-muted">
              {ev.actor_name} · {formatDisplayDate(ev.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyBlock({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-sales-md border border-dashed border-sales-border bg-sales-surface px-4 py-10 text-center">
      <p className="text-[14px] font-semibold text-sales-text-primary">{title}</p>
      <p className="mt-1 text-[12.5px] text-sales-text-secondary">{detail}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ---------- Modals ---------- */

function DetailsModal({
  currency,
  setCurrency,
  validUntil,
  setValidUntil,
  paymentTerms,
  setPaymentTerms,
  supported,
  onClose,
  readOnly,
}: {
  currency: string;
  setCurrency: (v: string) => void;
  validUntil: string;
  setValidUntil: (v: string) => void;
  paymentTerms: string;
  setPaymentTerms: (v: string) => void;
  supported: string[];
  onClose: () => void;
  readOnly: boolean;
}) {
  return (
    <Modal title="Edit details" onClose={onClose}>
      <Field label="Quote currency">
        <select
          disabled={readOnly}
          className={cn(FIELD, "w-full")}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {(supported.length ? supported : ["USD"]).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Valid until">
        <input
          type="date"
          disabled={readOnly}
          className={cn(FIELD, "w-full")}
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
        />
      </Field>
      <Field label="Payment terms">
        <input
          disabled={readOnly}
          className={cn(FIELD, "w-full")}
          value={paymentTerms}
          onChange={(e) => setPaymentTerms(e.target.value)}
          placeholder="50% deposit, 50% on completion"
        />
      </Field>
      <div className="mt-4 flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}

function ProductPicker({
  catalog,
  packages,
  onClose,
  onSelect,
  onSelectPackage,
  onCustom,
}: {
  catalog: CatalogItemRow[];
  packages: Array<{
    id: string;
    name: string;
    description: string | null;
    pricing_model?: string;
    flexibility?: string;
    fixed_price?: number | null;
    discount_percent?: number;
    components?: Array<Record<string, unknown>>;
  }>;
  onClose: () => void;
  onSelect: (c: CatalogItemRow) => void;
  onSelectPackage: (pkg: {
    id: string;
    name: string;
    description: string | null;
    pricing_model?: string;
    flexibility?: string;
    fixed_price?: number | null;
    discount_percent?: number;
    components?: Array<Record<string, unknown>>;
  }) => void;
  onCustom: () => void;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "product" | "service" | "package">("all");
  const filtered = catalog.filter((c) => {
    if (kind === "package") return false;
    if (kind === "product" && c.item_kind === "service") return false;
    if (kind === "service" && c.item_kind !== "service") return false;
    const hay = `${c.name} ${c.sku ?? ""} ${c.category ?? ""} ${c.description ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  const pkgFiltered = (kind === "all" || kind === "package")
    ? packages.filter((p) => `${p.name} ${p.description ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    : [];
  return (
    <Modal title="Add item" onClose={onClose}>
      <div className="mb-2 flex flex-wrap gap-1">
        {(["all", "product", "service", "package"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
              kind === k ? "bg-sales-brand-soft text-sales-brand-text" : "text-sales-text-secondary"
            )}
            onClick={() => setKind(k)}
          >
            {k === "all" ? "All" : k === "package" ? "Packages" : k === "service" ? "Services" : "Products"}
          </button>
        ))}
      </div>
      <input
        className={cn(FIELD, "mb-3 w-full")}
        placeholder="Search catalogue…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {pkgFiltered.map((p) => (
          <button
            key={p.id}
            type="button"
            className="flex w-full items-center justify-between rounded-sales-sm px-2 py-2 text-left hover:bg-sales-surface-hover"
            onClick={() => onSelectPackage(p)}
          >
            <span>
              <span className="block text-[13px] font-medium">{p.name}</span>
              <span className="text-[11px] text-sales-text-muted">Package · {(p.components ?? []).length} items</span>
            </span>
          </button>
        ))}
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            className="flex w-full items-center justify-between rounded-sales-sm px-2 py-2 text-left hover:bg-sales-surface-hover"
            onClick={() => onSelect(c)}
          >
            <span>
              <span className="block text-[13px] font-medium">{c.name}</span>
              <span className="text-[11px] text-sales-text-muted">
                {[c.item_kind === "service" ? "Service" : "Product", c.sku, c.category].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="text-[12.5px] font-semibold">{formatMoneyCompact(c.unit_price, c.currency)}</span>
          </button>
        ))}
        {filtered.length === 0 && pkgFiltered.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-sales-text-muted">
            {kind === "package" ? "No packages created yet" : "No catalogue matches"}
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex justify-between border-t border-sales-border pt-3">
        <Button variant="secondary" size="sm" onClick={onCustom}>
          Custom item
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

function SendModal({
  quoteNumber,
  version,
  customer,
  total,
  validUntil,
  hasWhatsApp,
  publicToken,
  commercial,
  quotationId,
  approvalStatus,
  dealId,
  leadId,
  onClose,
  onSent,
}: {
  quoteNumber: string;
  version: number;
  customer: string;
  total: string;
  validUntil: string;
  hasWhatsApp: boolean;
  publicToken: string | null;
  commercial: ReturnType<typeof runCommercialCheck>;
  quotationId: string;
  approvalStatus?: string | null;
  dealId?: string | null;
  leadId?: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [channel, setChannel] = useState<"whatsapp" | "link" | "pdf">(
    hasWhatsApp ? "whatsapp" : "link"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const { toast } = useSalesToast();

  async function send() {
    if (!commercial.canSend) {
      setError(
        commercial.blockingCount > 0
          ? `Complete ${commercial.blockingCount} required items before sending`
          : "Resolve commercial check before sending"
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (channel === "pdf") {
        const res = await fetch(`/api/quotations/${quotationId}/pdf`);
        if (!res.ok) throw new Error("PDF failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${quoteNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      if (channel === "link" && publicToken) {
        await navigator.clipboard.writeText(`${window.location.origin}/quote/${publicToken}`);
        toast({ tone: "success", title: "Link copied" });
      }
      const res = await fetch(`/api/quotations/${quotationId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendViaWhatsApp: channel === "whatsapp" }),
      });
      const json = (await res.json()) as { error?: string; publicToken?: string };
      if (!res.ok) throw new Error(json.error || "Send failed");
      if (channel === "link" && json.publicToken) {
        await navigator.clipboard.writeText(`${window.location.origin}/quote/${json.publicToken}`);
      }
      setSent(true);
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Modal title="Quotation sent" onClose={onClose}>
        <p className="text-[13.5px] text-sales-text-secondary">
          {quoteNumber} version {version} is with {customer}.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button onClick={() => router.push(`/sales/tasks?leadId=${leadId ?? ""}`)}>Schedule follow-up</Button>
          {dealId ? (
            <Button variant="secondary" onClick={() => router.push(`/sales/deals/${dealId}`)}>
              Back to Deal
            </Button>
          ) : null}
          {hasWhatsApp ? (
            <Button variant="secondary" onClick={() => router.push(`/sales/inbox?leadId=${leadId ?? ""}`)}>
              Open WhatsApp
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Send quotation" onClose={onClose}>
      <dl className="mb-4 space-y-1.5 text-[13px]">
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Quotation</dt><dd className="font-medium">{quoteNumber}</dd></div>
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Version</dt><dd className="font-medium">{version}</dd></div>
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Customer</dt><dd className="font-medium">{customer}</dd></div>
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Total</dt><dd className="font-medium">{total}</dd></div>
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Validity</dt><dd className="font-medium">{validUntil ? formatDisplayDate(validUntil) : "—"}</dd></div>
        <div className="flex justify-between">
          <dt className="text-sales-text-secondary">Approval</dt>
          <dd className="font-medium">{approvalStatusLabel(approvalStatus ?? "not_required")}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sales-text-secondary">Commercial Check</dt>
          <dd className="font-medium">
            {commercial.readyCount} of {commercial.totalCount} ready
          </dd>
        </div>
      </dl>
      {commercial.blockingCount > 0 ? (
        <ul className="mb-3 space-y-1 text-[12.5px] text-sales-danger">
          {commercial.items.filter((c) => c.status === "block").map((c) => (
            <li key={c.id}>{c.action || c.label}</li>
          ))}
        </ul>
      ) : null}
      <p className="mb-2 text-[12px] font-medium text-sales-text-secondary">Channel</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {hasWhatsApp ? (
          <ChannelChip active={channel === "whatsapp"} onClick={() => setChannel("whatsapp")} label="WhatsApp" />
        ) : null}
        <ChannelChip active={channel === "link"} onClick={() => setChannel("link")} label="Copy secure link" />
        <ChannelChip active={channel === "pdf"} onClick={() => setChannel("pdf")} label="Download PDF" />
      </div>
      {error ? <p className="mb-2 text-[12px] text-sales-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={busy} leftIcon={channel === "whatsapp" ? <Send className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} onClick={() => void send()}>
          {channel === "whatsapp" ? "Send via WhatsApp" : channel === "link" ? "Send & copy link" : "Generate & send"}
        </Button>
      </div>
    </Modal>
  );
}

function ChannelChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12.5px] font-medium",
        active
          ? "border-sales-brand bg-[var(--sales-brand-soft-solid)] text-sales-brand-text"
          : "border-sales-border text-sales-text-secondary"
      )}
    >
      {label}
    </button>
  );
}

function HistoryModal({
  versions,
  onClose,
  currency,
}: {
  versions: QuotationWorkspacePayload["versions"];
  onClose: () => void;
  currency: string;
}) {
  const router = useRouter();
  const [compare, setCompare] = useState<Array<{ field: string; from: string; to: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = versions[versions.length - 1];
  const previous = versions.length > 1 ? versions[versions.length - 2] : null;

  async function loadCompare() {
    if (!latest || !previous) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${latest.id}/compare?other=${previous.id}`);
      const json = (await res.json()) as { diffs?: Array<{ field: string; from: string; to: string }>; error?: string };
      setCompare(json.diffs ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Version history" onClose={onClose}>
      <ul className="max-h-72 space-y-2 overflow-y-auto">
        {versions.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-sales-sm border border-sales-border px-3 py-2.5 text-left hover:bg-sales-surface-hover"
              onClick={() => {
                onClose();
                router.push(`/sales/quotes/${v.id}`);
              }}
            >
              <span>
                <span className="block text-[13px] font-semibold">Version {v.revision_number}</span>
                <span className="text-[11px] text-sales-text-muted">
                  {quotationStatusLabel(v.status)} · {v.prepared_by_name ?? "—"} · {formatDisplayDate(v.created_at)}
                </span>
              </span>
              <span className="text-[13px] font-semibold">{formatMoneyCompact(v.total, v.currency || currency)}</span>
            </button>
          </li>
        ))}
      </ul>
      {previous && latest ? (
        <div className="mt-3">
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void loadCompare()}>
            Compare version {previous.revision_number} vs {latest.revision_number}
          </Button>
          {compare ? (
            <ul className="mt-3 space-y-1.5 text-[12.5px]">
              {compare.length === 0 ? (
                <li className="text-sales-text-muted">No commercial differences.</li>
              ) : (
                compare.map((row) => (
                  <li key={row.field} className="rounded-sales-sm bg-sales-surface-subtle px-2 py-1.5">
                    <span className="font-medium">{row.field}</span>
                    <span className="mt-0.5 block text-sales-text-secondary">
                      V{previous.revision_number}: {row.from} → V{latest.revision_number}: {row.to}
                    </span>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/35" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-sales-surface p-4 shadow-xl sm:rounded-sales-lg sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-sales-text-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5 text-sales-text-muted" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ApprovalRequestModal({
  payload,
  totals,
  currency,
  governance,
  reasons,
  quotationId,
  onClose,
  onSubmitted,
}: {
  payload: QuotationWorkspacePayload;
  totals: QuoteTotals;
  currency: string;
  governance: ReturnType<typeof evaluateGovernance>;
  reasons: string[];
  quotationId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const q = payload.quotation;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/quotations/${quotationId}/request-approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not submit");
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Request approval" onClose={onClose}>
      <dl className="space-y-1.5 text-[13px]">
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Quotation</dt><dd className="font-medium">{q.quote_number || "Draft"}</dd></div>
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Version</dt><dd className="font-medium">{q.revision_number}</dd></div>
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Customer</dt><dd className="font-medium">{payload.customer.name}</dd></div>
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Deal</dt><dd className="font-medium">{payload.deal?.title ?? "—"}</dd></div>
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Owner</dt><dd className="font-medium">{payload.owner.name}</dd></div>
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Value</dt><dd className="font-medium">{formatMoneyCompact(totals.total, currency)}</dd></div>
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Discount</dt><dd className="font-medium">{totals.effectiveDiscountPercent}%</dd></div>
        {payload.permissions.canSeeMargin && totals.marginPercent != null ? (
          <div className="flex justify-between"><dt className="text-sales-text-secondary">Margin</dt><dd className="font-medium">{totals.marginPercent}%</dd></div>
        ) : payload.permissions.canSeeMarginHealth ? (
          <div className="flex justify-between"><dt className="text-sales-text-secondary">Margin</dt><dd className="font-medium">{marginHealthLabel(governance.marginHealth)}</dd></div>
        ) : null}
        <div className="flex justify-between"><dt className="text-sales-text-secondary">Payment terms</dt><dd className="max-w-[60%] text-right font-medium">{q.payment_terms_label || "—"}</dd></div>
      </dl>
      {reasons.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-4 text-[12.5px] text-sales-text-secondary">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
      <textarea
        className={cn(FIELD, "mt-3 w-full")}
        rows={3}
        placeholder="Explain why this commercial exception is needed..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error ? <p className="mt-2 text-[12.5px] text-sales-danger">{error}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" loading={busy} onClick={() => void submit()}>
          Submit for approval
        </Button>
      </div>
    </Modal>
  );
}
