import type { SalesActor } from "./types";

const UNSUPPORTED: Array<{ re: RegExp; message: string }> = [
  {
    re: /\bdelete (all |every )?(customers?|leads?|deals?|quotations?|users?)\b/i,
    message: "That action isn't available through Sales Command Center.",
  },
  {
    re: /\b(create|add) (a )?(new )?(user|admin|salesperson|role)\b/i,
    message: "User and permission changes are not available through Sales Command Center.",
  },
  {
    re: /\b(grant|change|elevate) (role|permission|access)\b/i,
    message: "User and permission changes are not available through Sales Command Center.",
  },
  {
    re: /\b(create|add) (a )?(new )?(product|inverter|battery|sku)\b/i,
    message: "Sales Command Center cannot create Products. Open Products or ask a manager.",
  },
  {
    re: /\b(set|adjust|change|update).{0,40}(stock|inventory|on hand|on-hand)\b/i,
    message: "Inventory adjustments require the Inventory workflow.",
  },
  {
    re: /\b(change|set|update).{0,40}(master |catalogue |catalog |product )price\b/i,
    message: "Product master prices cannot be changed from Sales Command Center.",
  },
  {
    re: /\b(change|set).{0,40}(default )?(quotation )?validity\b/i,
    message: "Company quotation defaults are managed in settings, not Sales Command Center.",
  },
  {
    re: /\b(change|rewrite|edit).{0,40}(company brain|pricing policy|discount policy|agent autonomy)\b/i,
    message: "Company Brain and commercial policy cannot be changed from Sales Command Center.",
  },
  {
    re: /\b(approve|self-approve) (this |the |my )?(quote|quotation)\b/i,
    message: "Quotations cannot be approved through Sales Command Center. Use the existing approval workflow.",
  },
  {
    re: /\b(what('?s| is) (our |the )?cost|show (me )?(the )?margin|supplier price)\b/i,
    message: "Cost and margin are not available through Sales Command Center unless you have permission on the quotation page.",
  },
  {
    re: /\b(weather|joke|poem|recipe)\b/i,
    message: "Sales Command Center is for preparing quotations and managing your sales work.",
  },
];

const FUTURE: Array<{ re: RegExp; message: string }> = [
  {
    re: /\b(follow up|follow-up).{0,40}(friday|tomorrow|next week|monday)\b/i,
    message: "Follow-up commands aren't available in Sales Command Center yet. Create the task from Tasks.",
  },
  {
    re: /\b(book|schedule).{0,30}(site visit|appointment|meeting)\b/i,
    message: "Appointment booking isn't available in Sales Command Center yet. Use Calendar.",
  },
  {
    re: /\b(move|change).{0,20}(this )?deal.{0,20}(to )?(negotiat|scoping|proposal|qualified)\b/i,
    message: "Deal stage changes aren't available in Sales Command Center yet. Open the Deal to update the stage.",
  },
  {
    re: /\b(what should i (work on|quote)|next best action)\b/i,
    message: "Next-best-action recommendations aren't available in Sales Command Center yet. Check Today's plan on Dashboard.",
  },
];

export function matchUnsupportedSalesCommand(text: string): string | null {
  const t = text.trim();
  for (const row of UNSUPPORTED) {
    if (row.re.test(t)) return row.message;
  }
  return null;
}

export function matchFutureSalesCommand(text: string): string | null {
  const t = text.trim();
  for (const row of FUTURE) {
    if (row.re.test(t)) return row.message;
  }
  return null;
}

export function looksLikeConfirm(text: string): boolean {
  return /^(yes|y|confirm|ok|okay|do it|go ahead|proceed|prepare( it)?|create( it)?)\b/i.test(text.trim());
}

export function looksLikeCancel(text: string): boolean {
  return /^(no|n|cancel|stop|never mind|nevermind)\b/i.test(text.trim());
}

export function actorOwnsLead(assignedToId: string | null, actor: SalesActor): boolean {
  return assignedToId === actor.userId;
}

export function actorOwnsDeal(ownerId: string | null, actor: SalesActor): boolean {
  return ownerId === actor.userId;
}
