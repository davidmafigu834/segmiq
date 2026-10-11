"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/sales/ui";

type Kind = "estimate" | "invoice";

type ReviewLine = {
  name: string;
  quantity: number;
  rate: number;
  discount: string | null;
  taxRate: number | null;
  itemId: string;
};

type Review = {
  ready: boolean;
  blockers: string[];
  referenceNumber: string;
  currency: string;
  lines: ReviewLine[];
  excludedOptionalCount: number;
  proposedTotal: number;
  taxNote: string;
  numberingNote: string;
  currencyNote: string;
  stockNote: string | null;
};

type DocumentView = {
  id: string | null;
  number: string | null;
  status: string | null;
  draft: boolean;
  message: string;
  booksTotal: number | null;
  segmiqTotal: number | null;
  difference: number | null;
  differs: boolean;
  organisationUrl: string | null;
  referenceNumber: string | null;
};

type CustomerView = {
  name: string | null;
  email: string | null;
  linked: boolean;
  createBlocker: string | null;
};

type ReviewResponse = {
  error?: string;
  reconnect?: boolean;
  review?: Review;
  customer?: CustomerView;
  planName?: string | null;
  planNote?: string;
  document?: DocumentView | null;
  operation?: { status: string; needsReconciliation: boolean } | null;
  customerOperation?: { status: string; needsReconciliation: boolean } | null;
  organisationName?: string | null;
  needsReconciliation?: boolean;
  canRetry?: boolean;
  created?: boolean;
};

