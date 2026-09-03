import { z } from "zod";
import {
  FUTURE_SALES_INTENTS,
  ITEM_TYPES,
  SALES_INTENTS,
  type SalesIntent,
  type SalesIntentItem,
  type SalesPageContext,
} from "./types";

const itemSchema = z.object({
  type: z.enum(ITEM_TYPES),
  query: z.string().min(1).max(160),
  quantity: z.number().positive().max(100_000),
  variantQuery: z.string().max(80).optional(),
  variantAllocations: z
    .array(
      z.object({
        variantQuery: z.string().min(1).max(80),
        variantId: z.string().uuid().optional(),
        quantity: z.number().positive().max(100_000),
      })
    )
    .max(40)
    .optional(),
  id: z.string().uuid().optional(),
});

const refSchema = z.object({
  source: z.enum(["CURRENT_CONTEXT", "SEARCH", "ID", "SELECTED"]),
  query: z.string().max(120).optional(),
  id: z.string().uuid().optional(),
});

export const salesIntentSchema = z.object({
  intent: z.enum([...SALES_INTENTS, ...FUTURE_SALES_INTENTS]),
  customerReference: refSchema.optional(),
  dealReference: refSchema.optional(),
  quotationReference: refSchema.optional(),
  items: z.array(itemSchema).max(100).default([]),
  discountPercent: z.number().min(0).max(100).nullable().optional(),
  validityDays: z.number().int().min(1).max(365).nullable().optional(),
  sendRequested: z.boolean().optional(),
  extractFromConversation: z.boolean().optional(),
  copyLast: z.boolean().optional(),
  searchQuery: z.string().max(160).optional(),
  note: z.string().max(400).optional(),
});

export function validateSalesIntent(raw: unknown): SalesIntent | null {
  const parsed = salesIntentSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data as SalesIntent;
}

const QTY_ITEM =
  /(\d+(?:\.\d+)?)\s*(?:x|×)?\s+([A-Za-z0-9][\w\s\-\/&.%]{1,80}?)(?=(?:,| and | \+| with |$))/gi;

function parseQtyItems(text: string): SalesIntentItem[] {
  const items: SalesIntentItem[] = [];
  const lower = text.toLowerCase();
  // Include decimals so "6.2kva" is not captured as "2kva".
  const packageMatch = text.match(/(\d+(?:\.\d+)?\s*kva(?:\s+[A-Za-z0-9]+){0,4})(?:\s+package)?/i);
  if (packageMatch?.[1]) {
    const q = packageMatch[1].replace(/\s+package$/i, "").trim();
    items.push({ type: "PACKAGE", query: q, quantity: 1 });
  } else {
    const namedPkg = text.match(
      /(?:the\s+)?([A-Za-z0-9][\w\s\-]{2,60}?)\s+package/i
    );
    if (namedPkg?.[1] && !/this|their|a|the same/i.test(namedPkg[1])) {
      items.push({ type: "PACKAGE", query: namedPkg[1].trim(), quantity: 1 });
    }
  }

  const extra = text.match(
    /add(?:\s+one|\s+another|\s+an extra|\s+an additional)?\s+(?:extra\s+|additional\s+)?(.+?)(?:\.|$)/i
  );
  if (extra?.[1] && !/note that|delivery/i.test(extra[1])) {
    const q = extra[1].replace(/^(another|an extra|an additional|one|a)\s+/i, "").trim();
    if (q && q.length < 80) {
      const qty = /\banother\b|\bone extra\b|\ban additional\b|\bone\b/i.test(lower) ? 1 : 1;
      items.push({ type: "PRODUCT", query: q.replace(/\.$/, ""), quantity: qty });
    }
  }

  let m: RegExpExecArray | null;
  const re = new RegExp(QTY_ITEM.source, "gi");
  while ((m = re.exec(text)) !== null) {
    const qty = Number(m[1]);
    const name = (m[2] ?? "").replace(/\.$/, "").trim();
    if (!name || /kva/i.test(name)) continue;
    if (items.some((it) => it.query.toLowerCase() === name.toLowerCase())) continue;
    items.push({
      type: /package/i.test(name) ? "PACKAGE" : "PRODUCT",
      query: name.replace(/\s+package$/i, "").trim(),
      quantity: qty,
    });
  }
  return items;
}

