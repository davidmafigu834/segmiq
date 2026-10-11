import { isAmbiguousCommitment, isProactiveOptOutMessage } from "@/lib/agent/proactive/opt-out";
import { draftFingerprint, extractQuantity, matchCatalogue, matchListings } from "./catalogue";
import {
  addDays,
  atLocalHour,
  existingLocalDay,
  formatLocalWhen,
  localYmd,
  parseExplicitTime,
  resolveAnchoredSlot,
  resolveCommitmentWhen,
  ymdKey,
} from "./dates";
import { withoutMeetingDuplicateReminders } from "./dedupe";
import { contextRevision } from "./hash";
import type {
  CopilotAnalysis,
  CopilotEngineInput,
  CopilotMessage,
  EvidenceExcerpt,
  ProposalDraft,
} from "./types";

const FUTURE_PROMISE = /\b(i['’]?ll|i will|we['’]?ll|we will|let me)\b/i;
const COMPLETED_WORK = /\b(i['’]?ve|i have|we['’]?ve|we have)\b/i;
const COMPLETED_VERB = /\b(prepar\w*|creat\w*|sent|draft\w*|quot\w*)\b/i;
const SHORT_APPROVAL = /^(please go ahead|go ahead|yes|yeah|ok|okay|sure|sounds good|proceed|do it)[.!]?$/i;

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
  if (/quote|quotation|prepare (?:a|the) draft/.test(t)) return "send_quote";
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
  const need = statedNeed(messages);
  if (need) {
    for (const field of input.requiredFields) {
      if (facts.some((fact) => fact.key === field.key)) continue;
      if (!isPrimaryRequirementField(field)) continue;
      facts.push({ key: field.key, value: need.text, messageId: need.messageId });
    }
  }
  return facts;
}

function missingLabels(input: CopilotEngineInput, facts: CopilotAnalysis["facts"]): string[] {
  const have = new Set(facts.map((fact) => fact.key));
  return input.requiredFields
    .filter((field) => !have.has(field.key))
    .map((field) => field.label)
    .filter((label) => !/catalogue item/i.test(label));
}

function sentencesOf(body: string): string[] {
  const parts = body
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [body.trim()];
}

function isCompletedWorkClaim(sentence: string): boolean {
  return COMPLETED_WORK.test(sentence) && COMPLETED_VERB.test(sentence);
}

function isFuturePromiseSentence(sentence: string): boolean {
  if (isCompletedWorkClaim(sentence)) return false;
  return FUTURE_PROMISE.test(sentence);
}

function isTeamReviewRequest(sentence: string): boolean {
  return /\b(team|technical|engineer|colleague)\b/i.test(sentence) && /\b(review|check|assess|look at)\b/i.test(sentence);
}

function isPrimaryRequirementField(field: { key: string; label: string }): boolean {
  return /requirement|intent|scope|need|product|system|work|enquir|inquir/i.test(`${field.key} ${field.label}`);
}

export function relevantQuotations<T extends { dealId: string | null }>(quotes: T[], activeDealId: string | null): T[] {
  if (!activeDealId) return quotes;
  const sameOpportunity = quotes.filter((quote) => quote.dealId == null || quote.dealId === activeDealId);
  if (sameOpportunity.length > 0 || quotes.length < 2) return sameOpportunity;
  return quotes;
}

