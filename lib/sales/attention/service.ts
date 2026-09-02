/**
 * SalesAttentionService — deterministic Today's Focus queue.
 *
 * Architecture:
 *   Proactive Event Agent → reason to reevaluate
 *   Sales Attention Engine → what needs attention now (this module)
 *   Sales Agent → summarize / draft / execute
 *
 * Candidates from Daily Plan + structured commitments.
 * Projections persisted to sales_attention_items (not a parallel CRM).
 */

import {
  fetchDailySalesPlan,
  mutateActionState,
} from "@/lib/sales/intelligence/daily-plan-service";
import { listOpenCommitments, type SalesCommitment } from "./commitments";
import { salesAttentionFlags } from "./flags";
import { mapRecommendationToAttentionItem, summarizeAttentionCounts } from "./map-from-plan";
import { emitAttentionEvent } from "./observability";
import {
  reconcileAttentionProjections,
  updateAttentionProjectionState,
} from "./persistence";
import { compareAttentionItems, priorityClassForAttention } from "./priority";
import type {
  AttentionDismissReason,
  AttentionFlags,
  FocusAction,
  SalesAttentionItem,
  TodaysFocusPayload,
} from "./types";

function formatRefreshedLabel(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16);
  }
}

function commitmentToAttentionItem(opts: {
  commitment: SalesCommitment;
  companyId: string;
  salespersonId: string;
  now: Date;
}): SalesAttentionItem {
  const c = opts.commitment;
  const overdue = c.dueAt ? Date.parse(c.dueAt) < opts.now.getTime() : false;
  const type =
    c.committedBy === "CUSTOMER"
      ? overdue
        ? "CUSTOMER_COMMITMENT_DUE"
        : "CUSTOMER_COMMITMENT_DUE"
      : "SALESPERSON_COMMITMENT_DUE";
  const priorityClass = overdue
    ? priorityClassForAttention("FOLLOWUP_OVERDUE")
    : priorityClassForAttention("CUSTOMER_COMMITMENT_DUE");

  const whyNow =
    c.committedBy === "CUSTOMER"
      ? overdue
        ? `Customer commitment is overdue: ${c.description}`
        : `Customer asked to be contacted as agreed: ${c.description}`
      : overdue
        ? `Your commitment is overdue: ${c.description}`
        : `You committed to this: ${c.description}`;

  const actions: FocusAction[] = [
    {
      kind: "draft_message",
      label: "Draft message",
      prompt: "Draft a follow-up message for this customer.",
      primary: true,
    },
  ];
  if (c.leadId) {
    actions.push({
      kind: "open_whatsapp",
      label: "Open WhatsApp",
      href: `/sales/whatsapp?lead=${c.leadId}`,
    });
  }
  if (c.dealId) {
    actions.push({
      kind: "view_deal",
      label: "View Deal",
      href: `/sales/deals/${c.dealId}`,
    });
  }
  actions.push({ kind: "snooze", label: "Snooze" }, { kind: "done", label: "Done" });

  return {
    id: `commitment:${c.id}`,
    fingerprint: `commitment:${c.fingerprint}`,
    companyId: opts.companyId,
    salespersonId: opts.salespersonId,
    type,
    priorityClass,
    internalScore: overdue ? 92 : 78,
    title: c.description.slice(0, 80),
    subtitle: c.committedBy === "CUSTOMER" ? "Customer commitment" : "Your commitment",
    reasonCode: overdue ? "FOLLOWUP_OVERDUE" : "PROMISED_FOLLOWUP",
    reasonSummary: whyNow,
    whyNow,
    suggestedActionType: "FOLLOW_UP",
    suggestedActionSummary:
      c.committedBy === "CUSTOMER"
        ? "Follow up as the customer requested."
        : "Complete what you promised the customer.",
    customerName: null,
    leadId: c.leadId,
    dealId: c.dealId,
    conversationId: c.leadId,
    quotationId: null,
    quotationLabel: null,
    taskId: null,
    appointmentId: null,
    dealStage: null,
    projectType: null,
    phone: null,
    dueAt: c.dueAt,
    waitingMinutes: null,
    inactivityDays: null,
    state: "OPEN",
    snoozedUntil: null,
    actions,
    availableContactActions: c.leadId ? ["whatsapp", "open_lead"] : ["open_lead"],
    sourceActionType: "COMPLETE_FOLLOW_UP",
    metadata: {
      commitmentId: c.id,
      committedBy: c.committedBy,
      sourceMessageExcerpt: c.sourceMessageExcerpt,
    },
  };
}

function mergeFocusItems(a: SalesAttentionItem[], b: SalesAttentionItem[]): SalesAttentionItem[] {
  const byKey = new Map<string, SalesAttentionItem>();
  for (const item of [...a, ...b]) {
    const entityKey = `${item.type}:${item.dealId ?? item.leadId ?? item.fingerprint}`;
    const prev = byKey.get(entityKey);
    if (!prev || item.internalScore > prev.internalScore) {
      byKey.set(entityKey, item);
    }
  }
  return [...byKey.values()].sort(compareAttentionItems);
}

