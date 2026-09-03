import { addDays, format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { asRow, asRows } from "@/lib/agent/rows";
import { retrieveApprovedLearning } from "@/lib/agent/learning/retrieval";
import { hasCommercialPermission } from "@/lib/commercial/permissions";
import { getAvailability, getInventorySettings } from "@/lib/inventory/service";
import { expandCommercialPackage, getPackage } from "@/lib/packages/service";
import { evaluateApprovalRequirement } from "@/lib/quotations/approval-engine";
import { runCommercialCheck, totalsForCheck, type CommercialCheckInventoryPolicy } from "@/lib/quotations/commercial-check";
import { resolveQuoteItems, quoteInventoryAndPriceWarnings } from "@/lib/quotations/commercial-resolver";
import { copyQuotationAsDraft } from "@/lib/quotations/copy-quote";
import { logQuotationEvent } from "@/lib/quotations/events";
import { loadPolicies } from "@/lib/quotations/evaluate-send";
import { evaluateGovernance } from "@/lib/quotations/governance";
import { isQuotationEditable } from "@/lib/quotations/lifecycle";
import { loadQuotationWithItems, saveItemsAndTotals } from "@/lib/quotations/persist";
import { allocateQuoteNumber, ensureQuotationSettings } from "@/lib/quotations/quote-number";
import { loadTemplateWithItems } from "@/lib/quotations/templates";
import { isBuiltinQuoteTemplate } from "@/lib/agent/tools/quotation";
import { logLeadEvent } from "@/lib/lead-events";
import type { QuotationLineItemInput } from "@/types";
import type { SalesActor, SalesBlock, SalesChoice, SalesIntent, SalesIntentItem, ProgressStep, QuotationDraftPreview, CommercialCheckPreview, PendingInput } from "./types";
import { formatSalesMoney } from "./types";
import { loadConversationExtraction } from "./extract";
import {
  catalogChoice,
  loadAccessibleDeal,
  loadProductVariants,
  resolveCatalogQuery,
  resolveCatalogById,
  resolveCustomer,
  resolveDealsForCustomer,
  variantQuantitiesMatch,
  type ResolvedCatalogItem,
  type ResolvedCustomer,
  type ResolvedDeal,
} from "./resolve";

function step(id: string, label: string, status: ProgressStep["status"], detail?: string): ProgressStep {
  return { id, label, status, detail };
}

function previewCheck(check: ReturnType<typeof runCommercialCheck>): CommercialCheckPreview {
  const readyLabel = check.canSend
    ? "Ready for review"
    : check.approvalRequired
      ? "Manager approval required"
      : check.blockingCount
        ? "Blocked"
        : "Needs attention";
  return {
    items: check.items.map((i) => ({ id: i.id, label: i.label, status: i.status, action: i.action })),
    canSend: check.canSend,
    approvalRequired: check.approvalRequired,
    readyLabel,
  };
}

export type CommandOutcome = {
  reply: string;
  blocks: SalesBlock[];
  status: "COMPLETED" | "WAITING_FOR_INPUT" | "FAILED";
  pending?: PendingInput;
  activeLeadId?: string | null;
  activeDealId?: string | null;
  activeQuotationId?: string | null;
  quotationId?: string | null;
};

function waiting(
  prompt: string,
  kind: PendingInput["kind"],
  options: SalesChoice[],
  intent: SalesIntent,
  progress: ProgressStep[],
  extra?: Record<string, unknown>
): CommandOutcome {
  return {
    reply: prompt,
    status: "WAITING_FOR_INPUT",
    pending: { kind, prompt, options, intent, progress, extra },
    blocks: [
      { type: "progress", steps: progress },
      { type: "choice", kind: kind === "REQUIREMENTS" || kind === "VARIANT" || kind === "COPY_CONFIRM" || kind === "TEMPLATE" ? "PRODUCT" : kind, prompt, options },
      { type: "status", kind: "partial", message: prompt },
    ],
  };
}

async function evaluateDraft(
  clientId: string,
  quote: Record<string, unknown>,
  actor: SalesActor
): Promise<{ check: ReturnType<typeof runCommercialCheck>; total: number; inventoryNotes: string[] }> {
  const supabase = createAdminClient();
  const items = (quote.items as QuotationLineItemInput[]) ?? [];
  const settings = await ensureQuotationSettings(supabase, clientId);
  const policies = await loadPolicies(supabase, clientId);
  const invSettings = await getInventorySettings(clientId);
  const live = await quoteInventoryAndPriceWarnings(clientId, items);
  const inventoryPolicy: CommercialCheckInventoryPolicy = invSettings.blockInsufficientStock
    ? "block"
    : invSettings.warnInsufficientStock
      ? "warn"
      : "off";
  const totals = totalsForCheck(
    items,
    Number(quote.tax_rate) || 0,
    Number(quote.other_amount) || 0,
    Number(quote.discount_percent) || 0
  );
  const role = actor.role === "SUPER_ADMIN" ? "CLIENT_MANAGER" : actor.role;
  const governance = evaluateGovernance({
    items,
    totals,
    settings,
    role,
    paymentTermsLabel: (quote.payment_terms_label as string | null) ?? null,
    defaultPaymentTerms: (settings.default_payment_terms as string | null) ?? null,
  });
  const approval = evaluateApprovalRequirement({
    items,
    totals,
    settings,
    policies,
    role,
    paymentTermsLabel: (quote.payment_terms_label as string | null) ?? null,
  });
  const check = runCommercialCheck({
    status: String(quote.status),
    approvalStatus: (quote.approval_status as string | null) ?? null,
    customerName: quote.customer_name as string | null,
    dealId: quote.deal_id as string | null,
    currency: quote.currency as string | null,
    validUntil: quote.valid_until as string | null,
    paymentTermsLabel: quote.payment_terms_label as string | null,
    items,
    totals,
    governance,
    approval,
    inventoryShortages: live.inventoryShortages,
    inventoryPolicy,
    priceFreshnessWarnings: live.priceFreshnessWarnings,
  });
  const inventoryNotes = live.inventoryShortages.map(
    (s) => `${s.name}: requested ${s.requested}, available ${s.available}`
  );
  return { check, total: totals.total, inventoryNotes };
}

function compactLines(items: QuotationLineItemInput[]): QuotationDraftPreview["lines"] {
  const packages = new Map<string, { name: string; quantity: number; unitPrice: number; amount: number }>();
  const extras: QuotationDraftPreview["lines"] = [];
  for (const it of items) {
    if (it.package_id && it.source_type === "PACKAGE") {
      const key = it.package_id;
      const name = (it.group_label || it.item_name || "Package").replace(/\s+·\s+.+$/, "");
      const pkgName = name.includes("Package") ? name : (it.item_name?.split("·")[0]?.trim() || name);
      const prev = packages.get(key);
      const amount = (Number(it.unit_price) || 0) * (Number(it.quantity) || 0);
      if (prev) {
        prev.amount += amount;
        prev.unitPrice = prev.amount;
      } else {
        packages.set(key, {
          name: pkgName,
          quantity: 1,
          unitPrice: amount,
          amount,
        });
      }
    } else {
      extras.push({
        name: it.item_name,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unit_price) || 0,
        amount: (Number(it.unit_price) || 0) * (Number(it.quantity) || 0),
        kind: it.source_type === "SERVICE" ? "SERVICE" : it.source_type === "CUSTOM" ? "CUSTOM" : "PRODUCT",
      });
    }
  }
  const pkgLines: QuotationDraftPreview["lines"] = [...packages.values()].map((p) => ({
    name: p.name,
    quantity: p.quantity,
    unitPrice: p.unitPrice,
    amount: p.amount,
    kind: "PACKAGE",
  }));
  return [...pkgLines, ...extras];
}