function customerFromText(text: string, page: SalesPageContext | null): SalesIntent["customerReference"] {
  if (
    /\b(this customer|this client|this deal|this conversation|this lead|the customer|the client)\b/i.test(
      text
    )
  ) {
    return { source: "CURRENT_CONTEXT" };
  }
  const named = text.match(
    /(?:for|quote)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})(?:\s+for|\s+using|\s*$)/
  );
  if (named?.[1] && !/this|the|a\b/i.test(named[1])) {
    return { source: "SEARCH", query: named[1].trim() };
  }
  const quoteName = text.match(/\bquote\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  if (quoteName?.[1] && !/this|the/i.test(quoteName[1])) {
    return { source: "SEARCH", query: quoteName[1].trim() };
  }
  if (page?.leadId || page?.customerId || page?.dealId || page?.conversationId) {
    if (/^(create|prepare|make).{0,40}(quote|quotation)\.?$/i.test(text.trim()) || /^create the quotation\.?$/i.test(text.trim())) {
      return { source: "CURRENT_CONTEXT" };
    }
  }
  return undefined;
}

export function heuristicParseSalesIntent(
  text: string,
  page: SalesPageContext | null,
  sessionQuotationId?: string | null
): SalesIntent | null {
  const t = text.trim();
  if (!t) return null;

  if (
    /\bwhat should i (focus on|work on|do)( today)?\b/i.test(t) ||
    /\bwhat do i need to do( today)?\b/i.test(t) ||
    /\bwho should i follow up\b/i.test(t) ||
    /\bwhat deals? need (my )?attention\b/i.test(t) ||
    /\bshow me my priorities\b/i.test(t) ||
    /\btoday'?s focus\b/i.test(t) ||
    /\bstart my day\b/i.test(t)
  ) {
    return { intent: "GET_TODAYS_FOCUS", items: [] };
  }
  if (
    /\bwhat should i do next\b/i.test(t) ||
    /\bwhat'?s next\b/i.test(t) ||
    /\bnext best action\b/i.test(t) ||
    /\bwho should i (call|contact|message) next\b/i.test(t)
  ) {
    return { intent: "NEXT_BEST_ACTION", items: [] };
  }
  if (
    /\b(draft|prepare) (a |the )?(follow[- ]?up|message)\b/i.test(t) ||
    /\bmake (the |it |this )?(follow[- ]?up |message )?shorter\b/i.test(t) ||
    /\bdraft a shorter follow-up\b/i.test(t)
  ) {
    return { intent: "DRAFT_FOLLOWUP", items: [] };
  }
  if (
    /\bprepare me for (this |the |a )?(call|meeting|appointment)\b/i.test(t) ||
    /\bcall brief\b/i.test(t) ||
    /\bprepare (a |the )?call brief\b/i.test(t)
  ) {
    return { intent: "PREPARE_CALL_BRIEF", items: [] };
  }

  const sendRequested = /\b(create and send|send it|send (the|this) (quote|quotation))\b/i.test(t);
  const extractFromConversation =
    /\b(what (the customer|they|the client) (asked|requested|want)|from (this|the) conversation|quote what)\b/i.test(
      t
    ) || /^(create|prepare) the quotation\.?$/i.test(t);

  if (/\b(find|search|look up)\s+(customer|client|lead)\b/i.test(t) || /^who is\b/i.test(t)) {
    const q = t.replace(/^(find|search|look up)\s+(customer|client|lead)\s*/i, "").trim();
    return {
      intent: "SEARCH_CUSTOMER",
      searchQuery: q || t,
      items: [],
      customerReference: { source: "SEARCH", query: q || t },
    };
  }
  if (/\b(find|search|show)\s+(my )?deals?\b/i.test(t)) {
    return { intent: "SEARCH_DEAL", searchQuery: t, items: [] };
  }
  if (/\b(find|search)\s+(product|sku)\b/i.test(t)) {
    const q = t.replace(/^(find|search)\s+(product|sku)\s*/i, "").trim();
    return { intent: "SEARCH_PRODUCT", searchQuery: q || t, items: [] };
  }
  if (/\b(find|search)\s+package\b/i.test(t)) {
    const q = t.replace(/^(find|search)\s+package\s*/i, "").trim();
    return { intent: "SEARCH_PACKAGE", searchQuery: q || t, items: [] };
  }

  if (/\b(same quote as last time|copy last quote|create the same quote)\b/i.test(t)) {
    return {
      intent: "COPY_LAST_QUOTATION",
      customerReference: customerFromText(t, page) ?? { source: "CURRENT_CONTEXT" },
      items: [],
      copyLast: true,
      sendRequested,
    };
  }

  const isUpdate =
    Boolean(sessionQuotationId) &&
    /\b(add|remove|change|make validity|give them|discount|another)\b/i.test(t) &&
    !/\bcreate|prepare|new quote|new quotation\b/i.test(t);

  if (isUpdate) {
    const items = parseQtyItems(t);
    if (/\banother\b/i.test(t) && items.length === 0) {
      const extra = t.match(/add(?:\s+another)?\s+(.+)/i)?.[1];
      if (extra) items.push({ type: "PRODUCT", query: extra.replace(/\.$/, "").trim(), quantity: 1 });
    }
    const validity = t.match(/validity\s+(\d+)\s+days?/i);
    const discount = t.match(/(\d+(?:\.\d+)?)\s*%\s*(off|discount)?/i);
    return {
      intent: "UPDATE_DRAFT_QUOTATION",
      quotationReference: { source: "CURRENT_CONTEXT", id: sessionQuotationId ?? undefined },
      items,
      validityDays: validity ? Number(validity[1]) : null,
      discountPercent: discount ? Number(discount[1]) : null,
      sendRequested,
    };
  }

  if (/\b(view|open|show)\s+(the )?(quote|quotation)\b/i.test(t)) {
    return {
      intent: "VIEW_QUOTATION",
      customerReference: customerFromText(t, page),
      items: [],
    };
  }

  if (
    sendRequested ||
    /\b(quote|quotation|create a quote|prepare a quote|prepare a quotation|create a quotation)\b/i.test(
      t
    ) ||
    extractFromConversation
  ) {
    const items = parseQtyItems(t);
    return {
      intent: "CREATE_QUOTATION",
      customerReference: customerFromText(t, page) ?? (page?.leadId || page?.conversationId ? { source: "CURRENT_CONTEXT" } : undefined),
      dealReference:
        /\bthis deal\b/i.test(t) || page?.dealId
          ? { source: page?.dealId && /\bthis deal\b/i.test(t) ? "CURRENT_CONTEXT" : page?.dealId ? "CURRENT_CONTEXT" : "SEARCH" }
          : undefined,
      items,
      extractFromConversation: extractFromConversation && items.length === 0,
      sendRequested,
      discountPercent: (() => {
        const d = t.match(/(\d+(?:\.\d+)?)\s*%\s*(off|discount)/i);
        return d ? Number(d[1]) : null;
      })(),
      validityDays: (() => {
        const v = t.match(/validity\s+(\d+)\s+days?/i);
        return v ? Number(v[1]) : null;
      })(),
    };
  }

  return null;
}

