"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Button, Skeleton, useSalesToast } from "@/components/sales/ui";
import { SettingsSectionCard } from "./SettingsSectionCard";

type PublicConnection = {
  status: "pending_organisation" | "connected" | "reconnect_required" | "disconnected";
  organizationId: string | null;
  organizationName: string | null;
  regionLabel: string | null;
  location: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
  syncEnabled: boolean;
  invoiceReadsGranted?: boolean;
  draftWritesGranted?: boolean;
};

type ConnectionResponse = {
  configured: boolean;
  missing: string[];
  migrationRequired?: boolean;
  supportedRegions: Array<{ location: string; label: string }>;
  connection: PublicConnection | null;
};

type Organisation = { id: string; name: string };
type CustomerPreview = {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  currencyCode?: string | null;
};
type ItemPreview = {
  id: string;
  name: string;
  sku: string | null;
  rate: string | null;
  unit: string | null;
  status: string | null;
  currencyCode?: string | null;
  taxPercentage?: string | null;
  taxName?: string | null;
  stockOnHand?: string | null;
};
type FieldChange = { field: string; from: string | null; to: string | null };
type MatchCandidate = { id: string; name: string; match: string; alreadyLinked: boolean };
type PlanRow = {
  zohoId: string;
  name: string;
  action: "create" | "update" | "conflict" | "blocked";
  changes: FieldChange[];
  preserved: string[];
  candidates: MatchCandidate[];
  blockedReason: string | null;
  currencyCode?: string | null;
  currencySource?: string;
  price?: string | null;
  taxPercent?: string | null;
  unit?: string | null;
  booksStatus?: string | null;
  stockNote?: string | null;
  priceNote?: string;
  phoneNormalized?: boolean;
};
type Decision = { zohoId: string; decision: "create" | "update" | "link" | "skip"; linkToId?: string };
type SyncRun = {
  id: string;
  kind?: string;
  status: string;
  counts: Record<string, number>;
  lastError: string | null;
  invoiceReconnect?: boolean;
};
type OperatorActivity = {
  latestSync: {
    kind: string;
    status: string;
    updatedAt: string;
    finishedAt: string | null;
    lastError: string | null;
    attention: string | null;
    counts: Record<string, number>;
  } | null;
  writes: Array<{ kind: string; status: string; updatedAt: string; safeError: string | null; quotationId: string | null }>;
};
type InvoiceRow = {
  invoiceNumber: string | null;
  status: string | null;
  currencyCode: string | null;
  total: string | null;
  balance: string | null;
  creditsApplied: string | null;
  fetchedAt: string;
  customerName: string | null;
};

const STATUS_LABEL: Record<PublicConnection["status"], string> = {
  pending_organisation: "Choose organisation",
  connected: "Connected",
  reconnect_required: "Reconnect required",
  disconnected: "Disconnected",
};

function statusTone(status: PublicConnection["status"]): "success" | "warning" | "danger" | "neutral" {
  if (status === "connected") return "success";
  if (status === "reconnect_required") return "danger";
  if (status === "pending_organisation") return "warning";
  return "neutral";
}