async function buildPreview(opts: {
  quote: Record<string, unknown>;
  customerName: string;
  dealName: string | null;
  check: ReturnType<typeof runCommercialCheck>;
  inventoryNotes: string[];
  learningNotes: string[];
  sendRequested: boolean;
}): Promise<QuotationDraftPreview> {
  const items = (opts.quote.items as QuotationLineItemInput[]) ?? [];
  return {
    quotationId: opts.quote.id as string,
    quoteNumber: (opts.quote.quote_number as string) || "",
    status: String(opts.quote.status),
    customerName: opts.customerName,
    dealName: opts.dealName,
    currency: (opts.quote.currency as string) || "USD",
    subtotal: Number(opts.quote.subtotal) || 0,
    taxAmount: Number(opts.quote.tax_amount) || 0,
    total: Number(opts.quote.total) || 0,
    validUntil: (opts.quote.valid_until as string | null) ?? null,
    lines: compactLines(items),
    commercialCheck: previewCheck(opts.check),
    href: `/sales/quotes/${opts.quote.id}`,
    inventoryNotes: opts.inventoryNotes,
    learningNotes: opts.learningNotes,
    sendRequested: opts.sendRequested,
    isRevision: Number(opts.quote.revision_number) > 1,
  };
}

async function resolveItemsOrWait(opts: {
  actor: SalesActor;
  items: SalesIntentItem[];
  intent: SalesIntent;
  progress: ProgressStep[];
}): Promise<{ ok: true; resolved: Array<{ item: SalesIntentItem; catalog: ResolvedCatalogItem; variantId?: string | null }> } | CommandOutcome> {
  const resolved: Array<{ item: SalesIntentItem; catalog: ResolvedCatalogItem; variantId?: string | null }> = [];
  const forceProduct = Boolean(opts.intent.upgrade);
  for (const item of opts.items) {
    const prefer: "PACKAGE" | "PRODUCT" | "SERVICE" | "AUTO" = forceProduct
      ? "PRODUCT"
      : item.type === "PACKAGE"
        ? "PACKAGE"
        : item.type === "SERVICE"
          ? "SERVICE"
          : item.type === "PRODUCT"
            ? "PRODUCT"
            : "AUTO";
    if (item.id) {
      const byId = await resolveCatalogById({
        actor: opts.actor,
        id: item.id,
        prefer,
      });
      if (byId) {
        resolved.push({ item, catalog: byId, variantId: null });
        continue;
      }
    }
    const match = await resolveCatalogQuery({ actor: opts.actor, query: item.query, prefer });
    if (match.kind === "none") {
      return {
        reply: `I couldn't find “${item.query}” in the company's catalogue.`,
        status: "WAITING_FOR_INPUT",
        blocks: [
          { type: "status", kind: "partial", message: `I couldn't find “${item.query}” in the company's catalogue.` },
          {
            type: "actions",
            actions: [
              { label: "Search Products", href: "/sales/toolbox" },
              { label: "Cancel", prompt: "cancel" },
            ],
          },
        ],
      };
    }
    if (match.kind === "many") {
      // Selection already pinned an id but catalogue search still ambiguous — honour the pick.
      if (item.id) {
        const picked = match.values.find((v) => v.id === item.id);
        if (picked) {
          resolved.push({ item, catalog: picked, variantId: null });
          continue;
        }
      }
      const prompt =
        match.bothTypes
          ? `“${item.query}” matches both a Package and a Product. Which should I use?`
          : `Which ${item.query.toLowerCase().includes("battery") ? "battery" : "item"} should I use?`;
      return waiting(prompt, match.values[0]?.type === "PACKAGE" && !forceProduct ? "PACKAGE" : "PRODUCT", match.choices ?? [], opts.intent, opts.progress, {
        pendingItemQuery: item.query,
      });
    }
    const catalog = match.value;
    if (catalog.type !== "PACKAGE" && catalog.hasVariants) {
      const variants = await loadProductVariants({ actor: opts.actor, productId: catalog.id });
      if (item.variantAllocations?.length) {
        const check = variantQuantitiesMatch(item.quantity, item.variantAllocations);
        if (!check.ok) {
          const requested = check.requested;
          const remaining = requested - check.total;
          const mismatch = `The size breakdown totals ${check.total}, but the requested quantity is ${requested}. Please add the remaining ${remaining} or confirm the total should be ${check.total}.`;
          return {
            reply: mismatch,
            status: "WAITING_FOR_INPUT",
            blocks: [
              {
                type: "status",
                kind: "partial",
                message: mismatch,
              },
            ],
            pending: {
              kind: "VARIANT",
              prompt: "Confirm variant quantities",
              options: variants.map((v) => ({
                id: v.id,
                entityType: "VARIANT",
                title: v.name,
                subtitle: v.sku,
              })),
              intent: opts.intent,
              progress: opts.progress,
            },
          };
        }
        for (const alloc of item.variantAllocations) {
          const v =
            variants.find((x) => x.id === alloc.variantId) ||
            variants.find((x) => x.name.toLowerCase().includes(alloc.variantQuery.toLowerCase()));
          if (!v) {
            return waiting(
              `${catalog.name} is stocked by variant. Which ${alloc.variantQuery} should I use?`,
              "VARIANT",
              variants.map((x) => ({ id: x.id, entityType: "VARIANT", title: x.name, subtitle: x.sku })),
              opts.intent,
              opts.progress
            );
          }
          resolved.push({
            item: { ...item, quantity: alloc.quantity },
            catalog,
            variantId: v.id,
          });
        }
        continue;
      }
      if (!item.variantQuery) {
        return {
          reply: `${catalog.name} is stocked by variant. Do you have the breakdown?`,
          status: "WAITING_FOR_INPUT",
          blocks: [
            {
              type: "variant_allocator",
              prompt: `${catalog.name} is stocked by variant. Do you have the breakdown?`,
              productName: catalog.name,
              requestedTotal: item.quantity,
              allocatedTotal: 0,
              variants: variants.map((v) => ({ id: v.id, name: v.name, quantity: 0 })),
            },
          ],
          pending: {
            kind: "VARIANT",
            prompt: `${catalog.name} is stocked by variant. Do you have the breakdown?`,
            options: variants.map((v) => ({ id: v.id, entityType: "VARIANT", title: v.name })),
            intent: opts.intent,
            progress: opts.progress,
            extra: { productId: catalog.id, requestedTotal: item.quantity },
          },
        };
      }
      const v = variants.find((x) => x.name.toLowerCase().includes(item.variantQuery!.toLowerCase()));
      if (!v) {
        return waiting(`Which ${catalog.name} variant should I use?`, "VARIANT", variants.map((x) => ({
          id: x.id,
          entityType: "VARIANT",
          title: x.name,
        })), opts.intent, opts.progress);
      }
      resolved.push({ item, catalog, variantId: v.id });
      continue;
    }
    resolved.push({ item, catalog, variantId: null });
  }
  return { ok: true, resolved };
}

