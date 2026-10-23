"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatUsd } from "@/lib/commercial/catalogue";
import type { QuoteSnapshot } from "@/lib/platform-sales/types";
import { CommercialEmptyState, CommercialStatus } from "@/components/commercial/CommercialPrimitives";

type Prospect = {
  id: string;
  organisation_name: string;
  contact_name: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  updated_at: string;
};
type Quote = {
  id: string;
  prospect_id: string;
  quote_number: string;
  status: string;
  current_revision: number;
  valid_until: string;
  platform_sales_prospects?: { organisation_name?: string } | null;
};
export function CommercialSalesClient({
  initialProspects,
  initialQuotes,
  initialView = "prospects",
  initialCreate = false,
}: {
  initialProspects: Prospect[];
  initialQuotes: Quote[];
  initialView?: "prospects" | "quotes" | "builder";
  initialCreate?: boolean;
}) {
  const [prospects, setProspects] = useState(initialProspects);
  const [quotes, setQuotes] = useState(initialQuotes);
  const [tab, setTab] = useState<"prospects" | "quotes" | "builder">(initialView);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Commercial sales"
      >
        <Button
          className="min-h-11"
          variant={tab === "prospects" ? "primary" : "secondary"}
          aria-selected={tab === "prospects"}
          onClick={() => setTab("prospects")}
        >
          Prospects
        </Button>
        <Button
          className="min-h-11"
          variant={tab === "quotes" ? "primary" : "secondary"}
          aria-selected={tab === "quotes"}
          onClick={() => setTab("quotes")}
        >
          Quotations
        </Button>
        <Button
          className="min-h-11"
          variant={tab === "builder" ? "primary" : "secondary"}
          aria-selected={tab === "builder"}
          onClick={() => setTab("builder")}
        >
          Quotation builder
        </Button>
      </div>
      {error ? (
        <div
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-[var(--error)] p-3 text-sm text-[var(--error)]"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-[var(--success)]">
          {notice}
        </p>
      ) : null}
      {tab === "prospects" ? (
        <Prospects
          prospects={prospects}
          quotes={quotes}
          initialCreate={initialCreate}
          onError={setError}
          onCreated={(p) => setProspects([p, ...prospects])}
          onIssue={async (id) => {
            setError("");
            const r = await fetch(
              `/api/admin/platform-sales/quotes/${id}/issue`,
              { method: "POST" },
            );
            const b = await r.json();
            if (!r.ok) return setError(b.error ?? "Issue failed");
            await navigator.clipboard.writeText(b.recipientUrl);
            setQuotes(
              quotes.map((q) =>
                q.id === id ? { ...q, status: "link_created" } : q,
              ),
            );
            setNotice("Secure recipient link copied. It has not been sent.");
          }}
        />
      ) : tab === "quotes" ? (
        <Quotations
          quotes={quotes}
          onIssue={async (id) => {
            setError("");
            const response = await fetch(`/api/admin/platform-sales/quotes/${id}/issue`, { method: "POST" });
            const body = await response.json();
            if (!response.ok) return setError(body.error ?? "Issue failed");
            await navigator.clipboard.writeText(body.recipientUrl);
            setQuotes(quotes.map((quote) => quote.id === id ? { ...quote, status: "link_created" } : quote));
            setNotice("Secure recipient link copied. It has not been sent.");
          }}
          onCreate={() => setTab("builder")}
        />
      ) : (
        <QuoteBuilder
          prospects={prospects}
          onCreated={(q) => {
            setQuotes([q, ...quotes]);
            setTab("prospects");
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function Quotations({ quotes, onIssue, onCreate }: { quotes: Quote[]; onIssue: (id: string) => void; onCreate: () => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotes.filter((quote) => (status === "all" || quote.status === status) && (!term || quote.quote_number.toLowerCase().includes(term) || quote.platform_sales_prospects?.organisation_name?.toLowerCase().includes(term)));
  }, [quotes, search, status]);
  return (
    <section aria-labelledby="quotations-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 id="quotations-heading" className="text-lg font-semibold text-[var(--text-primary)]">Commercial quotations</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">Draft, issue, and follow up on immutable quotation revisions.</p></div>
        <Button className="min-h-11" onClick={onCreate}>Create quotation</Button>
      </div>
      <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-[var(--text-secondary)]"><span>Search quotations</span><Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Reference or organisation" /></label>
        <label className="space-y-1 text-sm text-[var(--text-secondary)]"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)]"><option value="all">All statuses</option>{["draft", "link_created", "sent", "viewed", "accepted", "declined", "changes_requested", "expired", "converted"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      </div>
      {visible.length ? <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"><div className="hidden grid-cols-[1fr_1.2fr_0.7fr_0.7fr_auto] gap-4 border-b border-[var(--border)] px-5 py-3 text-xs text-[var(--text-tertiary)] lg:grid"><span>Quotation</span><span>Prospect</span><span>Revision</span><span>Valid until</span><span>Status / action</span></div><div className="divide-y divide-[var(--border)]">{visible.map((quote) => <article key={quote.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_1.2fr_0.7fr_0.7fr_auto] lg:items-center lg:px-5"><div><Link href={`/dashboard/commercial-sales/quotes/${quote.id}`} className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">{quote.quote_number}</Link><p className="mt-1 text-xs text-[var(--text-tertiary)] lg:hidden">Quotation</p></div><p className="text-sm text-[var(--text-secondary)]">{quote.platform_sales_prospects?.organisation_name ?? "Unknown prospect"}</p><p className="text-sm text-[var(--text-secondary)]">Revision {quote.current_revision}</p><p className="text-sm text-[var(--text-secondary)]">{formatShortDate(quote.valid_until)}</p><div className="flex flex-wrap items-center gap-2"><CommercialStatus value={quote.status} />{quote.status === "draft" ? <Button size="sm" variant="secondary" onClick={() => onIssue(quote.id)}>Create secure link</Button> : <Link href={`/api/admin/platform-sales/quotes/${quote.id}/pdf`} className="inline-flex min-h-10 items-center text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">PDF</Link>}</div></article>)}</div></div> : <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"><CommercialEmptyState icon={FileText} title={quotes.length ? "No matching quotations" : "No quotations yet"} description={quotes.length ? "Change the search or status filter." : "Create the first catalogue-backed quotation for an existing prospect."} action={!quotes.length ? <Button onClick={onCreate}>Create quotation</Button> : undefined} /></div>}
    </section>
  );
}
function Prospects({
  prospects,
  quotes,
  initialCreate,
  onCreated,
  onIssue,
  onError,
}: {
  prospects: Prospect[];
  quotes: Quote[];
  initialCreate: boolean;
  onCreated: (p: Prospect) => void;
  onIssue: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [show, setShow] = useState(initialCreate);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    organisationName: "",
    contactName: "",
    email: "",
    phone: "",
  });
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleProspects = normalizedSearch
    ? prospects.filter((prospect) =>
        [
          prospect.organisation_name,
          prospect.contact_name,
          prospect.email,
          prospect.phone,
        ].some((value) =>
          value?.toLocaleLowerCase().includes(normalizedSearch),
        ),
      )
    : prospects;
  async function create() {
    const r = await fetch("/api/admin/platform-sales/prospects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        email: form.email || null,
        phone: form.phone || null,
      }),
    });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    onCreated({
      id: b.id,
      organisation_name: form.organisationName,
      contact_name: form.contactName,
      email: form.email,
      phone: form.phone,
      status: "new",
      updated_at: new Date().toISOString(),
    });
    setShow(false);
  }
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Prospects
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Platform-owned records; saving a prospect never provisions a tenant.
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setShow(!show)}>
          {show ? "Cancel" : "New prospect"}
        </Button>
      </div>
      {show ? (
        <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:grid-cols-2">
          <Field label="Organisation name">
            <Input
              className="min-h-11"
              value={form.organisationName}
              onChange={(e) =>
                setForm({ ...form, organisationName: e.target.value })
              }
            />
          </Field>
          <Field label="Contact name">
            <Input
              className="min-h-11"
              value={form.contactName}
              onChange={(e) =>
                setForm({ ...form, contactName: e.target.value })
              }
            />
          </Field>
          <Field label="Email">
            <Input
              className="min-h-11"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Phone as supplied">
            <Input
              className="min-h-11"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Button
            className="sm:col-span-2"
            disabled={
              form.organisationName.length < 2 || form.contactName.length < 2
            }
            onClick={() => create().catch((e) => onError(e.message))}
          >
            Save prospect
          </Button>
        </div>
      ) : null}
      <Field label="Search prospects">
        <Input
          className="min-h-11"
          type="search"
          value={search}
          placeholder="Company, contact, email or phone"
          onChange={(event) => setSearch(event.target.value)}
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleProspects.map((p) => {
          const pq = quotes.filter((q) => q.prospect_id === p.id);
          return (
            <article
              key={p.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">
                    {p.organisation_name}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {p.contact_name}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-tertiary)]">
                  {p.status}
                </span>
              </div>
              <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                {p.email || p.phone || "No contact channel recorded"}
              </p>
              {pq.map((q) => (
                <div
                  key={q.id}
                  className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs"
                >
                  <a
                    href={`/dashboard/commercial-sales/quotes/${q.id}`}
                    className="text-[var(--text-primary)] hover:underline"
                  >
                    {q.quote_number} · {q.status}
                  </a>
                  {q.status === "draft" ? (
                    <Button
                      size="sm"
                      className="min-h-11"
                      variant="secondary"
                      onClick={() => onIssue(q.id)}
                    >
                      Create secure link
                    </Button>
                  ) : (
                    <a
                      className="text-[var(--accent)]"
                      href={`/api/admin/platform-sales/quotes/${q.id}/pdf`}
                    >
                      PDF
                    </a>
                  )}
                </div>
              ))}
            </article>
          );
        })}
        {visibleProspects.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            No prospects match this search.
          </p>
        ) : null}
      </div>
    </>
  );
}
function QuoteBuilder({
  prospects,
  onCreated,
  onError,
}: {
  prospects: Prospect[];
  onCreated: (q: Quote) => void;
  onError: (e: string) => void;
}) {
  const future = new Date(Date.now() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [form, setForm] = useState({
    prospectId: prospects[0]?.id ?? "",
    crmSku: "crm_growth",
    seats: 1,
    aiSku: "",
    serviceSkus: [] as string[],
    taxRateBasisPoints: 0,
    validUntil: future,
    notes: "",
    discount: null as null | {
      kind: "fixed" | "percent";
      value: number;
      scope: "recurring" | "one_time";
      reason: string;
    },
  });
  const [preview, setPreview] = useState<QuoteSnapshot | null>(null);
  const payload = () => ({
    ...form,
    aiSku: form.aiSku || null,
    notes: form.notes || null,
  });
  async function call(path: string) {
    onError("");
    const r = await fetch(`/api/admin/platform-sales/quotes${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload()),
    });
    const b = await r.json();
    if (!r.ok) {
      onError(b.error ?? "Request failed");
      return;
    }
    if (path === "/preview") setPreview(b);
    else
      onCreated({
        id: b.quoteId,
        prospect_id: form.prospectId,
        quote_number: "New draft",
        status: "draft",
        current_revision: 1,
        valid_until: form.validUntil,
      });
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 sm:grid-cols-2">
        <Field label="Prospect">
          <Select
            value={form.prospectId}
            onChange={(e) => setForm({ ...form, prospectId: e.target.value })}
          >
            {prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.organisation_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="CRM plan">
          <Select
            value={form.crmSku}
            onChange={(e) =>
              setForm({
                ...form,
                crmSku: e.target.value,
                aiSku: e.target.value === "crm_starter" ? "" : form.aiSku,
              })
            }
          >
            <option value="crm_starter">Starter</option>
            <option value="crm_growth">Growth</option>
          </Select>
        </Field>
        <Field label="Purchased seats">
          <Input
            className="min-h-11"
            type="number"
            min={1}
            value={form.seats}
            onChange={(e) =>
              setForm({ ...form, seats: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Agentic AI">
          <Select
            value={form.aiSku}
            disabled={form.crmSku !== "crm_growth"}
            onChange={(e) => setForm({ ...form, aiSku: e.target.value })}
          >
            <option value="">None</option>
            <option value="agentic_business">Agentic Business</option>
            <option value="agentic_scale">Agentic Scale</option>
          </Select>
        </Field>
        <Field label="Valid until">
          <Input
            className="min-h-11"
            type="date"
            value={form.validUntil}
            onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
          />
        </Field>
        <Field label="Tax rate (basis points; 1500 = 15%)">
          <Input
            className="min-h-11"
            type="number"
            min={0}
            max={10000}
            value={form.taxRateBasisPoints}
            onChange={(e) =>
              setForm({ ...form, taxRateBasisPoints: Number(e.target.value) })
            }
          />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-xs font-medium text-[var(--text-secondary)]">
            Optional setup services
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["onboarding_one_business", "One-business CRM setup"],
              ["onboarding_two_businesses", "Two-business CRM setup"],
              ["onboarding_three_businesses", "Three-business CRM setup"],
              ["ai_activation_standard", "Standard AI activation"],
            ].map(([id, label]) => (
              <label
                key={id}
                className="flex min-h-11 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.serviceSkus.includes(id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      serviceSkus: e.target.checked
                        ? [...form.serviceSkus, id]
                        : form.serviceSkus.filter((x) => x !== id),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="sm:col-span-2 flex min-h-11 items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={Boolean(form.discount)}
            onChange={(e) =>
              setForm({
                ...form,
                discount: e.target.checked
                  ? { kind: "fixed", value: 0, scope: "one_time", reason: "" }
                  : null,
              })
            }
          />
          Apply an approved itemized discount
        </label>
        {form.discount ? (
          <>
            <Field
              label={
                form.discount.kind === "fixed"
                  ? "Discount (USD cents)"
                  : "Discount (basis points)"
              }
            >
              <Input
                className="min-h-11"
                type="number"
                min={0}
                value={form.discount.value}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discount: {
                      ...form.discount!,
                      value: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <Field label="Discount type and scope">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={form.discount.kind}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      discount: {
                        ...form.discount!,
                        kind: e.target.value as "fixed" | "percent",
                      },
                    })
                  }
                >
                  <option value="fixed">Fixed</option>
                  <option value="percent">Percent</option>
                </Select>
                <Select
                  value={form.discount.scope}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      discount: {
                        ...form.discount!,
                        scope: e.target.value as "recurring" | "one_time",
                      },
                    })
                  }
                >
                  <option value="one_time">One-time</option>
                  <option value="recurring">Recurring</option>
                </Select>
              </div>
            </Field>
            <Field label="Discount approval reason">
              <Input
                className="min-h-11"
                value={form.discount.reason}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discount: { ...form.discount!, reason: e.target.value },
                  })
                }
              />
            </Field>
          </>
        ) : null}
        <Field label="Commercial notes">
          <textarea
            className="min-h-24 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] p-3 text-sm"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <div className="flex items-end">
          <Button
            className="w-full"
            disabled={!form.prospectId}
            onClick={() => call("/preview")}
          >
            Calculate server preview
          </Button>
        </div>
      </div>
      <aside className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <h2 className="font-semibold text-[var(--text-primary)]">
          Offer totals
        </h2>
        {preview ? (
          <>
            <div className="mt-4 space-y-2">
              {preview.lines.map((l) => (
                <Summary
                  key={l.sku}
                  label={`${l.name} × ${l.quantity}`}
                  value={formatUsd(l.subtotalUsdCents)}
                />
              ))}
            </div>
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <Summary
                label="Monthly recurring"
                value={formatUsd(preview.recurringTotalUsdCents)}
              />
              <Summary
                label="One-time"
                value={formatUsd(preview.oneTimeTotalUsdCents)}
              />
              <Summary label="Tax" value={formatUsd(preview.taxUsdCents)} />
              <Summary
                label="Initial due"
                value={formatUsd(preview.initialDueUsdCents)}
              />
            </div>
            <p className="mt-3 text-xs text-[var(--text-tertiary)]">
              AI allowances are not yet metered. External provider charges are
              separate.
            </p>
            <Button className="mt-4 w-full" onClick={() => call("")}>
              Save draft
            </Button>
          </>
        ) : (
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">
            Use the server preview to see exact catalogue-backed totals.
          </p>
        )}
      </aside>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
function Select(p: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--bg-tertiary)] px-3 text-sm text-[var(--text-primary)]"
    />
  );
}
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
