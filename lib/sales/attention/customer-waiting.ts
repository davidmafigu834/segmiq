/**
 * Robust customer-waiting detection.
 *
 * Do NOT simply compare lastIncomingAt > lastOutgoingAt without considering
 * conversation category, agent replies, resolved state, or support queue.
 */

export type WaitingMessageSample = {
  direction: "inbound" | "outbound" | string;
  created_at: string;
  /** Human user id when known (outbound). */
  actor_id?: string | null;
  /** When true, treat as non-customer noise (system / delivery). */
  isSystem?: boolean;
  body?: string | null;
};

export type WaitingConversationMeta = {
  conversationType?: "SALES" | "SUPPORT" | "GENERAL" | string | null;
  conversationStatus?: "OPEN" | "RESOLVED" | string | null;
  queue?: "SALES" | "SUPPORT" | string | null;
  agentStatus?: string | null;
  /** Another human currently handling (not the owner). */
  handledByOtherUserId?: string | null;
  ownerUserId?: string | null;
  currentUserId?: string | null;
};

export type CustomerWaitingResult = {
  isWaiting: boolean;
  customerWaitingSince: string | null;
  waitingDurationMinutes: number | null;
  waitingReason: string | null;
  suppressedReason: string | null;
  lastCustomerMessage: string | null;
};

const ACK_ONLY =
  /^(ok|okay|k|thanks|thank you|ty|noted|received|👍|🙏|🙏+|got it|sure|yes|no|👍+|👌)[.!\s]*$/i;

function isMeaningfulInbound(body: string | null | undefined): boolean {
  if (body == null) return true;
  const t = body.trim();
  if (!t) return false;
  if (ACK_ONLY.test(t) && t.length <= 24) return false;
  return true;
}

/**
 * Deterministic: customer has a meaningful unanswered inbound after the last
 * appropriate human/agent outbound (or no outbound after that inbound).
 */
export function detectCustomerWaiting(opts: {
  messages: WaitingMessageSample[];
  now?: Date;
  meta?: WaitingConversationMeta;
}): CustomerWaitingResult {
  const now = opts.now ?? new Date();
  const meta = opts.meta ?? {};

  if (meta.conversationType === "SUPPORT" || meta.queue === "SUPPORT") {
    return empty("SUPPORT_QUEUE");
  }
  if (meta.conversationStatus === "RESOLVED") {
    return empty("RESOLVED");
  }
  if (
    meta.handledByOtherUserId &&
    meta.currentUserId &&
    meta.handledByOtherUserId !== meta.currentUserId
  ) {
    return empty("HANDLED_BY_OTHER");
  }
  if (meta.agentStatus === "HUMAN_HANDLING" && meta.handledByOtherUserId) {
    return empty("HUMAN_TAKEOVER");
  }

  const messages = [...opts.messages]
    .filter((m) => !m.isSystem)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (messages.length === 0) {
    return empty("NO_MESSAGES");
  }

  let lastMeaningfulInboundAt: string | null = null;
  let lastMeaningfulInboundBody: string | null = null;
  let answeredAfter = false;

  for (const m of messages) {
    if (m.direction === "inbound") {
      if (!isMeaningfulInbound(m.body ?? null)) continue;
      lastMeaningfulInboundAt = m.created_at;
      lastMeaningfulInboundBody = m.body?.trim() || null;
      answeredAfter = false;
      continue;
    }
    if (m.direction === "outbound" && lastMeaningfulInboundAt) {
      // Any outbound after the inbound counts as an appropriate response
      // (human or agent). Delivery receipts are filtered via isSystem.
      answeredAfter = true;
    }
  }

  if (!lastMeaningfulInboundAt || answeredAfter) {
    return empty(answeredAfter ? "ANSWERED" : "NO_INBOUND");
  }

  const sinceMs = now.getTime() - Date.parse(lastMeaningfulInboundAt);
  if (!Number.isFinite(sinceMs) || sinceMs < 0) {
    return empty("INVALID_TIME");
  }
  const mins = Math.floor(sinceMs / 60_000);

  return {
    isWaiting: true,
    customerWaitingSince: lastMeaningfulInboundAt,
    waitingDurationMinutes: mins,
    waitingReason: "CUSTOMER_UNANSWERED",
    suppressedReason: null,
    lastCustomerMessage: lastMeaningfulInboundBody,
  };
}

function empty(suppressedReason: string): CustomerWaitingResult {
  return {
    isWaiting: false,
    customerWaitingSince: null,
    waitingDurationMinutes: null,
    waitingReason: null,
    suppressedReason,
    lastCustomerMessage: null,
  };
}

export function formatWaitingDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "";
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
