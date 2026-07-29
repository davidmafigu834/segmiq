/**
 * Soft-fail WhatsApp helpers for real-estate events.
 * Templates must be Meta-approved before production sends succeed;
 * failures are logged and never throw to callers.
 */

import { sendWhatsApp } from "@/lib/messaging/provider";
import { firstName } from "@/lib/messaging/whatsapp-vars";
import type { TemplateKey } from "@/lib/messaging/meta-whatsapp";
import { listingLabel } from "@/lib/real-estate/helpers";

type SoftSendArgs = {
  to: string | null | undefined;
  template: TemplateKey;
  variables: Record<string, string>;
  fallbackBody: string;
  clientId: string;
  leadId?: string | null;
  userId?: string | null;
  notificationType?: string;
};

async function softSend(args: SoftSendArgs): Promise<void> {
  try {
    await sendWhatsApp({
      to: args.to,
      template: args.template,
      variables: args.variables,
      fallbackBody: args.fallbackBody,
      context: {
        clientId: args.clientId,
        leadId: args.leadId ?? null,
        userId: args.userId ?? null,
        notificationType: args.notificationType ?? args.template,
      },
    });
  } catch (err) {
    console.error(`[real-estate/wa] ${args.template} failed:`, err);
  }
}

export async function notifyViewingConfirmation(params: {
  clientId: string;
  to: string | null | undefined;
  contactName: string | null;
  listing: { address?: string | null; suburb?: string | null };
  scheduledAt: string;
  agentName?: string | null;
}): Promise<void> {
  const when = new Date(params.scheduledAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const property = listingLabel(params.listing);
  await softSend({
    to: params.to,
    template: "VIEWING_CONFIRMATION",
    variables: {
      "1": firstName(params.contactName) || "there",
      "2": property,
      "3": when,
      "4": params.agentName?.trim() || "your agent",
    },
    fallbackBody: `Hi ${firstName(params.contactName) || "there"}, your viewing at ${property} is confirmed for ${when}.`,
    clientId: params.clientId,
    notificationType: "VIEWING_CONFIRMATION",
  });
}

export async function notifyViewingFeedbackRequest(params: {
  clientId: string;
  to: string | null | undefined;
  contactName: string | null;
  listing: { address?: string | null; suburb?: string | null };
}): Promise<void> {
  const property = listingLabel(params.listing);
  await softSend({
    to: params.to,
    template: "VIEWING_FEEDBACK_REQUEST",
    variables: {
      "1": firstName(params.contactName) || "there",
      "2": property,
    },
    fallbackBody: `Hi ${firstName(params.contactName) || "there"}, how was your viewing at ${property}?`,
    clientId: params.clientId,
    notificationType: "VIEWING_FEEDBACK_REQUEST",
  });
}

export async function notifyPropertyMatch(params: {
  clientId: string;
  to: string | null | undefined;
  contactName: string | null;
  listing: { address?: string | null; suburb?: string | null; price?: number | null };
  leadId?: string | null;
}): Promise<void> {
  const property = listingLabel(params.listing);
  const price =
    params.listing.price != null
      ? `$${Number(params.listing.price).toLocaleString("en-US")}`
      : "Price on request";
  await softSend({
    to: params.to,
    template: "PROPERTY_MATCH_ALERT",
    variables: {
      "1": firstName(params.contactName) || "there",
      "2": property,
      "3": price,
    },
    fallbackBody: `Hi ${firstName(params.contactName) || "there"}, a new property may match: ${property} (${price}).`,
    clientId: params.clientId,
    leadId: params.leadId,
    notificationType: "PROPERTY_MATCH_ALERT",
  });
}

export async function notifyOfferUpdate(params: {
  clientId: string;
  to: string | null | undefined;
  contactName: string | null;
  listing: { address?: string | null; suburb?: string | null };
  offerStatus: string;
  offerAmount?: number | null;
  leadId?: string | null;
}): Promise<void> {
  const property = listingLabel(params.listing);
  const amount =
    params.offerAmount != null
      ? `$${Number(params.offerAmount).toLocaleString("en-US")}`
      : "—";
  await softSend({
    to: params.to,
    template: "OFFER_UPDATE",
    variables: {
      "1": firstName(params.contactName) || "there",
      "2": property,
      "3": params.offerStatus,
      "4": amount,
    },
    fallbackBody: `Offer update on ${property}: ${params.offerStatus} (${amount}).`,
    clientId: params.clientId,
    leadId: params.leadId,
    notificationType: "OFFER_UPDATE",
  });
}