function statedNeed(messages: CopilotMessage[]): { text: string; messageId: string } | null {
  const explicit = messages.filter(
    (message) =>
      isCustomerStatement(message) &&
      /\b(need|looking for|want|interested in|require)\b/i.test(message.body) &&
      !SHORT_APPROVAL.test(message.body.trim())
  );
  const last = explicit[explicit.length - 1];
  if (last) return { text: last.body.trim().slice(0, 160), messageId: last.id };
  const approval = [...messages]
    .reverse()
    .find((message) => isCustomerStatement(message) && SHORT_APPROVAL.test(message.body.trim()));
  if (!approval) return null;
  const prior = [...messages]
    .reverse()
    .find(
      (message) =>
        isSalespersonStatement(message) &&
        new Date(message.createdAt).getTime() <= new Date(approval.createdAt).getTime() &&
        message.body.trim().length > 24
    );
  return prior ? { text: prior.body.trim().slice(0, 160), messageId: prior.id } : null;
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
    for (const clause of sentencesOf(message.body)) {
    if (isCompletedWorkClaim(clause)) continue;
    if (isTeamReviewRequest(clause)) {
      const reviewWhen = resolveCommitmentWhen(clause, new Date(message.createdAt), input.timezone, input.defaultHour);
      if (!reviewWhen && !proposals.some((proposal) => proposal.semanticKey === `review:${message.id}`)) {
        proposals.push({
          semanticKey: `review:${message.id}`,
          actionType: "open_commitment",
          queue: "needs_review",
          title: "Technical review requested",
          explanation: "A team review was requested. No date was given, so nothing was scheduled.",
          evidenceMessageIds: [message.id],
          evidence: [excerpt(message)],
          proposedAt: null,
          hourSuggested: false,
          currentDueAt: null,
          waitingActor: "colleague",
          priority: "medium",
          missing: [],
          payload: { kind: "open_commitment", intent: "ask_colleague", actor: "colleague" },
          linkedFollowUp: false,
        });
      }
      if (!isFuturePromiseSentence(clause)) continue;
    }
    if (!isFuturePromiseSentence(clause) && !isAmbiguousCommitment(clause)) continue;
    if (intentOf(clause) === "send_quote" && !resolveCommitmentWhen(clause, new Date(message.createdAt), input.timezone, input.defaultHour)) continue;
    if (isAmbiguousCommitment(clause)) {
      uncertainty.push("A commitment was mentioned without a date that can be scheduled.");
      const intent = intentOf(clause);
      const actor = actorFor(message, intent);
      proposals.push({
        semanticKey: `${actor}:${intent}:undated`,
        actionType: "open_commitment",
        queue: "needs_review",
        title: actor === "customer" ? "Customer commitment is still open" : "Follow-up has no date",
        explanation:
          actor === "salesperson"
            ? `You said “${clause.trim().slice(0, 140)}”. No date was given, so nothing was scheduled.`
            : `The customer said “${clause.trim().slice(0, 140)}”. No date was given, so no deadline was added.`,
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

    const intent = intentOf(clause);
    const actor = actorFor(message, intent);
    const when = resolveCommitmentWhen(clause, new Date(message.createdAt), input.timezone, input.defaultHour);
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
        title: actor === "colleague" ? "Waiting on a colleague" : intent === "contact" ? "Follow-up has no date" : "Open commitment",
        explanation:
          actor === "salesperson"
            ? `You said “${clause.trim().slice(0, 140)}”. No date was given, so nothing was scheduled.`
            : actor === "colleague"
              ? `You said you would ask someone else: “${clause.trim().slice(0, 140)}”. No deadline was invented.`
              : `The customer said “${clause.trim().slice(0, 140)}”. No date was given, so no deadline was added.`,
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

    if (actor === "salesperson" && intent === "send_quote") {
      const proposedLabel = formatLocalWhen(when.at, input.timezone, when.hourSuggested);
      proposals.push({
        semanticKey,
        actionType: input.followUpAt ? "update_reminder" : "create_reminder",
        queue: "needs_review",
        title: "Send the quotation",
        explanation: `You said you would prepare the quotation ${when.dayLabel}. Set a follow-up for ${proposedLabel}?`,
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
          mode: input.followUpAt ? "update" : "create",
          followUpAt: when.at,
          hourSuggested: when.hourSuggested,
          source: "HUMAN_CREATED",
          proposedLabel,
        },
        linkedFollowUp: true,
      });
    }
    }
  }

  const meetingRequests = messages.filter((message) => isCustomerStatement(message) && /\b(meet|meeting|schedule|viewing|visit|appointment)\b/i.test(message.body));
  for (const request of meetingRequests) {
    const reply = messages.find(
      (message) =>
        isSalespersonStatement(message) &&
        new Date(message.createdAt).getTime() > new Date(request.createdAt).getTime() &&
        (parseExplicitTime(message.body) != null || /\b(ok|okay|fine|works|sure|yes)\b/i.test(message.body))
    );
    if (!reply) {
      proposals.push({
        semanticKey: `meeting:request:${request.id}`,
        actionType: "answer_question",
        queue: "todo",
        title: "Meeting request noted",
        explanation: "The customer asked to meet. Draft a reply when you are ready. Nothing is scheduled yet.",
        evidenceMessageIds: [request.id],
        evidence: [excerpt(request)],
        proposedAt: null,
        hourSuggested: false,
        currentDueAt: null,
        waitingActor: "salesperson",
        priority: "low",
        missing: [],
        payload: { kind: "answer_question", question: request.body.trim().slice(0, 180), onDemand: true },
        linkedFollowUp: false,
      });
      continue;
    }
    const slot = resolveAnchoredSlot({
      anchorText: request.body,
      anchorAt: new Date(request.createdAt),
      replyText: reply.body,
      replyAt: new Date(reply.createdAt),
      timeZone: input.timezone,
      defaultHour: input.defaultHour,
    });
    const accepted = messages.some(
      (message) =>
        isCustomerStatement(message) &&
        new Date(message.createdAt).getTime() > new Date(reply.createdAt).getTime() &&
        SHORT_APPROVAL.test(message.body.trim())
    );
    const subjectMatch = request.body.match(/\bfor\s+(.{3,80}?)(?:[?.!]|$)/i);
    const subject = subjectMatch?.[1]?.trim() || statedNeed(messages)?.text || "this enquiry";
    const whenLabel = slot?.at
      ? formatLocalWhen(slot.at, input.timezone, slot.hourSuggested)
      : slot
        ? slot.dayLabel
        : "a time you still need to choose";
    const changed = messages.some(
      (message) =>
        new Date(message.createdAt).getTime() > new Date(reply.createdAt).getTime() &&
        /\b(cancel|reschedule|can't make|cannot make)\b/i.test(message.body)
    );
    const key = `meeting:${slot?.ymd ?? "open"}`;
    proposals.push({
      semanticKey: key,
      actionType: input.followUpAt && existingLocalDay(input.followUpAt, input.timezone) !== slot?.ymd ? "update_reminder" : slot?.at ? "create_reminder" : "appointment",
      queue: "needs_review",
      title: changed ? "Update the meeting reminder?" : "Save a meeting reminder?",
      explanation: changed
        ? "The arranged time was changed or cancelled in the conversation. Review the existing reminder before it is updated. Nothing is removed until you approve."
        : slot?.at
          ? `You offered to meet this client on ${whenLabel} to discuss ${subject}. Can I add a reminder to your Tasks? ${accepted ? "The customer has accepted this time." : "Awaiting customer confirmation."} Saving a reminder does not book a calendar invitation.`
          : `You agreed to meet this client ${slot ? `on ${slot.dayLabel}` : ""} to discuss ${subject}, but no exact time was given. Choose the time before a reminder is saved.`,
      evidenceMessageIds: [request.id, reply.id],
      evidence: [excerpt(request), excerpt(reply)],
      proposedAt: changed ? null : slot?.at ?? null,
      hourSuggested: Boolean(slot?.hourSuggested),
      currentDueAt: input.followUpAt,
      waitingActor: accepted ? "salesperson" : "customer",
      priority: "high",
      missing: slot?.at && !changed ? [] : ["Time"],
      payload: {
        kind: "follow_up",
        mode: input.followUpAt ? "update" : "create",
        followUpAt: slot?.at ?? null,
        hourSuggested: Boolean(slot?.hourSuggested),
        source: "HUMAN_CREATED",
        awaitingCustomerConfirmation: !accepted,
        subject,
        onDemand: false,
      },
      linkedFollowUp: true,
    });
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
        ? `The client is still comparing options and mentioned ${whenFromText?.dayLabel}. Can I add a check-in for ${formatLocalWhen(at, input.timezone, !whenFromText || whenFromText.hourSuggested)} to Contact later? The hour is a suggestion until you approve it.`
        : `The client is still comparing options. Your company suggests checking in after ${input.contactLaterDays} days, on ${formatLocalWhen(at, input.timezone, true)}. Can I add this to Contact later? The hour is a suggestion.`,
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

  const salespersonText = messages.filter(isSalespersonStatement).map((message) => message.body).join("\n");
  const claimedDraft = messages.some(
    (message) => isSalespersonStatement(message) && sentencesOf(message.body).some((sentence) => isCompletedWorkClaim(sentence))
  );
  const savedQuotes = input.existingQuotes ?? [];
  const openDrafts = savedQuotes.filter((quote) => quote.status === "draft" || quote.status === "pending_approval");
  const otherQuotes = savedQuotes.filter((quote) => quote.status !== "draft" && quote.status !== "pending_approval");
  const knownNeed = Boolean(statedNeed(messages)) || needs.length > 0;
  const quoteTalk =
    /\b(quote|quotation|prepare (?:a|the) draft)\b/i.test(`${customerText}\n${salespersonText}`) ||
    (/\b(how much|price|pricing)\b/i.test(customerText) && !input.capabilities.listings);
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
  } else if (quoteTalk && input.capabilities.quotations && openDrafts.length > 1) {
    const evidenceMessages = messages.filter((message) => isCustomerStatement(message) || isSalespersonStatement(message)).slice(-2);
    proposals.push({
      semanticKey: "quote:choose-saved",
      actionType: "quotation_choice",
      queue: "needs_review",
      title: "Choose the quotation",
      explanation: "More than one draft is saved for this conversation. Choose the one to review. No new draft was created.",
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
        options: openDrafts.map((quote) => ({ id: quote.id, name: `Saved draft ${quote.id.slice(0, 8)}` })),
      },
      linkedFollowUp: false,
    });
  } else if (quoteTalk && input.capabilities.quotations && openDrafts.length === 1) {
    const evidenceMessages = messages.filter((message) => isCustomerStatement(message) || isSalespersonStatement(message)).slice(-2);
    proposals.push({
      semanticKey: `quote:saved:${openDrafts[0].id}`,
      actionType: "quotation_draft",
      queue: "needs_review",
      title: "Quotation draft ready",
      explanation: "A saved draft is linked to this conversation. Review the items and prices before sending.",
      evidenceMessageIds: evidenceMessages.map((message) => message.id),
      evidence: evidenceMessages.map(excerpt),
      proposedAt: null,
      hourSuggested: false,
      currentDueAt: null,
      waitingActor: "salesperson",
      priority: "high",
      missing: [],
      payload: { kind: "quotation_draft", quotationId: openDrafts[0].id, existing: true },
      linkedFollowUp: false,
    });
  } else if (quoteTalk && input.capabilities.quotations && otherQuotes.length === 1) {
    const evidenceMessages = messages.filter((message) => isCustomerStatement(message) || isSalespersonStatement(message)).slice(-2);
    const status = otherQuotes[0].status.replaceAll("_", " ");
    proposals.push({
      semanticKey: `quote:saved:${otherQuotes[0].id}`,
      actionType: "quotation_draft",
      queue: "needs_review",
      title: `Quotation is ${status}`,
      explanation: `A saved quotation is linked to this conversation. Its status is ${status}. Review it before sending anything else.`,
      evidenceMessageIds: evidenceMessages.map((message) => message.id),
      evidence: evidenceMessages.map(excerpt),
      proposedAt: null,
      hourSuggested: false,
      currentDueAt: null,
      waitingActor: "salesperson",
      priority: "high",
      missing: [],
      payload: { kind: "quotation_draft", quotationId: otherQuotes[0].id, existing: true },
      linkedFollowUp: false,
    });
  } else if (quoteTalk && input.capabilities.quotations && otherQuotes.length > 1) {
    const evidenceMessages = messages.filter((message) => isCustomerStatement(message) || isSalespersonStatement(message)).slice(-2);
    proposals.push({
      semanticKey: "quote:choose-saved",
      actionType: "quotation_choice",
      queue: "needs_review",
      title: "Choose the quotation",
      explanation: "More than one quotation is saved for this conversation. Choose the one to review. No new draft was created.",
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
        options: otherQuotes.map((quote) => ({ id: quote.id, name: `${quote.status} ${quote.id.slice(0, 8)}` })),
      },
      linkedFollowUp: false,
    });
  } else if (quoteTalk && input.capabilities.quotations) {
    const match = matchCatalogue(`${customerText}\n${salespersonText}`, input.catalogue);
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
          explanation: `I found the products and quantities discussed: ${line.quantity} × ${line.name}. Can I prepare a draft quotation for your review? It will not be sent automatically.${stockNote}`,
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
        const gapCopy = claimedDraft
          ? {
              title: "Quotation was mentioned, but no draft is linked",
              explanation: "The conversation mentions a draft, but no linked quotation was found. Please confirm the remaining details before a draft can be prepared.",
            }
          : knownNeed
            ? {
                title: "Quotation needs more information",
                explanation: "I've identified the customer's requirements. Please confirm the remaining details before I prepare the draft.",
              }
            : {
                title: "Quotation needs more information",
                explanation: "A quotation was discussed. Confirm the remaining details before a draft is prepared.",
              };
        proposals.push({
          semanticKey: "quote:incomplete",
          actionType: "quotation_missing",
          queue: "needs_review",
          title: gapCopy.title,
          explanation: gapCopy.explanation,
          evidenceMessageIds: evidenceMessages.map((message) => message.id),
          evidence: evidenceMessages.map(excerpt),
          proposedAt: null,
          hourSuggested: false,
          currentDueAt: null,
          waitingActor: "salesperson",
          priority: "medium",
          missing: Array.from(new Set(gaps)),
          payload: { kind: "quotation_missing", known: facts.map((fact) => ({ key: fact.key, value: fact.value })) },
          linkedFollowUp: false,
        });
      }
    } else {
      const gaps = [...missing];
      const gapCopy = claimedDraft
        ? {
            title: "Quotation was mentioned, but no draft is linked",
            explanation: gaps.length
              ? "The conversation mentions a draft, but no linked quotation was found. Please confirm the remaining details before a draft can be prepared."
              : "The conversation mentions a draft, but no linked quotation was found.",
          }
        : knownNeed
          ? {
              title: "Quotation needs more information",
              explanation: "I've identified the customer's requirements. Please confirm the remaining details before I prepare the draft.",
            }
          : {
              title: "Quotation needs more information",
              explanation: "A quotation was discussed. Confirm which product to include. No catalogue item was guessed.",
            };
      proposals.push({
        semanticKey: "quote:incomplete",
        actionType: "quotation_missing",
        queue: "needs_review",
        title: gapCopy.title,
        explanation: gapCopy.explanation,
        evidenceMessageIds: evidenceMessages.map((message) => message.id),
        evidence: evidenceMessages.map(excerpt),
        proposedAt: null,
        hourSuggested: false,
        currentDueAt: null,
        waitingActor: "salesperson",
        priority: "medium",
        missing: Array.from(new Set(gaps)),
        payload: {
          kind: "quotation_missing",
          known: facts.map((fact) => ({ key: fact.key, value: fact.value })),
          options:
            input.catalogue.length > 0 && input.catalogue.length <= 12
              ? input.catalogue.map((item) => ({ id: item.id, name: item.name }))
              : undefined,
        },
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

  const quoteCommitted = messages.some(
    (message) =>
      isSalespersonStatement(message) &&
      /\b(quote|quotation|draft)\b/i.test(message.body) &&
      (isFuturePromiseSentence(message.body) || /\b(prepare|send|draft)\b/i.test(message.body))
  );
  const savedQuoteVisible = openDrafts.length > 0 || otherQuotes.length > 0 || claimedDraft;
  for (let index = 0; index < proposals.length; index += 1) {
    const proposal = proposals[index];
    const quoteAction = proposal.actionType.startsWith("quotation") || proposal.actionType === "send_quotation";
    if (quoteAction && !quoteCommitted && !savedQuoteVisible) {
      proposals[index] = { ...proposal, payload: { ...proposal.payload, onDemand: true } };
    }
    if (proposal.actionType === "answer_question" && proposal.payload.onDemand !== true && proposal.semanticKey.startsWith("answer:")) {
      proposals[index] = { ...proposal, payload: { ...proposal.payload, onDemand: true } };
    }
    if (proposal.actionType === "listing_shortlist" || (proposal.actionType === "appointment" && !proposal.semanticKey.startsWith("meeting:"))) {
      proposals[index] = { ...proposal, payload: { ...proposal.payload, onDemand: true } };
    }
    if (proposal.actionType === "customer_checkin") {
      const due = proposal.proposedAt != null && new Date(proposal.proposedAt).getTime() <= Date.now();
      const accepted = messages.some(
        (message) =>
          isSalespersonStatement(message) &&
          new Date(message.createdAt).getTime() > new Date(proposal.evidence[0]?.at ?? 0).getTime() &&
          (SHORT_APPROVAL.test(message.body.trim()) || /\b(i['’]?ll wait|no problem|sounds good)\b/i.test(message.body))
      );
      if (!due && !accepted) {
        proposals[index] = { ...proposal, payload: { ...proposal.payload, onDemand: true } };
      }
    }
  }

  const uniqueProposals = new Map<string, ProposalDraft>();
  for (const proposal of proposals) uniqueProposals.set(proposal.semanticKey, proposal);
  const deduped = withoutMeetingDuplicateReminders(Array.from(uniqueProposals.values()));
  const waitingActor = deduped.find((proposal) => proposal.waitingActor)?.waitingActor ?? null;
  const summaryParts = [deduped[0] ? deduped[0].explanation : "No action is waiting on this conversation."];

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
  const proposals = analysis.proposals.map((proposal) => {
    if (proposal.actionType !== "quotation_missing" || needs.length === 0) return proposal;
    if (proposal.title.startsWith("Quotation was mentioned")) return proposal;
    const missing = proposal.missing.filter((label) => !/requirement|requested work|scope|^product$/i.test(label));
    return {
      ...proposal,
      missing,
      title: missing.length ? "Quotation needs more information" : proposal.title,
      explanation: missing.length
        ? "I've identified the customer's requirements. Please confirm the remaining details before I prepare the draft."
        : "I've identified the customer's requirements. Review them before a draft is prepared.",
    };
  });
  return { ...analysis, needs, objections, questions, proposals };
}