async function linesFromResolved(
  actor: SalesActor,
  resolved: Array<{ item: SalesIntentItem; catalog: ResolvedCatalogItem; variantId?: string | null }>
): Promise<{ lines: QuotationLineItemInput[]; error?: string; warnings: string[] }> {
  const lines: QuotationLineItemInput[] = [];
  const warnings: string[] = [];
  for (const row of resolved) {
    if (row.catalog.type === "PACKAGE") {
      const expanded = await expandCommercialPackage({
        clientId: actor.clientId,
        packageId: row.catalog.id,
        scale: row.item.quantity,
      });
      if (expanded.error) return { lines: [], error: expanded.error, warnings };
      lines.push(...expanded.lines);
    } else {
      const got = await resolveQuoteItems({
        clientId: actor.clientId,
        sourceType: row.catalog.type === "SERVICE" ? "SERVICE" : "PRODUCT",
        productId: row.catalog.id,
        variantId: row.variantId,
        quantity: row.item.quantity,
      });
      if (got.error) return { lines: [], error: got.error, warnings };
      lines.push(...got.lines);
      warnings.push(...got.warnings);
    }
  }
  return { lines, warnings };
}

async function pickTemplate(
  clientId: string
): Promise<{ id: string | null; wait?: CommandOutcome }> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("quote_templates")
    .select("id, name, is_active, is_builtin, builtin_key")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  const rows = asRows<{ id: string; name: string; is_builtin?: boolean; builtin_key?: string | null }>(data);
  const custom = rows.filter((r) => !isBuiltinQuoteTemplate(r));
  if (custom.length === 1) return { id: custom[0]!.id };
  if (custom.length === 0 && rows.length) return { id: rows[0]!.id };
  if (custom.length > 1) {
    return {
      id: null,
      wait: {
        reply: "Which quotation template should I use?",
        status: "WAITING_FOR_INPUT",
        blocks: [
          {
            type: "choice",
            kind: "TEMPLATE",
            prompt: "Which quotation template should I use?",
            options: custom.map((t) => ({
              id: t.id,
              entityType: "TEMPLATE",
              title: t.name,
            })),
          },
        ],
      },
    };
  }
  return { id: null };
}

async function learningNotesFor(opts: {
  clientId: string;
  command: string;
  conversationText?: string;
}): Promise<string[]> {
  const retrieved = await retrieveApprovedLearning({
    clientId: opts.clientId,
    customerMessage: `${opts.command}\n${opts.conversationText ?? ""}`.slice(0, 2000),
    intents: ["QUOTATION_REQUEST"],
    limit: 4,
  });
  return retrieved.items.map((i) => i.title);
}

function upgradeNotesFor(intent: SalesIntent, existingNote: string | null): string {
  const hint = (intent.existingSystemHint ?? "").trim();
  const upgradeLine = hint
    ? `System upgrade — add-ons to existing ${hint} system.`
    : "System upgrade — add-ons to existing install.";
  const prior = (existingNote ?? "").trim();
  if (!prior) return upgradeLine;
  if (prior.toLowerCase().includes("system upgrade")) return prior;
  return `${upgradeLine}\n${prior}`;
}