export async function getTodaysFocus(opts: {
  userId: string;
  clientId: string;
  now?: Date;
  filter?: "ALL" | "IMMEDIATE" | "TODAY" | "NEEDS_PROGRESS" | "WATCH";
  limit?: number;
  /** Persist projections + emit candidate metrics (default true). */
  reconcile?: boolean;
  /** Attach LLM summaries for top N items (default 0 for list; 3 when enriching). */
  enrichTop?: number;
}): Promise<TodaysFocusPayload> {
  const flags = salesAttentionFlags();
  if (!flags.enabled) {
    return emptyPayload({
      planError: false,
      emptyMessage: "Today's Focus is not enabled for this workspace.",
    });
  }

  const now = opts.now ?? new Date();

  try {
    const [plan, commitments] = await Promise.all([
      fetchDailySalesPlan({
        userId: opts.userId,
        clientId: opts.clientId,
        now,
      }),
      listOpenCommitments({
        clientId: opts.clientId,
        salespersonId: opts.userId,
        dueBefore: new Date(now.getTime() + 24 * 3600_000).toISOString(),
      }),
    ]);

    const fromPlan: SalesAttentionItem[] = plan.queue.map((rec) =>
      mapRecommendationToAttentionItem({
        rec,
        companyId: opts.clientId,
        salespersonId: opts.userId,
      })
    );

    const fromCommitments = commitments
      .filter((c) => {
        if (!c.dueAt) return false;
        const due = Date.parse(c.dueAt);
        // Due today or overdue
        return Number.isFinite(due) && due <= now.getTime() + 24 * 3600_000;
      })
      .map((c) =>
        commitmentToAttentionItem({
          commitment: c,
          companyId: opts.clientId,
          salespersonId: opts.userId,
          now,
        })
      );

    let items = mergeFocusItems(fromPlan, fromCommitments);

    if (opts.reconcile !== false) {
      void reconcileAttentionProjections({
        clientId: opts.clientId,
        salespersonId: opts.userId,
        items,
      }).catch(() => undefined);
      void emitAttentionEvent({
        clientId: opts.clientId,
        salespersonId: opts.userId,
        eventType: "sales_attention.candidates_generated",
        payload: { total: items.length },
      });
    }

    const fullSummary = summarizeAttentionCounts(items);

    if (opts.filter && opts.filter !== "ALL") {
      items = items.filter((i) => i.priorityClass === opts.filter);
    }
    if (opts.limit != null && opts.limit > 0) {
      items = items.slice(0, opts.limit);
    }

    if (opts.enrichTop && opts.enrichTop > 0) {
      const { enrichFocusItem } = await import("./enrichment");
      const top = items.slice(0, opts.enrichTop);
      await Promise.all(
        top.map(async (item, idx) => {
          if (!item.leadId) return;
          const summary = await enrichFocusItem({
            clientId: opts.clientId,
            salespersonId: opts.userId,
            leadId: item.leadId,
            dealId: item.dealId,
            context: {
              projectType: item.projectType,
              dealStage: item.dealStage,
              quoteLabel: item.quotationLabel,
              whyNow: item.whyNow,
              nextActionLabel: item.suggestedActionSummary,
            },
          });
          if (summary) {
            items[idx] = {
              ...item,
              metadata: {
                ...item.metadata,
                enrichment: summary,
                lastDiscussion: summary.customerPosition ?? summary.whatHappened,
              },
            };
          }
        })
      );
    }

    const empty = items.length === 0;
    return {
      generatedAt: plan.generatedAt,
      planDate: plan.planDate,
      timezone: plan.timezone,
      lastRefreshedLabel: formatRefreshedLabel(plan.generatedAt, plan.timezone),
      summary: fullSummary,
      items,
      nextBest: items[0] ?? null,
      empty,
      emptyMessage: empty
        ? "You're clear for now. There are no overdue follow-ups, waiting customers, or active Deals requiring immediate action."
        : null,
      planError: false,
      focusModeTitle: plan.focus?.title ?? null,
      queueVersion: `${plan.planDate}:${plan.generatedAt}:${fullSummary.total}`,
    };
  } catch {
    return emptyPayload({
      planError: true,
      emptyMessage: "Today's Focus couldn't be refreshed. Your CRM records are unchanged.",
    });
  }
}

function emptyPayload(opts: {
  planError: boolean;
  emptyMessage: string;
}): TodaysFocusPayload {
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    planDate: generatedAt.slice(0, 10),
    timezone: "UTC",
    lastRefreshedLabel: "",
    summary: { total: 0, immediate: 0, today: 0, needsProgress: 0, watch: 0 },
    items: [],
    nextBest: null,
    empty: true,
    emptyMessage: opts.emptyMessage,
    planError: opts.planError,
    focusModeTitle: null,
    queueVersion: generatedAt,
  };
}

export async function getAttentionItem(opts: {
  userId: string;
  clientId: string;
  itemId: string;
}): Promise<SalesAttentionItem | null> {
  const focus = await getTodaysFocus({ ...opts, enrichTop: 1 });
  return focus.items.find((i) => i.id === opts.itemId || i.fingerprint === opts.itemId) ?? null;
}