export function ZohoBooksSettingsSection() {
  const { toast } = useSalesToast();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [payload, setPayload] = useState<ConnectionResponse | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [pendingChangeId, setPendingChangeId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerPreview[] | null>(null);
  const [items, setItems] = useState<ItemPreview[] | null>(null);
  const [customerPage, setCustomerPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);
  const [customersHaveMore, setCustomersHaveMore] = useState(false);
  const [itemsHaveMore, setItemsHaveMore] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [customerPlan, setCustomerPlan] = useState<PlanRow[] | null>(null);
  const [itemPlan, setItemPlan] = useState<PlanRow[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [run, setRun] = useState<SyncRun | null>(null);
  const [activity, setActivity] = useState<OperatorActivity | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);

  async function loadOrganisations() {
    const orgRes = await fetch("/api/integrations/zoho-books/organizations", { cache: "no-store" });
    const orgBody = (await orgRes.json().catch(() => ({}))) as { organizations?: Organisation[]; error?: string };
    setOrganisations(orgBody.organizations ?? []);
    if (!orgRes.ok && orgBody.error) toast({ title: orgBody.error, tone: "error" });
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/zoho-books/connection", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as ConnectionResponse | null;
      setPayload(body);
      if (body?.connection?.status === "pending_organisation") {
        await loadOrganisations();
      } else {
        setOrganisations([]);
      }
      const activityRes = await fetch("/api/integrations/zoho-books/sync", { cache: "no-store" });
      if (activityRes.ok) setActivity((await activityRes.json()) as OperatorActivity);
      if (body?.connection?.status === "connected") {
        const invoiceRes = await fetch("/api/integrations/zoho-books/invoices", { cache: "no-store" });
        const invoiceBody = (await invoiceRes.json().catch(() => ({}))) as { invoices?: InvoiceRow[] };
        if (invoiceRes.ok) setInvoices(invoiceBody.invoices ?? []);
      }
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const zoho = searchParams.get("zoho");
    if (zoho === "choose") toast({ title: "Zoho accepted the connection. Choose the Books organisation.", tone: "success" });
    if (zoho === "denied") toast({ title: "Zoho Books connection was cancelled.", tone: "warning" });
    if (zoho === "replay") toast({ title: "That connection link was already used. Start again.", tone: "warning" });
    if (zoho === "wrong_user" || zoho === "wrong_company" || zoho === "wrong_session") {
      toast({ title: "The Zoho connection did not match this signed-in company.", tone: "error" });
    }
    if (zoho === "region") toast({ title: "Zoho returned a region this connection does not allow.", tone: "error" });
    if (zoho === "unconfigured") toast({ title: "Zoho Books is not configured on the server yet.", tone: "error" });
    if (zoho === "migration") toast({ title: "The Zoho Books database migration still needs to be applied.", tone: "error" });
    if (zoho === "forbidden") toast({ title: "Only a company manager can connect Zoho Books.", tone: "error" });
    if (zoho === "token") toast({ title: "Zoho did not return a usable connection. Start again.", tone: "error" });
  }, [searchParams, toast]);

  useEffect(() => {
    void load();
  }, []);

  async function selectOrganisation(organizationId: string, confirmChange: boolean) {
    setBusy(organizationId);
    try {
      const res = await fetch("/api/integrations/zoho-books/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, confirmChange }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409 && body.error?.includes("Confirm the change")) {
        setPendingChangeId(organizationId);
        return;
      }
      if (!res.ok) {
        toast({ title: body.error || "Could not save the organisation", tone: "error" });
        return;
      }
      setPendingChangeId(null);
      toast({ title: "Zoho Books organisation saved", tone: "success" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function testConnection() {
    setBusy("test");
    try {
      const res = await fetch("/api/integrations/zoho-books/test", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({ title: body.error || "Connection test failed", tone: "error" });
      } else {
        toast({ title: "Zoho Books connection test succeeded", tone: "success" });
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function loadPreview(nextCustomerPage = customerPage, nextItemPage = itemPage) {
    setBusy("preview");
    try {
      const res = await fetch(
        `/api/integrations/zoho-books/preview?customerPage=${nextCustomerPage}&itemPage=${nextItemPage}`,
        { cache: "no-store" }
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        customers?: CustomerPreview[];
        items?: ItemPreview[];
        customersHaveMore?: boolean;
        itemsHaveMore?: boolean;
      };
      if (!res.ok) {
        toast({ title: body.error || "Preview failed", tone: "error" });
        return;
      }
      setCustomerPage(nextCustomerPage);
      setItemPage(nextItemPage);
      setCustomers(body.customers ?? []);
      setItems(body.items ?? []);
      setCustomersHaveMore(body.customersHaveMore === true);
      setItemsHaveMore(body.itemsHaveMore === true);
      setSelectedCustomers([]);
      setSelectedItems([]);
      setCustomerPlan(null);
      setItemPlan(null);
    } finally {
      setBusy(null);
    }
  }

  function chooseDecision(zohoId: string, decision: Decision["decision"], linkToId?: string) {
    setDecisions((current) => ({ ...current, [zohoId]: { zohoId, decision, linkToId } }));
  }

  async function planImport() {
    setBusy("plan");
    try {
      const res = await fetch("/api/integrations/zoho-books/import/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers: selectedCustomers, items: selectedItems }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        customers?: PlanRow[];
        items?: PlanRow[];
      };
      if (!res.ok) {
        toast({ title: body.error || "Could not prepare the import", tone: "error" });
        return;
      }
      const nextDecisions: Record<string, Decision> = {};
      for (const row of [...(body.customers ?? []), ...(body.items ?? [])]) {
        if (row.action === "create") nextDecisions[row.zohoId] = { zohoId: row.zohoId, decision: "create" };
        if (row.action === "update") nextDecisions[row.zohoId] = { zohoId: row.zohoId, decision: "update" };
        if (row.action === "blocked") nextDecisions[row.zohoId] = { zohoId: row.zohoId, decision: "skip" };
      }
      setDecisions(nextDecisions);
      setCustomerPlan(body.customers ?? []);
      setItemPlan(body.items ?? []);
    } finally {
      setBusy(null);
    }
  }

  async function applyImport(runId?: string) {
    setBusy("apply");
    try {
      const rows = [...(customerPlan ?? []), ...(itemPlan ?? [])];
      const customerDecisions = (customerPlan ?? []).map((row) => decisions[row.zohoId]).filter(Boolean);
      const itemDecisions = (itemPlan ?? []).map((row) => decisions[row.zohoId]).filter(Boolean);
      if (rows.some((row) => row.action === "conflict" && !decisions[row.zohoId])) {
        toast({ title: "Choose link or skip for each possible match.", tone: "warning" });
        return;
      }
      const res = await fetch("/api/integrations/zoho-books/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, customers: customerDecisions, items: itemDecisions }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; run?: SyncRun };
      if (!res.ok) {
        toast({ title: body.error || "Import did not finish", tone: "error" });
        return;
      }
      setRun(body.run ?? null);
      if (body.run?.status === "completed") {
        toast({ title: "Import saved in SegmiQ", tone: "success" });
        setCustomerPlan(null);
        setItemPlan(null);
      } else {
        toast({ title: body.run?.lastError || "Import paused. You can resume it.", tone: "warning" });
      }
    } finally {
      setBusy(null);
    }
  }

  async function syncNow() {
    setBusy("sync");
    try {
      let latest: SyncRun | null = null;
      for (let step = 0; step < 40; step += 1) {
        const res = await fetch("/api/integrations/zoho-books/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; run?: SyncRun };
        if (!res.ok) {
          toast({ title: body.error || "Sync paused", tone: "error" });
          break;
        }
        latest = body.run ?? null;
        setRun(latest);
        if (!latest || latest.status !== "running") break;
      }
      const invoiceRes = await fetch("/api/integrations/zoho-books/invoices", { cache: "no-store" });
      const invoiceBody = (await invoiceRes.json().catch(() => ({}))) as { invoices?: InvoiceRow[] };
      if (invoiceRes.ok) setInvoices(invoiceBody.invoices ?? []);
      if (latest?.status === "completed" && latest.invoiceReconnect) {
        toast({ title: "Customers and items were refreshed. Reconnect to read invoices.", tone: "warning" });
      } else if (latest?.status === "completed") {
        toast({ title: "Sync finished", tone: "success" });
      }
    } finally {
      setBusy(null);
    }
  }

  async function discardSync() {
    setBusy("discard");
    try {
      const res = await fetch("/api/integrations/zoho-books/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discard: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ title: body.error || "Could not discard the sync", tone: "error" });
        return;
      }
      setRun(null);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      const res = await fetch("/api/integrations/zoho-books/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({ title: body.error || "Could not disconnect", tone: "error" });
        return;
      }
      setCustomers(null);
      setItems(null);
      toast({ title: "Zoho Books disconnected for this company", tone: "success" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Skeleton className="h-40 w-full rounded-[12px]" />;

  const connection = payload?.connection ?? null;
  const showOrganisationPicker = connection?.status === "pending_organisation" || organisations.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SettingsSectionCard
        title="Zoho Books"
        description="Connect one Zoho Books organisation for this company. Selected customers and items can be copied into SegmiQ. Nothing is created or changed in Books."
      >
        {payload?.migrationRequired ? (
          <p className="mb-3 text-[13px] text-sales-text-secondary">
            The Zoho Books tables are not in the database yet. Apply the migration, then restart the app.
          </p>
        ) : null}
        {!payload?.configured ? (
          <div className="mb-3 text-[13px] text-sales-text-secondary">
            <p>Zoho Books is not configured on this server. Add these names yourself. Do not paste the secret into chat.</p>
            <ul className="mt-2 list-disc pl-5">
              {(payload?.missing ?? ["ZOHO_BOOKS_CLIENT_ID", "ZOHO_BOOKS_CLIENT_SECRET", "ZOHO_BOOKS_REDIRECT_URI", "ZOHO_BOOKS_ACCOUNTS_URL"]).map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="mt-2">
              Local values go in .env.local. Deployed values go in the Vercel Production environment for the Next.js app.
              In the Zoho API console, create a server-based app, enable Multi DC, and register both
              https://www.segmiq.com/api/integrations/zoho-books/oauth/callback and
              http://localhost:3000/api/integrations/zoho-books/oauth/callback.
              Also register https://segmiq.com/api/integrations/zoho-books/oauth/callback if managers open the site without www.
            </p>
            <p className="mt-2">Supported regions: {(payload?.supportedRegions ?? []).map((region) => region.label).join(", ") || "United States, Europe, India, Australia, Japan, Canada, China, Saudi Arabia, United Arab Emirates"}.</p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {connection ? (
            <Badge tone={statusTone(connection.status)} appearance="soft">
              {STATUS_LABEL[connection.status]}
            </Badge>
          ) : (
            <Badge tone="neutral" appearance="soft">Not connected</Badge>
          )}
          <Button
            size="sm"
            disabled={!payload?.configured || payload.migrationRequired}
            onClick={() => {
              window.location.href = "/api/integrations/zoho-books/oauth/start";
            }}
          >
            {connection?.status === "reconnect_required" || connection?.status === "disconnected" ? "Reconnect Zoho Books" : "Connect Zoho Books"}
          </Button>
          {connection?.status === "connected" ? (
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "organisations"}
              onClick={() => {
                setBusy("organisations");
                void loadOrganisations().finally(() => setBusy(null));
              }}
            >
              Change organisation
            </Button>
          ) : null}
          {connection && connection.status !== "disconnected" ? (
            <Button variant="ghost" size="sm" loading={busy === "disconnect"} onClick={() => void disconnect()}>
              Disconnect
            </Button>
          ) : null}
        </div>
        {connection?.organizationName ? (
          <p className="mt-3 text-[13px] text-sales-text-secondary">
            {connection.organizationName} · {connection.organizationId} · {connection.regionLabel || "Region unknown"}
          </p>
        ) : null}
        <p className="mt-1 text-[12px] text-sales-text-muted">
          Last successful test: {connection?.lastTestedAt ? new Date(connection.lastTestedAt).toLocaleString() : "Not tested yet"}
          {connection?.syncEnabled ? "" : " · Background sync is off"}
        </p>
        {connection?.lastError ? <p className="mt-2 text-[13px] text-sales-text-secondary">{connection.lastError}</p> : null}
        <div className="mt-3 text-[13px] text-sales-text-secondary">
          <p>
            Last manual sync:{" "}
            {activity?.latestSync
              ? `${activity.latestSync.status} · ${new Date(activity.latestSync.finishedAt || activity.latestSync.updatedAt).toLocaleString()}`
              : "None yet. Sync now is the only sync, and it runs only when a manager clicks it."}
          </p>
          {activity?.latestSync?.attention ? <p className="mt-1">{activity.latestSync.attention}</p> : null}
          {activity?.writes?.length ? (
            <ul className="mt-2 flex flex-col gap-1">
              {activity.writes.map((item) => (
                <li key={`${item.kind}-${item.updatedAt}`}>
                  {item.kind} · {item.status === "uncertain" || item.status === "needs_reconciliation" ? "Needs reconciliation" : item.status}
                  {item.safeError ? ` · ${item.safeError}` : ""}
                  {` · ${new Date(item.updatedAt).toLocaleString()}`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">No failed or unfinished Books drafts are waiting.</p>
          )}
        </div>
      </SettingsSectionCard>

      {showOrganisationPicker ? (
        <SettingsSectionCard
          title="Books organisation"
          description="Pick the organisation Zoho returned. Nothing is selected automatically."
        >
          {organisations.length === 0 ? (
            <p className="text-[13px] text-sales-text-secondary">No Zoho Books organisations were returned for this login.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {organisations.map((org) => {
                const current = connection?.organizationId === org.id;
                const confirming = pendingChangeId === org.id;
                return (
                  <li key={org.id} className="flex flex-wrap items-center gap-3 rounded-[10px] px-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-sales-text-primary">{org.name}</span>
                      <span className="mt-0.5 block text-[12px] text-sales-text-secondary">{org.id}</span>
                    </span>
                    {current && connection?.status === "connected" ? (
                      <Badge tone="success" appearance="soft">Selected</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant={confirming ? "secondary" : "primary"}
                        loading={busy === org.id}
                        onClick={() => void selectOrganisation(org.id, confirming)}
                      >
                        {confirming ? "Confirm organisation change" : current ? "Confirm this organisation" : "Use this organisation"}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SettingsSectionCard>
      ) : null}

      {connection?.status === "connected" ? (
        <SettingsSectionCard
          title="Preview and import"
          description="Customers are filtered to Books contacts with contact type customer. Items include active and inactive records. Select up to five of each, then confirm. Opening this page does not call Books."
        >
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy === "test"} onClick={() => void testConnection()}>
              Test connection
            </Button>
            <Button size="sm" variant="secondary" loading={busy === "preview"} onClick={() => void loadPreview(1, 1)}>
              Load preview
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={selectedCustomers.length + selectedItems.length === 0}
              loading={busy === "plan"}
              onClick={() => void planImport()}
            >
              Review selected
            </Button>
          </div>
          {connection.invoiceReadsGranted === false ? (
            <p className="mt-3 text-[13px] text-sales-text-secondary">
              Invoice status needs a new approval. Reconnect Zoho Books so Zoho can grant ZohoBooks.invoices.READ. Customer and item import still works. Changing permissions requires the manager to authorise again.
            </p>
          ) : null}
          {connection.status === "connected" && connection.draftWritesGranted === false ? (
            <p className="mt-3 text-[13px] text-sales-text-secondary">
              Draft quotations and invoices need a new approval. Reconnect Zoho Books. Zoho will ask for permission to create a customer, and to read, create, and update estimates and invoices. SegmiQ does not ask for delete, payment, or send permissions. Customer and item import still works until you reconnect.
            </p>
          ) : null}
          {customers || items ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-[13px] font-semibold text-sales-text-primary">Customers</h3>
                {customers?.length ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {customers.map((customer) => (
                      <li key={customer.id} className="text-[13px] text-sales-text-secondary">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selectedCustomers.includes(customer.id)}
                            onChange={(event) =>
                              setSelectedCustomers((current) =>
                                event.target.checked ? [...current, customer.id].slice(0, 5) : current.filter((id) => id !== customer.id)
                              )
                            }
                          />
                          <span>
                            <span className="font-medium text-sales-text-primary">{customer.name}</span>
                            {customer.currencyCode ? ` · ${customer.currencyCode}` : " · Currency not sent"}
                            {customer.email ? ` · ${customer.email}` : ""}
                            {customer.phone ? ` · ${customer.phone}` : ""}
                            {customer.status ? ` · ${customer.status}` : ""}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[13px] text-sales-text-secondary">No customers were returned.</p>
                )}
                {customersHaveMore && customerPage < 20 ? (
                  <Button className="mt-2" size="sm" variant="ghost" onClick={() => void loadPreview(customerPage + 1, itemPage)}>
                    Next five customers
                  </Button>
                ) : null}
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-sales-text-primary">Items</h3>
                {items?.length ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {items.map((item) => (
                      <li key={item.id} className="text-[13px] text-sales-text-secondary">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selectedItems.includes(item.id)}
                            onChange={(event) =>
                              setSelectedItems((current) =>
                                event.target.checked ? [...current, item.id].slice(0, 5) : current.filter((id) => id !== item.id)
                              )
                            }
                          />
                          <span>
                            <span className="font-medium text-sales-text-primary">{item.name}</span>
                            {item.status ? ` · ${item.status}` : ""}
                            {item.sku ? ` · SKU ${item.sku}` : ""}
                            {item.rate ? ` · ${item.rate}` : " · Price not sent"}
                            {item.currencyCode ? ` ${item.currencyCode}` : ""}
                            {item.unit ? ` · ${item.unit}` : ""}
                            {item.taxPercentage ? ` · Tax ${item.taxPercentage}%` : ""}
                            {item.taxName ? ` (${item.taxName})` : ""}
                            {item.stockOnHand != null ? (
                              <span className="mt-1 block">
                                Books stock_on_hand: {item.stockOnHand}. This is Zoho&apos;s stock figure, not SegmiQ available stock.
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[13px] text-sales-text-secondary">No items were returned.</p>
                )}
                {itemsHaveMore && itemPage < 20 ? (
                  <Button className="mt-2" size="sm" variant="ghost" onClick={() => void loadPreview(customerPage, itemPage + 1)}>
                    Next five items
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {customerPlan || itemPlan ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-[13px] text-sales-text-secondary">
                Reimport updates the Books fields shown below on the same SegmiQ record. Notes, tags, the relationship owner, leads, deals, follow-ups, packages, quotation text, and inventory reservations stay as they are. An imported customer is a contact, not a new lead.
              </p>
              {[...(customerPlan ?? []), ...(itemPlan ?? [])].map((row) => (
                <div key={row.zohoId} className="rounded-[10px] px-2 py-2 text-[13px] text-sales-text-secondary">
                  <p className="font-medium text-sales-text-primary">
                    {row.name} · {row.action}
                    {row.currencyCode ? ` · ${row.currencyCode}` : ""}
                    {row.currencySource === "organisation" ? " (organisation currency)" : ""}
                  </p>
                  {row.blockedReason ? <p className="mt-1">{row.blockedReason}</p> : null}
                  {row.priceNote ? <p className="mt-1">{row.priceNote}</p> : null}
                  {row.stockNote ? <p className="mt-1">{row.stockNote}</p> : null}
                  {row.phoneNormalized === false && row.action !== "conflict" ? (
                    <p className="mt-1">The phone was stored as Books sent it because the country dial code is not known.</p>
                  ) : null}
                  {row.changes.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5">
                      {row.changes.map((change) => (
                        <li key={`${row.zohoId}-${change.field}`}>
                          {change.field}: {change.from ?? "empty"} → {change.to ?? "empty"}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {row.action === "conflict" ? (
                    <div className="mt-2 flex flex-col gap-1">
                      <p>A phone, email, or SKU matches an existing SegmiQ record. Link one or skip. Nothing is merged automatically.</p>
                      {row.candidates.map((candidate) => (
                        <label key={candidate.id} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`link-${row.zohoId}`}
                            disabled={candidate.alreadyLinked}
                            checked={decisions[row.zohoId]?.linkToId === candidate.id}
                            onChange={() => chooseDecision(row.zohoId, "link", candidate.id)}
                          />
                          <span>
                            Link {candidate.name} ({candidate.match})
                            {candidate.alreadyLinked ? " · already linked to another Books record" : ""}
                          </span>
                        </label>
                      ))}
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`link-${row.zohoId}`}
                          checked={decisions[row.zohoId]?.decision === "skip"}
                          onChange={() => chooseDecision(row.zohoId, "skip")}
                        />
                        <span>Skip</span>
                      </label>
                    </div>
                  ) : null}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  loading={busy === "apply"}
                  onClick={() => void applyImport(run?.kind === "import" && run.status !== "completed" ? run.id : undefined)}
                >
                  Import into SegmiQ
                </Button>
                {run && run.status !== "completed" ? (
                  <Button size="sm" variant="ghost" loading={busy === "discard"} onClick={() => void discardSync()}>
                    Discard paused import
                  </Button>
                ) : null}
              </div>
              {run?.lastError ? <p className="text-[13px] text-sales-text-secondary">{run.lastError}</p> : null}
            </div>
          ) : null}
        </SettingsSectionCard>
      ) : null}

      {connection?.status === "connected" ? (
        <SettingsSectionCard
          title="Sync now"
          description="Manual only. This refreshes records already imported and reads invoice status for those customers. It does not turn on a schedule, and it does not write to Books."
        >
          <p className="text-[13px] text-sales-text-secondary">
            Books allows 100 requests a minute per organisation. Daily limits depend on the Books plan: 1,000 on Free, 2,000 on Standard, 5,000 on Professional, and 10,000 on Premium, Elite, and Ultimate. Those limits are shared with every other app using this organisation. A later nightly sync of the imported records would be a small number of calls. This phase does not start it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" loading={busy === "sync"} onClick={() => void syncNow()}>
              Sync now
            </Button>
            {run && run.status !== "completed" ? (
              <Button size="sm" variant="ghost" loading={busy === "discard"} onClick={() => void discardSync()}>
                Discard paused sync
              </Button>
            ) : null}
          </div>
          {run ? (
            <p className="mt-2 text-[13px] text-sales-text-secondary">
              {run.status}
              {run.counts.customersUpdated ? ` · customers ${run.counts.customersUpdated}` : ""}
              {run.counts.itemsUpdated ? ` · items ${run.counts.itemsUpdated}` : ""}
              {run.counts.invoices ? ` · invoices ${run.counts.invoices}` : ""}
            </p>
          ) : null}
        </SettingsSectionCard>
      ) : null}

      {connection?.status === "connected" ? (
        <SettingsSectionCard
          title="Books invoices"
          description="Status, total, and outstanding balance copied from Books. Outstanding is the unpaid balance. Partial payments, credits, and void status are already included in that figure. This is not cash received and it does not mark a deal won."
        >
          {invoices?.length ? (
            <ul className="flex flex-col gap-2">
              {invoices.map((invoice) => (
                <li key={`${invoice.invoiceNumber}-${invoice.fetchedAt}`} className="text-[13px] text-sales-text-secondary">
                  <span className="font-medium text-sales-text-primary">{invoice.invoiceNumber || "Invoice"}</span>
                  {invoice.customerName ? ` · ${invoice.customerName}` : ""}
                  {invoice.status ? ` · ${invoice.status}` : ""}
                  {invoice.currencyCode ? ` · ${invoice.currencyCode}` : ""}
                  {invoice.total != null ? ` · total ${invoice.total}` : ""}
                  {invoice.balance != null ? ` · outstanding ${invoice.balance}` : ""}
                  {invoice.creditsApplied && Number(invoice.creditsApplied) > 0 ? ` · credits applied ${invoice.creditsApplied}` : ""}
                  {invoice.fetchedAt ? ` · fetched ${new Date(invoice.fetchedAt).toLocaleString()}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-sales-text-secondary">
              No invoice status is stored yet. Sync now reads it for imported customers. Opening this page does not call Books.
            </p>
          )}
        </SettingsSectionCard>
      ) : null}
    </div>
  );
}