export async function runCreateQuotation(opts: {
  actor: SalesActor;
  intent: SalesIntent;
  pageLeadId?: string | null;
  pageDealId?: string | null;
  pageConversationId?: string | null;
  pageCompanyId?: string | null;
  pageCustomerId?: string | null;
  commandText: string;
  selectedId?: string | null;
  flags: { quotationCreation: boolean; contextualExtraction: boolean };
}): Promise<CommandOutcome> {
  if (!opts.flags.quotationCreation) {
    return {
      reply: "Quotation commands are not enabled for this company.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "denied", message: "Quotation commands are not enabled for this company." }],
    };
  }
  const progress: ProgressStep[] = [
    step("customer", "Customer identified", "running"),
    step("deal", "Deal identified", "pending"),
    step("items", "Items resolved", "pending"),
    step("pricing", "Current pricing loaded", "pending"),
    step("inventory", "Inventory checked", "pending"),
    step("draft", "Draft created", "pending"),
    step("check", "Commercial Check complete", "pending"),
  ];

  const openConversationId = opts.pageLeadId || opts.pageConversationId || null;
  const customer = await resolveCustomer({
    actor: opts.actor,
    page: {
      leadId: opts.pageLeadId,
      conversationId: opts.pageConversationId,
      dealId: opts.pageDealId,
      companyId: opts.pageCompanyId,
      customerId: opts.pageCustomerId,
    },
    // Hub IDs are authoritative. Don't let a SEARCH parse skip the open chat.
    source: openConversationId ? "CURRENT_CONTEXT" : opts.intent.customerReference?.source,
    query: openConversationId ? undefined : opts.intent.customerReference?.query,
    id: openConversationId ? undefined : (opts.selectedId ?? opts.intent.customerReference?.id),
  });
  if (customer.kind === "none") {
    progress[0] = step("customer", "Customer identified", "failed", "Not found or not in your records");
    return {
      reply: opts.pageConversationId
        ? "This conversation isn't linked to a Customer I can quote. Open the conversation and link a Customer first."
        : "I couldn't find that customer in your records.",
      status: "FAILED",
      blocks: [
        { type: "progress", steps: progress },
        {
          type: "status",
          kind: "error",
          message: opts.pageConversationId
            ? "This conversation isn't linked to a Customer I can quote."
            : "I couldn't find that customer in your records.",
        },
        {
          type: "actions",
          actions: opts.pageConversationId
            ? [{ label: "Open conversation", href: `/sales/inbox?conversation=${opts.pageConversationId}` }]
            : [{ label: "Cancel", prompt: "cancel" }],
        },
      ],
    };
  }
  if (customer.kind === "many") {
    return waiting("I found more than one matching customer. Which should I use?", "CUSTOMER", customer.choices ?? [], opts.intent, progress);
  }
  const cust = customer.value;
  progress[0] = step("customer", "Customer identified", "done", cust.name);

  const deals = await resolveDealsForCustomer({
    actor: opts.actor,
    leadId: cust.leadId,
    preferredDealId: opts.intent.dealReference?.id ?? opts.pageDealId ?? cust.dealId,
    page: {
      leadId: opts.pageLeadId,
      conversationId: opts.pageConversationId,
      dealId: opts.pageDealId,
      companyId: opts.pageCompanyId,
      customerId: opts.pageCustomerId,
    },
  });
  if (deals.kind === "none") {
    progress[1] = step("deal", "Deal identified", "failed", "No active Deal");
    return {
      reply: "This customer has no active Deal.",
      status: "WAITING_FOR_INPUT",
      blocks: [
        { type: "progress", steps: progress },
        { type: "status", kind: "partial", message: "This customer has no active Deal." },
        {
          type: "actions",
          actions: [
            { label: "Open Customer", href: `/sales/inbox?conversation=${cust.leadId}` },
            { label: "Cancel", prompt: "cancel" },
          ],
        },
      ],
    };
  }
  if (deals.kind === "many") {
    return waiting("Which Deal should this quotation belong to?", "DEAL", deals.choices ?? [], opts.intent, [
      ...progress.slice(0, 1),
      step("deal", "Deal identified", "running"),
      ...progress.slice(2),
    ]);
  }
  const deal = deals.value;
  progress[1] = step("deal", "Deal identified", "done", deal.name);

  let intentItems = opts.intent.items;
  if (opts.intent.upgrade) {
    intentItems = intentItems.map((it) => ({ ...it, type: "PRODUCT" as const }));
    if (intentItems.length === 0) {
      const prompt =
        "What products should I add for this system upgrade? Name quantities and products (e.g. 4 x 550W panels and 1 lithium battery).";
      return {
        reply: prompt,
        status: "WAITING_FOR_INPUT",
        pending: {
          kind: "REQUIREMENTS",
          prompt,
          options: [
            { id: "panels", entityType: "PRODUCT", title: "Solar panels" },
            { id: "battery", entityType: "PRODUCT", title: "Battery" },
            { id: "inverter", entityType: "PRODUCT", title: "Inverter" },
          ],
          intent: { ...opts.intent, upgrade: true, items: [] },
          progress: [
            ...progress.slice(0, 2),
            step("items", "Items resolved", "running"),
            ...progress.slice(3),
          ],
          extra: { upgradeItems: true },
        },
        blocks: [
          {
            type: "progress",
            steps: [
              ...progress.slice(0, 2),
              step("items", "Items resolved", "running"),
              ...progress.slice(3),
            ],
          },
          {
            type: "requirements",
            prompt,
            items: [
              { label: "Solar panels", quantity: null, status: "UNCERTAIN" },
              { label: "Batteries", quantity: null, status: "UNCERTAIN" },
              { label: "Other products", quantity: null, status: "UNCERTAIN" },
            ],
          },
          {
            type: "actions",
            actions: [
              { label: "Add panels + battery", prompt: "4 x panels and 1 battery", style: "primary" },
              { label: "Cancel", prompt: "cancel" },
            ],
          },
          { type: "status", kind: "partial", message: prompt },
        ],
        activeLeadId: cust.leadId,
        activeDealId: deal.id,
      };
    }
  }

  if ((opts.intent.extractFromConversation || intentItems.length === 0) && opts.flags.contextualExtraction) {
    const extraction = await loadConversationExtraction({ clientId: opts.actor.clientId, leadId: cust.leadId });
    if (intentItems.length === 0) {
      const uncertain = extraction.items.filter((i) => i.status === "UNCERTAIN");
      if (uncertain.length && !extraction.items.some((i) => i.status === "CONFIRMED")) {
        return {
          reply: "The customer mentioned possible quantities but did not confirm an order. I won't create a quotation from that yet.",
          status: "WAITING_FOR_INPUT",
          blocks: [
            {
              type: "requirements",
              prompt: "These items are uncertain. Confirm before I prepare a quotation.",
              items: extraction.items.map((i) => ({ label: i.label, quantity: i.quantity, status: i.status })),
              location: extraction.location,
            },
          ],
        };
      }
      const confirmed = extraction.items.filter((i) => i.status === "CONFIRMED" || i.status === "MENTIONED");
      if (!confirmed.length) {
        return {
          reply: "I need the items to quote. Name a Package or Product, or tell me to quote what the customer requested once it's clear.",
          status: "FAILED",
          blocks: [{ type: "status", kind: "partial", message: "I need the items to quote." }],
        };
      }
      if (opts.intent.extractFromConversation && !opts.selectedId) {
        return {
          reply: "I found these confirmed items in the conversation.",
          status: "WAITING_FOR_INPUT",
          blocks: [
            {
              type: "requirements",
              prompt: "I found these confirmed items in the conversation.",
              items: confirmed.map((i) => ({ label: i.label, quantity: i.quantity, status: i.status })),
              location: extraction.location,
            },
            {
              type: "actions",
              actions: [
                { label: "Prepare quotation", prompt: "Prepare quotation", style: "primary" },
                { label: "Cancel", prompt: "cancel" },
              ],
            },
          ],
          pending: {
            kind: "REQUIREMENTS",
            prompt: "Prepare quotation from these items?",
            options: [{ id: "prepare", entityType: "PRODUCT", title: "Prepare quotation" }],
            intent: {
              ...opts.intent,
              extractFromConversation: false,
              items: confirmed.map((i) => ({
                type: /package|kva/i.test(i.label) ? "PACKAGE" : "PRODUCT",
                query: i.label,
                quantity: i.quantity ?? 1,
              })),
            },
            progress,
          },
        };
      }
      intentItems = confirmed.map((i) => ({
        type: /package|kva/i.test(i.label) ? "PACKAGE" : "PRODUCT",
        query: i.label,
        quantity: i.quantity ?? 1,
      }));
    }
  }

  const itemResult = await resolveItemsOrWait({
    actor: opts.actor,
    items: intentItems,
    intent: { ...opts.intent, items: intentItems },
    progress,
  });
  if (!("ok" in itemResult) || itemResult.ok !== true) {
    return itemResult as CommandOutcome;
  }
  const resolved = itemResult.resolved;
  progress[2] = step("items", "Items resolved", "done", resolved.map((r) => r.catalog.name).join(", "));

  const built = await linesFromResolved(opts.actor, resolved);
  if (built.error || !built.lines.length) {
    progress[3] = step("pricing", "Current pricing loaded", "failed", built.error);
    return {
      reply: built.error || "I couldn't load current pricing for those items.",
      status: "FAILED",
      blocks: [
        { type: "progress", steps: progress },
        { type: "status", kind: "error", message: built.error || "I couldn't load current pricing." },
      ],
    };
  }
  progress[3] = step("pricing", "Current pricing loaded", "done");

  const invSettings = await getInventorySettings(opts.actor.clientId);
  const inventoryDetails: string[] = [];
  for (const row of resolved) {
    if (row.catalog.type === "PACKAGE") {
      const pkg = await getPackage(opts.actor.clientId, row.catalog.id, false);
      if ("availability" in pkg && pkg.availability) {
        const av = pkg.availability as { status?: string; reasons?: string[] };
        if (av.status && av.status !== "READY" && av.status !== "NOT_TRACKED") {
          inventoryDetails.push(`Package ${row.catalog.name}: ${av.status}${av.reasons?.length ? ` — ${av.reasons[0]}` : ""}`);
        }
      }
    } else if (hasCommercialPermission({ userId: opts.actor.userId, role: opts.actor.role, clientId: opts.actor.clientId }, "inventory.view")) {
      const avail = await getAvailability({
        clientId: opts.actor.clientId,
        productId: row.catalog.id,
        variantId: row.variantId,
      });
      if (!avail.trackInventory) {
        inventoryDetails.push(`${row.catalog.name}: not tracked`);
      } else if (avail.stale) {
        inventoryDetails.push(
          `${row.catalog.name}: availability needs confirmation. Last inventory sync: ${avail.lastSyncedAt ?? invSettings.lastSyncAt ?? "unknown"}`
        );
      } else if (row.item.quantity > avail.available) {
        inventoryDetails.push(`${row.catalog.name}: requested ${row.item.quantity}, available ${avail.available}`);
      }
    }
  }
  progress[4] = step("inventory", "Inventory checked", "done", inventoryDetails[0]);

  const learned = await learningNotesFor({
    clientId: opts.actor.clientId,
    command: opts.commandText,
  });

  const supabase = createAdminClient();
  const settings = await ensureQuotationSettings(supabase, opts.actor.clientId);
  const templatePick = await pickTemplate(opts.actor.clientId);
  if (templatePick.wait) return templatePick.wait;

  let taxRate = Number(settings.default_tax_rate) || 0;
  let otherAmount = 0;
  let paymentTerms = (settings.default_payment_terms as string | null)?.trim() || null;
  let validDays = settings.default_validity_days != null ? Number(settings.default_validity_days) : 14;
  if (opts.intent.validityDays) validDays = opts.intent.validityDays;
  let notes: string | null = opts.intent.note ?? null;
  let terms: string | null = (settings.default_terms as string | null) ?? null;
  const templateId: string | null = templatePick.id;
  let templateLayoutKey: string | null = null;
  let templateLayoutVersion: number | null = null;
  if (templateId) {
    const template = await loadTemplateWithItems(supabase, templateId);
    if (template && template.client_id === opts.actor.clientId) {
      templateLayoutKey = (template.layout_key as string | null) ?? null;
      templateLayoutVersion = template.layout_version == null ? null : Number(template.layout_version);
      const builtin = isBuiltinQuoteTemplate(template as { is_builtin?: boolean; builtin_key?: string | null });
      if (!builtin) {
        taxRate = Number(template.tax_rate) || taxRate;
        otherAmount = Number(template.other_amount) || 0;
        notes = (template.notes as string | null) ?? notes;
        terms = (template.terms as string | null) ?? terms;
        validDays = Number(template.valid_for_days) || validDays;
        paymentTerms = ((template.payment_terms_label as string | null) ?? "").trim() || paymentTerms;
      } else if (!paymentTerms) {
        // Company default missing: still inherit payment label from the active (builtin) template
        // so Command Center drafts are not blocked on "Payment terms missing".
        paymentTerms = ((template.payment_terms_label as string | null) ?? "").trim() || null;
      }
    }
  }

  if (opts.intent.upgrade) {
    notes = upgradeNotesFor(opts.intent, notes);
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("name, phone, email")
    .eq("id", cust.leadId)
    .eq("client_id", opts.actor.clientId)
    .maybeSingle();

  const quoteNumber = await allocateQuoteNumber(supabase, opts.actor.clientId);
  const validUntil = format(addDays(new Date(), validDays > 0 ? validDays : 14), "yyyy-MM-dd");
  const insertPayload: Record<string, unknown> = {
    client_id: opts.actor.clientId,
    lead_id: cust.leadId,
    deal_id: deal.id,
    quote_number: quoteNumber,
    status: "draft",
    customer_name: (lead?.name as string | null) ?? cust.name,
    customer_phone: (lead?.phone as string | null) ?? null,
    customer_email: (lead?.email as string | null) ?? null,
    tax_rate: taxRate,
    other_amount: otherAmount,
    discount_percent: opts.intent.discountPercent ?? 0,
    currency: (settings.default_currency as string) || "USD",
    valid_until: validUntil,
    notes,
    terms,
    payment_terms_label: paymentTerms,
    prepared_by_id: opts.actor.userId,
    prepared_by_name: opts.actor.name,
    revision_number: 1,
    template_id: templateId,
    template_layout_key: templateLayoutKey,
    template_layout_version: templateLayoutVersion,
    template_fields: {},
    creation_source: "SALES_AGENT",
  };

  const { data: created, error } = await supabase.from("quotations").insert(insertPayload).select("*").single();
  if (error || !created) {
    const { data: legacy, error: legacyErr } = await supabase
      .from("quotations")
      .insert({
        client_id: insertPayload.client_id,
        lead_id: insertPayload.lead_id,
        deal_id: insertPayload.deal_id,
        quote_number: insertPayload.quote_number,
        status: "draft",
        customer_name: insertPayload.customer_name,
        customer_phone: insertPayload.customer_phone,
        customer_email: insertPayload.customer_email,
        tax_rate: insertPayload.tax_rate,
        other_amount: insertPayload.other_amount,
        currency: insertPayload.currency,
        valid_until: insertPayload.valid_until,
        notes: insertPayload.notes,
        terms: insertPayload.terms,
        payment_terms_label: insertPayload.payment_terms_label,
        prepared_by_id: insertPayload.prepared_by_id,
        prepared_by_name: insertPayload.prepared_by_name,
        revision_number: 1,
      })
      .select("*")
      .single();
    if (legacyErr || !legacy) {
      progress[5] = step("draft", "Draft created", "failed");
      return {
        reply: "I couldn't create the quotation. No quotation was created.",
        status: "FAILED",
        blocks: [
          { type: "progress", steps: progress },
          { type: "status", kind: "error", message: "I couldn't create the quotation. No quotation was created." },
          { type: "actions", actions: [{ label: "Retry", prompt: opts.commandText }] },
        ],
      };
    }
    return finalizeCreated({
      actor: opts.actor,
      created: legacy as Record<string, unknown>,
      lines: built.lines,
      taxRate,
      otherAmount,
      discountPercent: Number(opts.intent.discountPercent) || 0,
      deal,
      cust,
      progress,
      inventoryDetails,
      learned,
      sendRequested: Boolean(opts.intent.sendRequested),
      quoteNumber,
    });
  }

  return finalizeCreated({
    actor: opts.actor,
    created: created as Record<string, unknown>,
    lines: built.lines,
    taxRate,
    otherAmount,
    discountPercent: Number(opts.intent.discountPercent) || 0,
    deal,
    cust,
    progress,
    inventoryDetails,
    learned,
    sendRequested: Boolean(opts.intent.sendRequested),
    quoteNumber,
  });
}

async function finalizeCreated(opts: {
  actor: SalesActor;
  created: Record<string, unknown>;
  lines: QuotationLineItemInput[];
  taxRate: number;
  otherAmount: number;
  discountPercent: number;
  deal: ResolvedDeal;
  cust: ResolvedCustomer;
  progress: ProgressStep[];
  inventoryDetails: string[];
  learned: string[];
  sendRequested: boolean;
  quoteNumber: string;
}): Promise<CommandOutcome> {
  const supabase = createAdminClient();
  try {
    await saveItemsAndTotals(supabase, opts.created.id as string, opts.lines, opts.taxRate, opts.otherAmount, {
      discountPercent: opts.discountPercent,
    });
  } catch {
    await supabase.from("quotations").delete().eq("id", opts.created.id as string).eq("status", "draft");
    opts.progress[5] = step("draft", "Draft created", "failed");
    return {
      reply: "I couldn't create the quotation. No quotation was created.",
      status: "FAILED",
      blocks: [
        { type: "progress", steps: opts.progress },
        { type: "status", kind: "error", message: "I couldn't create the quotation. No quotation was created." },
      ],
    };
  }

  await logQuotationEvent(supabase, {
    quotationId: opts.created.id as string,
    clientId: opts.actor.clientId,
    leadId: opts.cust.leadId,
    dealId: opts.deal.id,
    actor: { id: opts.actor.userId, name: opts.actor.name },
    eventType: "CREATED",
    eventData: {
      quote_number: opts.quoteNumber,
      prepared_by: "SEGMIQ_AGENT",
      requested_by: opts.actor.name,
      requested_by_id: opts.actor.userId,
      source: "SALES_AGENT",
      creation_source: "SALES_AGENT",
    },
  });
  await logLeadEvent({
    leadId: opts.cust.leadId,
    clientId: opts.actor.clientId,
    actor: { id: opts.actor.userId, name: opts.actor.name, role: opts.actor.role },
    eventType: "NOTE_ADDED",
    eventData: {
      note: `Quotation ${opts.quoteNumber} prepared by SegmiQ Agent. Requested by ${opts.actor.name}.`,
      agent: true,
      source: "SALES_AGENT",
    },
  });

  const full = await loadQuotationWithItems(supabase, opts.created.id as string);
  if (!full) {
    opts.progress[5] = step("draft", "Draft created", "failed");
    return {
      reply: "I couldn't create the quotation. No quotation was created.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "error", message: "I couldn't create the quotation. No quotation was created." }],
    };
  }
  opts.progress[5] = step("draft", "Draft created", "done", opts.quoteNumber);
  const evaluation = await evaluateDraft(opts.actor.clientId, full, opts.actor);
  opts.progress[6] = step("check", "Commercial Check complete", "done", evaluation.check.approvalRequired ? "Approval required" : undefined);

  const preview = await buildPreview({
    quote: full,
    customerName: opts.cust.name,
    dealName: opts.deal.name,
    check: evaluation.check,
    inventoryNotes: [...opts.inventoryDetails, ...evaluation.inventoryNotes],
    learningNotes: opts.learned,
    sendRequested: opts.sendRequested,
  });

  const reply = opts.sendRequested
    ? `I've prepared the quotation. Please review it before sending.\n\n${opts.quoteNumber}\n${opts.cust.name}\n${formatSalesMoney(preview.total, preview.currency)}`
    : `Quotation prepared.\n\n${opts.quoteNumber}\n${opts.cust.name}\n${formatSalesMoney(preview.total, preview.currency)}\n\nCommercial Check: ${preview.commercialCheck.readyLabel}`;

  const blocks: SalesBlock[] = [
    { type: "progress", steps: opts.progress },
    { type: "quotation_draft", preview },
    { type: "commercial_check", check: preview.commercialCheck },
  ];
  if (opts.learned[0]) {
    blocks.push({
      type: "learning",
      title: "Sales guidance used",
      body: opts.learned[0],
    });
  }
  if (opts.sendRequested) {
    blocks.unshift({
      type: "status",
      kind: "done",
      message: "I've prepared the quotation. Please review it before sending.",
    });
  }
  blocks.push({
    type: "actions",
    actions: [
      { label: "View quotation", href: preview.href, style: "primary" },
      { label: "Discard Draft", prompt: `Discard draft ${opts.quoteNumber}`, style: "danger" },
    ],
  });

  return {
    reply,
    blocks,
    status: "COMPLETED",
    activeLeadId: opts.cust.leadId,
    activeDealId: opts.deal.id,
    activeQuotationId: full.id as string,
    quotationId: full.id as string,
  };
}

export async function runUpdateDraft(opts: {
  actor: SalesActor;
  intent: SalesIntent;
  quotationId: string;
  expectedUpdatedAt?: string | null;
  flags: { quotationUpdate: boolean };
  commandText: string;
}): Promise<CommandOutcome> {
  if (!opts.flags.quotationUpdate) {
    return {
      reply: "Draft update commands are not enabled.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "denied", message: "Draft update commands are not enabled." }],
    };
  }
  const supabase = createAdminClient();
  const current = await loadQuotationWithItems(supabase, opts.quotationId);
  if (!current || current.client_id !== opts.actor.clientId) {
    return {
      reply: "I couldn't find that quotation.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "error", message: "I couldn't find that quotation." }],
    };
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("assigned_to_id")
    .eq("id", current.lead_id as string)
    .maybeSingle();
  if (lead && lead.assigned_to_id !== opts.actor.userId && opts.actor.role === "SALESPERSON") {
    return {
      reply: "You don't have access to that quotation.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "denied", message: "You don't have access to that quotation." }],
    };
  }

  if (opts.expectedUpdatedAt && String(current.updated_at) !== opts.expectedUpdatedAt) {
    return {
      reply: "The quotation changed while I was preparing the update. I've refreshed the current Draft—please confirm the change again.",
      status: "WAITING_FOR_INPUT",
      blocks: [
        {
          type: "status",
          kind: "partial",
          message: "The quotation changed while I was preparing the update. I've refreshed the current Draft—please confirm the change again.",
        },
        { type: "actions", actions: [{ label: "View quotation", href: `/sales/quotes/${opts.quotationId}`, style: "primary" }] },
      ],
    };
  }

  if (!isQuotationEditable(String(current.status))) {
    const { data: source } = await supabase
      .from("quotations")
      .select("id, status, revision_number, superseded_by_id, lead_id")
      .eq("id", opts.quotationId)
      .maybeSingle();
    if (!source || source.superseded_by_id) {
      return {
        reply: "This quotation cannot be changed. Create a revision from the quotation page.",
        status: "FAILED",
        blocks: [{ type: "status", kind: "blocked", message: "This quotation cannot be changed." }],
      };
    }
    const copied = await copyQuotationAsDraft(supabase, {
      sourceQuotationId: opts.quotationId,
      targetLeadId: source.lead_id as string,
      clientId: opts.actor.clientId,
      actor: { id: opts.actor.userId, name: opts.actor.name },
      parentQuotationId: opts.quotationId,
      revisionNumber: (Number(source.revision_number) || 1) + 1,
    });
    if (!copied) {
      return {
        reply: "I couldn't create a revision. The sent quotation was not changed.",
        status: "FAILED",
        blocks: [{ type: "status", kind: "error", message: "I couldn't create a revision. The sent quotation was not changed." }],
      };
    }
    return runUpdateDraft({ ...opts, quotationId: copied.id });
  }

  const items = ((current.items as QuotationLineItemInput[]) ?? []).slice();
  if (opts.intent.items.length) {
    const itemResult = await resolveItemsOrWait({
      actor: opts.actor,
      items: opts.intent.items,
      intent: opts.intent,
      progress: [step("items", "Items resolved", "running")],
    });
    if (!("ok" in itemResult) || itemResult.ok !== true) return itemResult as CommandOutcome;
    const built = await linesFromResolved(opts.actor, itemResult.resolved);
    if (built.error) {
      return {
        reply: built.error,
        status: "FAILED",
        blocks: [{ type: "status", kind: "error", message: built.error }],
      };
    }
    for (const add of built.lines) {
      const existing = items.find(
        (it) =>
          it.product_id &&
          add.product_id &&
          it.product_id === add.product_id &&
          (it.variant_id ?? null) === (add.variant_id ?? null) &&
          !it.package_id
      );
      if (existing && add.product_id) {
        existing.quantity = (Number(existing.quantity) || 0) + (Number(add.quantity) || 0);
      } else {
        items.push(add);
      }
    }
  }

  const taxRate = Number(current.tax_rate) || 0;
  const otherAmount = Number(current.other_amount) || 0;
  const discountPercent =
    opts.intent.discountPercent != null ? opts.intent.discountPercent : Number(current.discount_percent) || 0;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (opts.intent.validityDays) {
    patch.valid_until = format(addDays(new Date(), opts.intent.validityDays), "yyyy-MM-dd");
  }
  const latest = await loadQuotationWithItems(supabase, opts.quotationId);
  if (!latest || String(latest.updated_at) !== String(current.updated_at)) {
    return {
      reply: "The quotation changed while I was preparing the update. I've refreshed the current Draft—please confirm the change again.",
      status: "WAITING_FOR_INPUT",
      blocks: [
        {
          type: "status",
          kind: "partial",
          message:
            "The quotation changed while I was preparing the update. I've refreshed the current Draft—please confirm the change again.",
        },
        { type: "actions", actions: [{ label: "View quotation", href: `/sales/quotes/${opts.quotationId}`, style: "primary" }] },
      ],
      activeQuotationId: opts.quotationId,
    };
  }
  await supabase.from("quotations").update(patch).eq("id", opts.quotationId);
  await saveItemsAndTotals(supabase, opts.quotationId, items, taxRate, otherAmount, { discountPercent });

  const full = await loadQuotationWithItems(supabase, opts.quotationId);
  if (!full) {
    return {
      reply: "The draft could not be reloaded.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "error", message: "The draft could not be reloaded." }],
    };
  }
  const evaluation = await evaluateDraft(opts.actor.clientId, full, opts.actor);
  const deal = full.deal_id ? await loadAccessibleDeal(opts.actor, full.deal_id as string, true) : null;
  const preview = await buildPreview({
    quote: full,
    customerName: (full.customer_name as string) || "Customer",
    dealName: deal?.name ?? null,
    check: evaluation.check,
    inventoryNotes: evaluation.inventoryNotes,
    learningNotes: [],
    sendRequested: false,
  });
  return {
    reply: `Draft updated.\n\n${preview.quoteNumber}\n${formatSalesMoney(preview.total, preview.currency)}`,
    status: "COMPLETED",
    activeQuotationId: opts.quotationId,
    quotationId: opts.quotationId,
    blocks: [
      { type: "quotation_draft", preview },
      { type: "commercial_check", check: preview.commercialCheck },
      {
        type: "actions",
        actions: [{ label: "View quotation", href: preview.href, style: "primary" }],
      },
    ],
  };
}

export async function runCopyLast(opts: {
  actor: SalesActor;
  leadId: string;
  commandText: string;
  confirmed?: boolean;
}): Promise<CommandOutcome> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("quotations")
    .select("id, quote_number, status, total, currency, sent_at, created_at, customer_name")
    .eq("client_id", opts.actor.clientId)
    .eq("lead_id", opts.leadId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1);
  const row = asRows<{
    id: string;
    quote_number: string | null;
    status: string;
    total: number | null;
    sent_at: string | null;
    created_at: string;
    customer_name: string | null;
  }>(data)[0];
  if (!row) {
    return {
      reply: "I couldn't find a previous quotation for this customer.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "error", message: "I couldn't find a previous quotation for this customer." }],
    };
  }
  if (!opts.confirmed) {
    const when = row.sent_at ? format(new Date(row.sent_at), "d MMM") : format(new Date(row.created_at), "d MMM");
    return {
      reply: `I found ${row.quote_number ?? "a quotation"} (${row.status}${row.sent_at ? `, sent ${when}` : ""}). Use this as the basis for a new Draft?`,
      status: "WAITING_FOR_INPUT",
      blocks: [
        {
          type: "choice",
          kind: "QUOTATION",
          prompt: `I found ${row.quote_number ?? "a quotation"}. Use this as the basis for a new Draft?`,
          options: [
            {
              id: row.id,
              entityType: "QUOTATION",
              title: row.quote_number || "Quotation",
              subtitle: row.customer_name,
              status: row.status,
            },
          ],
        },
      ],
      pending: {
        kind: "COPY_CONFIRM",
        prompt: "Use this as the basis for a new Draft?",
        options: [{ id: row.id, entityType: "QUOTATION", title: row.quote_number || "Quotation" }],
        intent: { intent: "COPY_LAST_QUOTATION", items: [], copyLast: true, customerReference: { source: "CURRENT_CONTEXT" } },
        progress: [],
        extra: { sourceQuotationId: row.id, leadId: opts.leadId },
      },
    };
  }
  const copied = await copyQuotationAsDraft(supabase, {
    sourceQuotationId: row.id,
    targetLeadId: opts.leadId,
    clientId: opts.actor.clientId,
    actor: { id: opts.actor.userId, name: opts.actor.name },
    allocateNewNumber: true,
  });
  if (!copied) {
    return {
      reply: "I couldn't copy that quotation. The original was not changed.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "error", message: "I couldn't copy that quotation. The original was not changed." }],
    };
  }
  await supabase.from("quotations").update({ creation_source: "SALES_AGENT" }).eq("id", copied.id);
  const full = await loadQuotationWithItems(supabase, copied.id);
  if (!full) {
    return {
      reply: "Draft copy was created but could not be loaded.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "error", message: "Draft copy was created but could not be loaded." }],
    };
  }
  const evaluation = await evaluateDraft(opts.actor.clientId, full, opts.actor);
  const preview = await buildPreview({
    quote: full,
    customerName: (full.customer_name as string) || "Customer",
    dealName: null,
    check: evaluation.check,
    inventoryNotes: evaluation.inventoryNotes,
    learningNotes: [],
    sendRequested: false,
  });
  return {
    reply: `New Draft created from ${row.quote_number}. The previous quotation was not changed.`,
    status: "COMPLETED",
    activeQuotationId: copied.id,
    quotationId: copied.id,
    blocks: [
      { type: "quotation_draft", preview },
      { type: "actions", actions: [{ label: "View quotation", href: preview.href, style: "primary" }] },
    ],
  };
}

export async function discardDraft(opts: { actor: SalesActor; quotationId: string }): Promise<CommandOutcome> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("quotations")
    .select("id, status, lead_id, quote_number, client_id")
    .eq("id", opts.quotationId)
    .eq("client_id", opts.actor.clientId)
    .maybeSingle();
  const row = asRow<{ id: string; status: string; lead_id: string; quote_number: string | null }>(data);
  if (!row) {
    return {
      reply: "Quotation not found.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "error", message: "Quotation not found." }],
    };
  }
  if (row.status !== "draft") {
    return {
      reply: "Only Draft quotations can be discarded.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "blocked", message: "Only Draft quotations can be discarded." }],
    };
  }
  const { data: lead } = await supabase.from("leads").select("assigned_to_id").eq("id", row.lead_id).maybeSingle();
  if (lead && lead.assigned_to_id !== opts.actor.userId && opts.actor.role === "SALESPERSON") {
    return {
      reply: "You don't have access to that quotation.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "denied", message: "You don't have access to that quotation." }],
    };
  }
  const { error } = await supabase.from("quotations").delete().eq("id", row.id);
  if (error) {
    return {
      reply: "I couldn't discard the Draft.",
      status: "FAILED",
      blocks: [{ type: "status", kind: "error", message: "I couldn't discard the Draft." }],
    };
  }
  return {
    reply: `${row.quote_number ?? "Draft"} discarded.`,
    status: "COMPLETED",
    activeQuotationId: null,
    blocks: [{ type: "status", kind: "done", message: `${row.quote_number ?? "Draft"} discarded.` }],
  };
}

export { catalogChoice };