export const EMIT_INTENT_TOOL = {
  name: "emit_sales_intent",
  description:
    "Return the salesperson's operational intent as structured JSON. Do not invent IDs, prices, or products.",
  inputSchema: {
    type: "object",
    properties: {
      intent: { type: "string" },
      customerReference: {
        type: "object",
        properties: {
          source: { type: "string", enum: ["CURRENT_CONTEXT", "SEARCH", "ID", "SELECTED"] },
          query: { type: "string" },
          id: { type: "string" },
        },
      },
      dealReference: {
        type: "object",
        properties: {
          source: { type: "string" },
          query: { type: "string" },
          id: { type: "string" },
        },
      },
      quotationReference: {
        type: "object",
        properties: {
          source: { type: "string" },
          query: { type: "string" },
          id: { type: "string" },
        },
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["PACKAGE", "PRODUCT", "SERVICE", "CUSTOM"] },
            query: { type: "string" },
            quantity: { type: "number" },
            variantQuery: { type: "string" },
          },
          required: ["type", "query", "quantity"],
        },
      },
      discountPercent: { type: "number" },
      validityDays: { type: "number" },
      sendRequested: { type: "boolean" },
      extractFromConversation: { type: "boolean" },
      copyLast: { type: "boolean" },
      searchQuery: { type: "string" },
    },
    required: ["intent"],
  },
};
