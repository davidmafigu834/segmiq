import { isAmbiguousCommitment, isProactiveOptOutMessage } from "@/lib/agent/proactive/opt-out";
import { draftFingerprint, extractQuantity, matchCatalogue, matchListings } from "./catalogue";
import {
  addDays,
  atLocalHour,
  existingLocalDay,
  formatLocalWhen,
  localYmd,
  resolveCommitmentWhen,
  ymdKey,
} from "./dates";
import { contextRevision } from "./hash";
import type {
  CopilotAnalysis,
  CopilotEngineInput,
  CopilotMessage,
  EvidenceExcerpt,
  ProposalDraft,
} from "./types";

const PROMISE =
  /\b(i['’]?ll|i will|we['’]?ll|we will|let me)\b/i;

function isCustomerStatement(message: CopilotMessage): boolean {
  return message.direction === "inbound" && message.status !== "failed";
}

function isSalespersonStatement(message: CopilotMessage): boolean {
  if (message.direction !== "outbound") return false;
  if (message.status === "failed" || message.status === "pending") return false;
  return true;
}

function speaker(message: CopilotMessage): "customer" | "salesperson" {
  return message.direction === "inbound" ? "customer" : "salesperson";
}

function excerpt(message: CopilotMessage): EvidenceExcerpt {
  return {
    id: message.id,
    at: message.createdAt,
    speaker: speaker(message),
    text: message.body.trim().slice(0, 180),
  };
}

function intentOf(text: string): string {
  const t = text.toLowerCase();
  if (/quote|quotation/.test(t)) return "send_quote";
  if (/stock/.test(t)) return "check_stock";
  if (/measur/.test(t)) return "send_measurements";
  if (/(colleague|manager|my team)/.test(t) && /(ask|check with|speak)/.test(t)) return "ask_colleague";
  if (/viewing|appointment|come (?:and )?see/.test(t)) return "appointment";
  if (/call|contact|get back|follow up|message|whatsapp|reach out/.test(t)) return "contact";
  if (/\bsend\b/.test(t)) return "send";
  if (/\bcheck\b/.test(t)) return "check";
  return "act";
}

function actorFor(message: CopilotMessage, intent: string): ProposalDraft["waitingActor"] {
  if (intent === "ask_colleague") return "colleague";
  return message.direction === "inbound" ? "customer" : "salesperson";
}

function statementMessages(input: CopilotEngineInput): CopilotMessage[] {
  return input.messages.filter((message) => {
    const body = message.body?.trim();
    if (!body) return false;
    return isCustomerStatement(message) || isSalespersonStatement(message);
  });
}

function factFromMessages(
  input: CopilotEngineInput,
  messages: CopilotMessage[]
): CopilotAnalysis["facts"] {
  const facts: CopilotAnalysis["facts"] = [];
  const blob = messages.map((message) => message.body).join("\n");
  for (const field of input.requiredFields) {
    const known = input.knownFacts[field.key]?.trim();
    if (known) {
      facts.push({ key: field.key, value: known, messageId: messages[0]?.id ?? "record" });
      continue;
    }
    if (field.key === "quantity") {
      const qty = extractQuantity(blob);
      if (qty) {
        const source = messages.find((message) => extractQuantity(message.body) != null);
        facts.push({ key: field.key, value: String(qty), messageId: source?.id ?? "record" });
      }
    }
  }
  return facts;
}

function missingLabels(input: CopilotEngineInput, facts: CopilotAnalysis["facts"]): string[] {
  const have = new Set(facts.map((fact) => fact.key));
  return input.requiredFields.filter((field) => !have.has(field.key)).map((field) => field.label);
}