export function BooksDraftPanel({ quotationId }: { quotationId: string }) {
  const [kind, setKind] = useState<Kind>("estimate");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [stockChecked, setStockChecked] = useState(false);
  const [replaceChecked, setReplaceChecked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [retryTarget, setRetryTarget] = useState<"draft" | "customer" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/integrations/zoho-books/drafts?quotationId=${quotationId}&kind=${kind}&stockAcknowledged=${stockChecked ? "true" : "false"}`
      );
      const json = (await res.json()) as ReviewResponse;
      setData(json);
      if (!json.operation?.needsReconciliation && !json.customerOperation?.needsReconciliation) setRetryTarget(null);
      setMessage(json.error ?? null);
    } catch {
      setMessage("Zoho Books could not be reached.");
    } finally {
      setLoading(false);
    }
  }, [kind, quotationId, stockChecked]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function post(path: string, body: Record<string, unknown>, action: string) {
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId, kind, ...body }),
      });
      const json = (await res.json()) as ReviewResponse;
      await load();
      if (action === "search") setRetryTarget(json.canRetry ? "draft" : null);
      else if (action === "customer") setRetryTarget(json.canRetry ? "customer" : null);
      else if (action === "clear" || action === "clear-customer") setRetryTarget(null);
      setMessage(json.error ?? (json.created ? "Books saved the draft." : json.canRetry ? "Books has no matching record. You can try once more." : null));
    } catch {
      setMessage("Zoho Books could not be reached.");
    } finally {
      setBusy(null);
    }
  }

  const review = data?.review;
  const needsReconciliation = Boolean(data?.operation?.needsReconciliation || data?.needsReconciliation);
  const label = kind === "estimate" ? "quotation" : "invoice";

  return (
    <section className="mt-4 rounded-sales-md border border-sales-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-sales-text-primary">Zoho Books draft</h2>
        <div className="flex gap-2">
          <Button size="sm" variant={kind === "estimate" ? "primary" : "secondary"} onClick={() => setKind("estimate")}>
            Quotation
          </Button>
          <Button size="sm" variant={kind === "invoice" ? "primary" : "secondary"} onClick={() => setKind("invoice")}>
            Invoice
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[13px] text-sales-text-secondary">
        This prepares a draft {label} in the connected Books organisation. It does not email the customer, mark the deal won, or record a payment.
      </p>
      {!open ? (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          Review Books draft
        </Button>
      ) : null}
      {open ? (
      <>
      {loading ? <p className="mt-3 text-[13px] text-sales-text-secondary">Loading the review…</p> : null}
      {data?.reconnect ? (
        <p className="mt-3 text-[13px] text-sales-text-secondary">
          A company admin needs to reconnect Zoho Books and approve the new draft permissions. Import and invoice status keep working until then.
        </p>
      ) : null}
      {data?.planNote ? <p className="mt-3 text-[13px] text-sales-text-secondary">{data.planNote}</p> : null}
      {data?.organisationName ? (
        <p className="mt-1 text-[13px] text-sales-text-secondary">Organisation: {data.organisationName}</p>
      ) : null}
      {review ? (
        <div className="mt-3 flex flex-col gap-2 text-[13px] text-sales-text-secondary">
          <p>{review.numberingNote}</p>
          <p>{review.currencyNote}</p>
          <p>{review.taxNote}</p>
          <p>
            Customer: {data?.customer?.linked ? data.customer.name || "Linked Books customer" : "Not linked"}
            {review.currency ? ` · ${review.currency}` : ""}
            {data?.customer?.email ? ` · ${data.customer.email}` : ""}
          </p>
          {review.excludedOptionalCount > 0 ? <p>{review.excludedOptionalCount} optional line(s) are left out of this draft.</p> : null}
          {review.lines.length ? (
            <ul className="flex flex-col gap-1">
              {review.lines.map((line) => (
                <li key={`${line.itemId}-${line.name}`}>
                  {line.name} · qty {line.quantity} · {line.rate}
                  {line.discount ? ` · discount ${line.discount}` : ""}
                  {line.taxRate != null ? ` · SegmiQ tax ${line.taxRate}%` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <p>Proposed SegmiQ total: {review.proposedTotal}</p>
          {review.blockers.map((blocker) => (
            <p key={blocker}>{blocker}</p>
          ))}
        </div>
      ) : null}
      {data?.document ? (
        <div className="mt-3 text-[13px] text-sales-text-secondary">
          <p>
            Books {data.document.number || data.document.id || "document"} · status {data.document.status || "unknown"}
            {data.document.booksTotal != null ? ` · Books total ${data.document.booksTotal}` : ""}
          </p>
          <p>{data.document.message}</p>
          {data.document.differs ? (
            <p>
              Books total differs from the SegmiQ total by {data.document.difference}. The Books total is the accounting figure.
            </p>
          ) : null}
          {data.document.organisationUrl ? (
            <a className="underline" href={data.document.organisationUrl} target="_blank" rel="noreferrer">
              Open this Books organisation
            </a>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="mt-3 text-[13px] text-sales-text-primary">{message}</p> : null}
      {needsReconciliation ? (
        <p className="mt-3 text-[13px] text-sales-text-primary">Needs reconciliation. Another draft will not be created until Books is checked.</p>
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        {data?.customerOperation?.needsReconciliation ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "customer"}
            onClick={() => void post("/api/integrations/zoho-books/drafts/customer", { reconcile: true, confirmNotCreated: false }, "customer")}
          >
            Search Books for this customer
          </Button>
        ) : data?.customer && !data.customer.linked && !data.customer.createBlocker ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "customer"}
            onClick={() => void post("/api/integrations/zoho-books/drafts/customer", { confirm: true }, "customer")}
          >
            Create Books customer
          </Button>
        ) : null}
        {kind === "invoice" && review?.stockNote ? (
          <label className="flex items-start gap-2 text-[13px] text-sales-text-secondary">
            <input className="mt-1" type="checkbox" checked={stockChecked} onChange={(event) => setStockChecked(event.target.checked)} />
            <span>{review.stockNote}</span>
          </label>
        ) : null}
        <Button
          size="sm"
          variant="primary"
          disabled={!review?.ready || needsReconciliation || (kind === "invoice" && !stockChecked) || Boolean(data?.document?.id)}
          loading={busy === "create"}
          onClick={() => void post("/api/integrations/zoho-books/drafts", { confirm: true, stockAcknowledged: stockChecked }, "create")}
        >
          Create draft
        </Button>
        {needsReconciliation ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "search"}
            onClick={() => void post("/api/integrations/zoho-books/drafts/reconcile", { confirmNotCreated: false }, "search")}
          >
            Search Books again
          </Button>
        ) : null}
        {retryTarget === "draft" ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "clear"}
            onClick={() => void post("/api/integrations/zoho-books/drafts/reconcile", { confirmNotCreated: true }, "clear")}
          >
            I checked Books and this draft is not there
          </Button>
        ) : null}
        {retryTarget === "customer" ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "clear-customer"}
            onClick={() => void post("/api/integrations/zoho-books/drafts/customer", { reconcile: true, confirmNotCreated: true }, "clear-customer")}
          >
            I checked Books and this customer is not there
          </Button>
        ) : null}
        {data?.document?.draft ? (
          <label className="flex items-start gap-2 text-[13px] text-sales-text-secondary">
            <input className="mt-1" type="checkbox" checked={replaceChecked} onChange={(event) => setReplaceChecked(event.target.checked)} />
            <span>Replace the linked Books draft with this review. Finalised documents are left unchanged.</span>
          </label>
        ) : null}
        {data?.document?.draft && replaceChecked ? (
          <Button
            size="sm"
            variant="secondary"
            loading={busy === "update"}
            onClick={() =>
              void post(
                "/api/integrations/zoho-books/drafts/update",
                { confirmReplace: true, acknowledgeBooksChanges: true, stockAcknowledged: stockChecked },
                "update"
              )
            }
          >
            Update draft
          </Button>
        ) : null}
      </div>
      </>
      ) : null}
    </section>
  );
}