export async function completeAttentionItem(opts: {
  userId: string;
  clientId: string;
  item: Pick<
    SalesAttentionItem,
    "fingerprint" | "sourceActionType" | "reasonCode" | "leadId" | "dealId" | "metadata"
  > & { sourceEntityType?: string };
  planDate: string;
}): Promise<void> {
  await mutateActionState({
    clientId: opts.clientId,
    salespersonId: opts.userId,
    planDate: opts.planDate,
    idempotencyKey: opts.item.fingerprint,
    actionType: opts.item.sourceActionType ?? "MANUAL_TASK",
    reasonCode: String(opts.item.reasonCode),
    sourceEntityType: opts.item.dealId ? "deal" : opts.item.leadId ? "lead" : "none",
    sourceEntityId: opts.item.dealId ?? opts.item.leadId ?? null,
    state: "completed",
    metadata: opts.item.metadata,
  });
  const attentionItemId = await updateAttentionProjectionState({
    clientId: opts.clientId,
    salespersonId: opts.userId,
    fingerprint: opts.item.fingerprint,
    state: "COMPLETED",
  });
  await emitAttentionEvent({
    clientId: opts.clientId,
    salespersonId: opts.userId,
    attentionItemId,
    eventType: "sales_attention.item_completed",
    payload: { fingerprint: opts.item.fingerprint },
  });
}

export async function snoozeAttentionItem(opts: {
  userId: string;
  clientId: string;
  item: Pick<
    SalesAttentionItem,
    "fingerprint" | "sourceActionType" | "reasonCode" | "leadId" | "dealId" | "metadata"
  >;
  planDate: string;
  snoozedUntil: string;
}): Promise<void> {
  await mutateActionState({
    clientId: opts.clientId,
    salespersonId: opts.userId,
    planDate: opts.planDate,
    idempotencyKey: opts.item.fingerprint,
    actionType: opts.item.sourceActionType ?? "MANUAL_TASK",
    reasonCode: String(opts.item.reasonCode),
    sourceEntityType: opts.item.dealId ? "deal" : opts.item.leadId ? "lead" : "none",
    sourceEntityId: opts.item.dealId ?? opts.item.leadId ?? null,
    state: "snoozed",
    snoozedUntil: opts.snoozedUntil,
    metadata: opts.item.metadata,
  });
  const attentionItemId = await updateAttentionProjectionState({
    clientId: opts.clientId,
    salespersonId: opts.userId,
    fingerprint: opts.item.fingerprint,
    state: "SNOOZED",
    snoozedUntil: opts.snoozedUntil,
  });
  await emitAttentionEvent({
    clientId: opts.clientId,
    salespersonId: opts.userId,
    attentionItemId,
    eventType: "sales_attention.item_snoozed",
    payload: { fingerprint: opts.item.fingerprint, snoozedUntil: opts.snoozedUntil },
  });
}

export async function dismissAttentionItem(opts: {
  userId: string;
  clientId: string;
  item: Pick<
    SalesAttentionItem,
    "fingerprint" | "sourceActionType" | "reasonCode" | "leadId" | "dealId" | "metadata"
  >;
  planDate: string;
  reason?: AttentionDismissReason | string | null;
}): Promise<void> {
  await mutateActionState({
    clientId: opts.clientId,
    salespersonId: opts.userId,
    planDate: opts.planDate,
    idempotencyKey: opts.item.fingerprint,
    actionType: opts.item.sourceActionType ?? "MANUAL_TASK",
    reasonCode: String(opts.item.reasonCode),
    sourceEntityType: opts.item.dealId ? "deal" : opts.item.leadId ? "lead" : "none",
    sourceEntityId: opts.item.dealId ?? opts.item.leadId ?? null,
    state: "skipped",
    skipReason: opts.reason ?? "NOT_RELEVANT",
    metadata: { ...opts.item.metadata, dismissReason: opts.reason ?? "OTHER" },
  });
  const attentionItemId = await updateAttentionProjectionState({
    clientId: opts.clientId,
    salespersonId: opts.userId,
    fingerprint: opts.item.fingerprint,
    state: "DISMISSED",
    dismissReason: opts.reason ?? "OTHER",
  });
  await emitAttentionEvent({
    clientId: opts.clientId,
    salespersonId: opts.userId,
    attentionItemId,
    eventType: "sales_attention.item_dismissed",
    payload: { fingerprint: opts.item.fingerprint, reason: opts.reason ?? "OTHER" },
  });
}

/** Resolve snooze presets in company timezone context (ISO out). */
export function resolveSnoozeUntil(
  preset: "later_today" | "tomorrow" | "next_business_day" | "custom",
  opts?: { now?: Date; customIso?: string }
): string {
  const now = opts?.now ?? new Date();
  if (preset === "custom" && opts?.customIso) return opts.customIso;
  if (preset === "later_today") {
    return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
  }
  if (preset === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function getSalesAttentionFlags(): AttentionFlags {
  return salesAttentionFlags();
}