export function analyseConversation(input: CopilotEngineInput): CopilotAnalysis {
  const messages = statementMessages(input);
  const last = messages[messages.length - 1] ?? null;
  const revision = contextRevision({
    lastMessageId: last?.id ?? null,
    followUpAt: input.followUpAt,
    quoteStatus: input.quoteStatus,
    stage: input.stage,
    fields: input.requiredFields.map((field) => field.key),
  });
  const facts = factFromMessages(input, messages);
  const uncertainty: string[] = [];
  const proposals: ProposalDraft[] = [];
  const fulfilledKeys: string[] = [];

  if (input.doNotContact || messages.some((message) => isCustomerStatement(message) && isProactiveOptOutMessage(message.body))) {
    return {
      summary: "The customer asked not to be contacted. No follow-up is suggested.",
      facts,
      needs: [],
      objections: [],
      questions: [],
      waitingActor: null,
      proposals: [],
      fulfilledKeys: ["contact_later", "customer_checkin"],
      lastMessageId: last?.id ?? null,
      lastMessageAt: last?.createdAt ?? null,
      uncertainty: [],
      contextRevision: revision,
    };
  }

  const customerText = messages
    .filter(isCustomerStatement)
    .map((message) => message.body)
    .join("\n");
  const needs: string[] = [];
  if (/\b(need|looking for|want|interested in)\b/i.test(customerText)) {
    const line = messages.filter(isCustomerStatement).find((message) =>
      /\b(need|looking for|want|interested in)\b/i.test(message.body)
    );
    if (line) needs.push(line.body.trim().slice(0, 160));
  }
  const objections = messages
    .filter(isCustomerStatement)
    .filter((message) => /\b(too expensive|warranty|not sure|concern|worry|can't afford|cannot afford)\b/i.test(message.body))
    .map((message) => message.body.trim().slice(0, 160));
  const questions = messages
    .filter(isCustomerStatement)
    .filter((message) => message.body.includes("?") && message.body.trim().length > 8)
    .map((message) => ({ text: message.body.trim().slice(0, 180), messageId: message.id }));

  for (const message of messages) {
    if (!PROMISE.test(message.body)) continue;
    if (isAmbiguousCommitment(message.body)) {
      uncertainty.push("A commitment was mentioned without a date that can be scheduled.");
      const intent = intentOf(message.body);
      const actor = actorFor(message, intent);
      proposals.push({
        semanticKey: `${actor}:${intent}:undated`,
        actionType: "open_commitment",
        queue: "needs_review",
        title: actor === "customer" ? "Customer commitment is still open" : "Open commitment",
        explanation:
          actor === "salesperson"
            ? `You said “${message.body.trim().slice(0, 140)}”. No date was given, so nothing was scheduled.`
            : `The customer said “${message.body.trim().slice(0, 140)}”. No date was given, so no deadline was added.`,
        evidenceMessageIds: [message.id],
        evidence: [excerpt(message)],
        proposedAt: null,
        hourSuggested: false,
        currentDueAt: null,
        waitingActor: actor,
        priority: "medium",
        missing: [],
        payload: { kind: "open_commitment", intent, actor },
        linkedFollowUp: false,
      });
      continue;
    }

    const intent = intentOf(message.body);
    const actor = actorFor(message, intent);
    const when = resolveCommitmentWhen(message.body, new Date(message.createdAt), input.timezone, input.defaultHour);
    const semanticKey = when
      ? `${actor}:${intent}:${when.ymd}`
      : `${actor}:${intent}:undated`;

    const laterOutbound = messages.some(
      (other) =>
        isSalespersonStatement(other) &&
        other.id !== message.id &&
        new Date(other.createdAt).getTime() > new Date(message.createdAt).getTime() &&
        when != null &&
        new Date(other.createdAt).getTime() >= new Date(when.at).getTime()
    );
    const laterInbound = messages.some(
      (other) =>
        isCustomerStatement(other) &&
        other.id !== message.id &&
        new Date(other.createdAt).getTime() > new Date(message.createdAt).getTime()
    );

    if (actor === "salesperson" && intent === "contact" && laterOutbound) {
      fulfilledKeys.push(semanticKey);
      continue;
    }
    if (actor === "customer" && laterInbound && intent !== "send_measurements") {
      fulfilledKeys.push(semanticKey);
      if (when) fulfilledKeys.push(`customer_checkin:${when.ymd}`);
      continue;
    }
    if (intent === "send_quote" && input.quoteStatus && !["draft", "pending_approval"].includes(input.quoteStatus)) {
      fulfilledKeys.push(semanticKey);
      continue;
    }

    if (!input.capabilities.reminders && (intent === "contact" || actor === "customer")) {
      uncertainty.push("Reminders are not available for this account, so no follow-up was scheduled.");
      continue;
    }

    if (!when) {
      proposals.push({
        semanticKey,
        actionType: "open_commitment",
        queue: "needs_review",
        title: actor === "colleague" ? "Waiting on a colleague" : "Open commitment",
        explanation:
          actor === "salesperson"
            ? `You said “${message.body.trim().slice(0, 140)}”. No date was given, so nothing was scheduled.`
            : actor === "colleague"
              ? `You said you would ask someone else: “${message.body.trim().slice(0, 140)}”. No deadline was invented.`
              : `The customer said “${message.body.trim().slice(0, 140)}”. No date was given, so no deadline was added.`,
        evidenceMessageIds: [message.id],
        evidence: [excerpt(message)],
        proposedAt: null,
        hourSuggested: false,
        currentDueAt: null,
        waitingActor: actor,
        priority: "medium",
        missing: [],
        payload: { kind: "open_commitment", intent, actor },
        linkedFollowUp: false,
      });
      continue;
    }

    if (actor === "salesperson" && intent === "contact") {
      const proposedLabel = formatLocalWhen(when.at, input.timezone, when.hourSuggested);
      const currentDay = input.followUpAt ? existingLocalDay(input.followUpAt, input.timezone) : null;
      if (currentDay && currentDay === when.ymd) continue;
      const currentLabel = input.followUpAt
        ? formatLocalWhen(input.followUpAt, input.timezone, /^\d{4}-\d{2}-\d{2}$/.test(input.followUpAt))
        : null;
      proposals.push({
        semanticKey,
        actionType: currentLabel ? "update_reminder" : "create_reminder",
        queue: "needs_review",
        title: currentLabel ? "Update the reminder to match your promise" : "Reminder suggested from your promise",
        explanation: currentLabel
          ? `You promised to contact this customer ${when.dayLabel}. Your reminder is currently set for ${currentLabel}. Update it to match your promise?`
          : `You promised to contact this customer ${when.dayLabel}. There is no reminder yet. Create one for ${proposedLabel}?`,
        evidenceMessageIds: [message.id],
        evidence: [excerpt(message)],
        proposedAt: when.at,
        hourSuggested: when.hourSuggested,
        currentDueAt: input.followUpAt,
        waitingActor: "salesperson",
        priority: "high",
        missing: [],
        payload: {
          kind: "follow_up",
          mode: currentLabel ? "update" : "create",
          followUpAt: when.at,
          hourSuggested: when.hourSuggested,
          source: "HUMAN_CREATED",
          proposedLabel,
          currentLabel,
        },
        linkedFollowUp: true,
      });
      continue;
    }

    if (actor === "customer") {
      const promised = localYmd(new Date(when.at), input.timezone);
      const checkin = addDays(promised, input.checkinOffsetDays);
      const checkinAt = atLocalHour(checkin, input.defaultHour, 0, input.timezone);
      proposals.push({
        semanticKey: `customer_checkin:${when.ymd}`,
        actionType: "customer_checkin",
        queue: "needs_review",
        title: "Customer is expected to reply first",
        explanation: `The customer said they would get back to you ${when.dayLabel}. A later check-in is suggested for ${formatLocalWhen(checkinAt, input.timezone, true)} so you are not contacting them before the time they agreed. The hour is a suggestion.`,
        evidenceMessageIds: [message.id],
        evidence: [excerpt(message)],
        proposedAt: checkinAt,
        hourSuggested: true,
        currentDueAt: input.followUpAt,
        waitingActor: "customer",
        priority: "medium",
        missing: [],
        payload: {
          kind: "follow_up",
          mode: input.followUpAt ? "update" : "create",
          followUpAt: checkinAt,
          hourSuggested: true,
          source: "CUSTOMER_COMMITMENT",
          customerPromisedAt: when.at,
        },
        linkedFollowUp: true,
      });
    }
  }

  const comparing = messages.find(
    (message) =>
      isCustomerStatement(message) &&
      /\b(comparing|other suppliers|other options|think(?:ing)? about it|decide later|not ready yet)\b/i.test(message.body)
  );
  const hasCustomerTiming = proposals.some((proposal) => proposal.actionType === "customer_checkin");
  const comparingContinued = comparing
    ? messages.some(
        (message) =>
          isCustomerStatement(message) &&
          message.id !== comparing.id &&
          new Date(message.createdAt).getTime() > new Date(comparing.createdAt).getTime() &&
          !/\b(comparing|other suppliers|other options|think(?:ing)? about it|decide later|not ready yet)\b/i.test(
            message.body
          )
      )
    : false;
  if (comparingContinued) fulfilledKeys.push("contact_later");

  if (comparing && !comparingContinued && !hasCustomerTiming && input.capabilities.reminders) {
    const base = localYmd(new Date(comparing.createdAt), input.timezone);
    const whenFromText = resolveCommitmentWhen(comparing.body, new Date(comparing.createdAt), input.timezone, input.defaultHour);
    const ymd = whenFromText ? localYmd(new Date(whenFromText.at), input.timezone) : addDays(base, input.contactLaterDays);
    const at = atLocalHour(ymd, input.defaultHour, 0, input.timezone);
    const usedCustomerTiming = Boolean(whenFromText);
    proposals.push({
      semanticKey: `contact_later:${ymdKey(ymd)}`,
      actionType: "contact_later",
      queue: "needs_review",
      title: "Suggest a later check-in",
      explanation: usedCustomerTiming
        ? `This customer is still comparing options and mentioned ${whenFromText?.dayLabel}. Their conversation stays on this contact. Would you like to schedule a check-in for ${formatLocalWhen(at, input.timezone, !whenFromText || whenFromText.hourSuggested)}?`
        : `This customer is still comparing options. I suggest checking in ${formatLocalWhen(at, input.timezone, true)}. That date uses the company default of ${input.contactLaterDays} days and the hour is a suggestion. Their conversation history will remain attached. Would you like to schedule that?`,
      evidenceMessageIds: [comparing.id],
      evidence: [excerpt(comparing)],
      proposedAt: at,
      hourSuggested: true,
      currentDueAt: input.followUpAt,
      waitingActor: "customer",
      priority: "medium",
      missing: [],
      payload: {
        kind: "follow_up",
        mode: input.followUpAt ? "update" : "create",
        followUpAt: at,
        hourSuggested: true,
        source: "CUSTOMER_COMMITMENT",
        reason: "comparing_options",
        concerns: objections,
        discussed: needs,
      },
      linkedFollowUp: true,
    });
  }

  const quoteTalk = /\b(quote|quotation)\b/i.test(customerText) || (/\b(how much|price|pricing)\b/i.test(customerText) && !input.capabilities.listings);
  const propertyTalk = /\b(rent|rental|for sale|to buy|viewing|property|apartment|house|bedroom)\b/i.test(customerText);
  if (input.capabilities.listings && propertyTalk && !/\b(quote|quotation)\b/i.test(customerText)) {
    const hits = matchListings(customerText, input.listings);
    const missing = missingLabels(input, facts);
    if (hits.length === 0) {
      proposals.push({
        semanticKey: "listings:none",
        actionType: "listing_shortlist",
        queue: "needs_review",
        title: "Listing shortlist needs more detail",
        explanation: missing.length
          ? `This looks like a property enquiry. Still needed: ${missing.join(", ")}. No listing was guessed.`
          : "This looks like a property enquiry. No matching listing was found, so nothing was shortlisted.",
        evidenceMessageIds: messages.filter(isCustomerStatement).slice(-2).map((message) => message.id),
        evidence: messages.filter(isCustomerStatement).slice(-2).map(excerpt),
        proposedAt: null,
        hourSuggested: false,
        currentDueAt: null,
        waitingActor: "salesperson",
        priority: "medium",
        missing,
        payload: { kind: "listing_shortlist", options: [] },
        linkedFollowUp: false,
      });
    } else if (hits.length > 1) {
      proposals.push({
        semanticKey: "listings:choose",
        actionType: "listing_shortlist",
        queue: "needs_review",
        title: "Choose a listing",
        explanation: "More than one listing matches this conversation. Choose one before a viewing is suggested.",
        evidenceMessageIds: messages.filter(isCustomerStatement).slice(-2).map((message) => message.id),
        evidence: messages.filter(isCustomerStatement).slice(-2).map(excerpt),
        proposedAt: null,
        hourSuggested: false,
        currentDueAt: null,
        waitingActor: "salesperson",
        priority: "high",
        missing: [],
        payload: {
          kind: "listing_shortlist",
          options: hits.slice(0, 6).map((listing) => ({ id: listing.id, name: listing.name, location: listing.location })),
        },
        linkedFollowUp: false,
      });
    } else if (input.capabilities.appointments && /\bviewing\b/i.test(customerText)) {
      proposals.push({
        semanticKey: `viewing:${hits[0].id}`,
        actionType: "appointment",
        queue: "needs_review",
        title: "Viewing needs a time",
        explanation: `The customer is asking about ${hits[0].name}. A viewing can be scheduled once you confirm the time. No appointment was created.`,
        evidenceMessageIds: messages.filter(isCustomerStatement).slice(-2).map((message) => message.id),
        evidence: messages.filter(isCustomerStatement).slice(-2).map(excerpt),
        proposedAt: null,
        hourSuggested: false,
        currentDueAt: null,
        waitingActor: "salesperson",
        priority: "high",
        missing: ["Preferred viewing time"],
        payload: { kind: "appointment", listingId: hits[0].id, listingName: hits[0].name },
        linkedFollowUp: false,
      });
    }
  } else if (quoteTalk && input.capabilities.quotations) {
    const match = matchCatalogue(customerText, input.catalogue);
    const missing = missingLabels(input, facts);
    const evidenceMessages = messages.filter(isCustomerStatement).slice(-3);
    if (match.status === "ambiguous") {
      proposals.push({
        semanticKey: "quote:choose",
        actionType: "quotation_choice",
        queue: "needs_review",
        title: "Choose the product for the quotation",
        explanation: "More than one catalogue item matches this conversation. Choose the brand or variant before a draft is prepared. No price was guessed.",
        evidenceMessageIds: evidenceMessages.map((message) => message.id),
        evidence: evidenceMessages.map(excerpt),
        proposedAt: null,
        hourSuggested: false,
        currentDueAt: null,
        waitingActor: "salesperson",
        priority: "high",
        missing: [],
        payload: {
          kind: "quotation_choice",
          quantity: extractQuantity(customerText),
          options: match.options.map((item) => ({
            id: item.id,
            name: item.name,
            brand: item.brand,
            unitPrice: item.unitPrice,
          })),
        },
        linkedFollowUp: false,
      });
    } else if (match.status === "matched") {
      const recordedQuantity = Number(facts.find((fact) => fact.key === "quantity")?.value);
      const quantity =
        match.quantity ?? (Number.isFinite(recordedQuantity) && recordedQuantity > 0 ? recordedQuantity : null);
      if (quantity && missing.length === 0) {
        const line = {
          productId: match.item.id,
          name: match.item.name,
          quantity,
          unitPrice: match.item.unitPrice,
        };
        const stockNote =
          input.capabilities.stock && match.item.stockQty == null
            ? " Stock figures are not available for this product."
            : input.capabilities.stock && match.item.stockQty != null
              ? ` Available stock: ${match.item.stockQty}.`
              : "";
        proposals.push({
          semanticKey: `quote:${draftFingerprint([{ productId: line.productId, name: line.name, quantity: line.quantity }])}`,
          actionType: "quotation_draft",
          queue: "needs_review",
          title: "Quotation details are ready to draft",
          explanation: `The conversation includes ${line.quantity} × ${line.name}. A draft can be prepared for review. It will not be sent automatically.${stockNote}`,
          evidenceMessageIds: evidenceMessages.map((message) => message.id),
          evidence: evidenceMessages.map(excerpt),
          proposedAt: null,
          hourSuggested: false,
          currentDueAt: null,
          waitingActor: "salesperson",
          priority: "high",
          missing: [],
          payload: {
            kind: "quotation_draft",
            items: [line],
            fingerprint: draftFingerprint([{ productId: line.productId, name: line.name, quantity: line.quantity }]),
          },
          linkedFollowUp: false,
        });
      } else {
        const gaps = [...missing];
        if (!quantity) gaps.push("Quantity");
        proposals.push({
          semanticKey: "quote:incomplete",
          actionType: "quotation_missing",
          queue: "needs_review",
          title: "Quotation needs a few details",
          explanation: `A quotation was discussed, but it is not ready. Still needed: ${Array.from(new Set(gaps)).join(", ")}. Nothing was created.`,
          evidenceMessageIds: evidenceMessages.map((message) => message.id),
          evidence: evidenceMessages.map(excerpt),
          proposedAt: null,
          hourSuggested: false,
          currentDueAt: null,
          waitingActor: "salesperson",
          priority: "medium",
          missing: Array.from(new Set(gaps)),
          payload: { kind: "quotation_missing" },
          linkedFollowUp: false,
        });
      }
    } else {
      const gaps = [...missing, "Catalogue item"];
      proposals.push({
        semanticKey: "quote:incomplete",
        actionType: "quotation_missing",
        queue: "needs_review",
        title: "Quotation needs a few details",
        explanation: `A quotation was discussed, but it is not ready. Still needed: ${Array.from(new Set(gaps)).join(", ")}. Nothing was created.`,
        evidenceMessageIds: evidenceMessages.map((message) => message.id),
        evidence: evidenceMessages.map(excerpt),
        proposedAt: null,
        hourSuggested: false,
        currentDueAt: null,
        waitingActor: "salesperson",
        priority: "medium",
        missing: Array.from(new Set(gaps)),
        payload: { kind: "quotation_missing" },
        linkedFollowUp: false,
      });
    }
  } else if (quoteTalk && !input.capabilities.quotations) {
    uncertainty.push("A quotation was discussed, but quotations are not available on this account.");
  }

  const unanswered = questions.filter((question) => {
    const asked = messages.find((message) => message.id === question.messageId);
    if (!asked) return false;
    return !messages.some(
      (message) =>
        isSalespersonStatement(message) &&
        new Date(message.createdAt).getTime() > new Date(asked.createdAt).getTime()
    );
  });
  if (unanswered[0] && !proposals.some((proposal) => proposal.actionType === "answer_question")) {
    proposals.push({
      semanticKey: `answer:${unanswered[0].messageId}`,
      actionType: "answer_question",
      queue: "todo",
      title: "Answer the customer's question",
      explanation: `The customer asked: “${unanswered[0].text}”. This is separate from the current stage${input.stage ? ` (${input.stage})` : ""}.`,
      evidenceMessageIds: [unanswered[0].messageId],
      evidence: messages.filter((message) => message.id === unanswered[0].messageId).map(excerpt),
      proposedAt: null,
      hourSuggested: false,
      currentDueAt: null,
      waitingActor: "salesperson",
      priority: "high",
      missing: [],
      payload: { kind: "answer_question", question: unanswered[0].text },
      linkedFollowUp: false,
    });
  }

  const uniqueProposals = new Map<string, ProposalDraft>();
  for (const proposal of proposals) uniqueProposals.set(proposal.semanticKey, proposal);
  const deduped = Array.from(uniqueProposals.values());
  const waitingActor = deduped.find((proposal) => proposal.waitingActor)?.waitingActor ?? null;
  const summaryParts = [
    needs[0] ? `Need: ${needs[0]}` : null,
    deduped[0] ? deduped[0].explanation : "No action is waiting on this conversation.",
  ].filter(Boolean);

  return {
    summary: summaryParts.join(" "),
    facts,
    needs,
    objections,
    questions,
    waitingActor,
    proposals: deduped,
    fulfilledKeys,
    lastMessageId: last?.id ?? null,
    lastMessageAt: last?.createdAt ?? null,
    uncertainty,
    contextRevision: revision,
  };
}

export function applyGroundedReading(
  analysis: CopilotAnalysis,
  reading: {
    needs?: string[];
    objections?: string[];
    questions?: Array<{ text: string; messageId: string }>;
  },
  messages: CopilotMessage[]
): CopilotAnalysis {
  const byId = new Map(messages.map((message) => [message.id, message.body.toLowerCase()]));
  const grounded = (text: string, messageId: string) => {
    const body = byId.get(messageId);
    if (!body) return false;
    const snippet = text.trim().toLowerCase().slice(0, 80);
    return snippet.length >= 8 && body.includes(snippet);
  };
  const needs = [...analysis.needs];
  for (const need of reading.needs ?? []) {
    const source = messages.find((message) => grounded(need, message.id));
    if (source && !needs.includes(need.trim())) needs.push(need.trim().slice(0, 160));
  }
  const objections = [...analysis.objections];
  for (const objection of reading.objections ?? []) {
    const source = messages.find((message) => grounded(objection, message.id));
    if (source && !objections.includes(objection.trim())) objections.push(objection.trim().slice(0, 160));
  }
  const questions = [...analysis.questions];
  for (const question of reading.questions ?? []) {
    if (!grounded(question.text, question.messageId)) continue;
    if (!questions.some((existing) => existing.messageId === question.messageId)) {
      questions.push({ text: question.text.trim().slice(0, 180), messageId: question.messageId });
    }
  }
  return { ...analysis, needs, objections, questions };
}
