import type { SuggestedAgentAction } from "./hub-actions";

export type AgentActionCardType =
  | "VIEWING_APPROVAL"
  | "VIEWING_SCHEDULE_BLOCKED"
  | "CUSTOMER_QUESTION"
  | "GENERIC_BLOCKED";

export type AgentActionCard = {
  id: string;
  type: AgentActionCardType;
  title: string;
  subtitle: string | null;
  detailLines: string[];
  primaryLabel: string;
  secondaryLabel?: string;
  takeoverLabel?: string;
  toolName?: string;
  actionId?: string;
  inputSummary?: Record<string, unknown> | null;
  escalationId?: string;
};

function formatViewingWhen(input: Record<string, unknown> | null | undefined): string | null {
  if (!input) return null;
  const date = typeof input.date === "string" ? input.date : null;
  const time = typeof input.time === "string" ? input.time : null;
  if (date && time) return `${date} at ${time}`;
  if (date) return date;
  return null;
}

export function actionCardFromBlockedAction(action: SuggestedAgentAction): AgentActionCard | null {
  const input = action.inputSummary ?? {};
  if (action.toolName === "viewing.schedule") {
    const property =
      (typeof input.property === "string" && input.property) ||
      (typeof input.listing_id === "string" && `Listing ${input.listing_id.slice(0, 8)}`) ||
      "the property";
    const when = formatViewingWhen(input);
    return {
      id: action.id,
      type: "VIEWING_SCHEDULE_BLOCKED",
      title: "SegmiQ Agent needs you",
      subtitle: "Viewing approval required",
      detailLines: [
        `Property: ${property}`,
        when ? `Requested: ${when}` : "Requested time pending",
      ],
      primaryLabel: "Approve viewing",
      secondaryLabel: "Dismiss",
      takeoverLabel: "Take over",
      toolName: action.toolName,
      actionId: action.id,
      inputSummary: action.inputSummary,
    };
  }
  return {
    id: action.id,
    type: "GENERIC_BLOCKED",
    title: "SegmiQ Agent suggests",
    subtitle: action.label,
    detailLines: [],
    primaryLabel: "Apply",
    toolName: action.toolName,
    actionId: action.id,
    inputSummary: action.inputSummary,
  };
}

export function actionCardFromEscalation(row: {
  id: string;
  reason: string;
  summary: string;
  briefing: Record<string, unknown> | null;
}): AgentActionCard | null {
  const briefing = row.briefing ?? {};
  const cardType = briefing.cardType as string | undefined;

  if (cardType === "VIEWING_APPROVAL") {
    const property =
      (typeof briefing.property_label === "string" && briefing.property_label) || "Property viewing";
    const when =
      typeof briefing.requested_for === "string"
        ? briefing.requested_for
        : formatViewingWhen({
            date: typeof briefing.date === "string" ? briefing.date : undefined,
            time: typeof briefing.time === "string" ? briefing.time : undefined,
          });
    const customerRequest =
      typeof briefing.customer_request === "string" ? briefing.customer_request : null;
    return {
      id: row.id,
      type: "VIEWING_APPROVAL",
      title: "SegmiQ Agent needs you",
      subtitle: "Viewing approval required",
      detailLines: [
        property,
        when ? `Requested: ${when}` : "Requested time pending",
        customerRequest ? `Customer: ${customerRequest}` : "",
      ].filter(Boolean),
      primaryLabel: "Approve viewing",
      secondaryLabel: "Take over",
      escalationId: row.id,
      inputSummary: {
        listing_id: briefing.listing_id,
        date: briefing.date,
        time: briefing.time,
        customer_request: briefing.customer_request,
      },
    };
  }

  if (row.reason === "KNOWLEDGE_CONFLICT" || cardType === "CUSTOMER_QUESTION") {
    const question =
      (typeof briefing.customer_question === "string" && briefing.customer_question) ||
      row.summary;
    const property =
      typeof briefing.property_label === "string" ? briefing.property_label : null;
    return {
      id: row.id,
      type: "CUSTOMER_QUESTION",
      title: "Customer question",
      subtitle: question,
      detailLines: property ? [`Property: ${property}`] : [],
      primaryLabel: "Take over",
      escalationId: row.id,
    };
  }

  return null;
}

export function buildAgentActionCards(opts: {
  blockedActions: SuggestedAgentAction[];
  openEscalation: {
    id: string;
    reason: string;
    summary: string;
    briefing: Record<string, unknown> | null;
  } | null;
}): AgentActionCard[] {
  const cards: AgentActionCard[] = [];
  const seen = new Set<string>();

  if (opts.openEscalation) {
    const escCard = actionCardFromEscalation(opts.openEscalation);
    if (escCard) {
      cards.push(escCard);
      seen.add(escCard.id);
    }
  }

  const hasViewingEscalation = cards.some((card) => card.type === "VIEWING_APPROVAL");

  for (const action of opts.blockedActions) {
    const card = actionCardFromBlockedAction(action);
    if (!card || seen.has(card.id)) continue;
    if (hasViewingEscalation && card.type === "VIEWING_SCHEDULE_BLOCKED") continue;
    cards.push(card);
    seen.add(card.id);
  }

  return cards;
}
