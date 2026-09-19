import { assembleCompanyBrainContext, serializeCompanyBrainContext } from "@/lib/company-brain";
import { getAgentModelProvider } from "@/lib/agent/provider";
import { classifySocialIntent } from "./intent";
import type { SocialConversationDetail } from "./types";

function fallbackDraft(detail: SocialConversationDetail): string {
  const name = detail.intelligence.displayName.split(" ")[0] ?? "there";
  const product = detail.intelligence.detectedProduct;
  const location = detail.intelligence.detectedLocation;
  if (detail.replyMode === "public_comment") {
    return `Hi ${name}, we have sent you more information privately.`;
  }
  const bits = [`Hi ${name},`];
  if (product && location) {
    bits.push(
      `I can help with the ${product} and the ${location} question. I will confirm current pricing and coverage rather than guess.`
    );
  } else if (product) {
    bits.push(`I can help with the ${product}. I will confirm the current figures before I send them.`);
  } else {
    bits.push("Thanks for getting in touch. I will confirm the details you asked about and come back with an accurate answer.");
  }
  return bits.join(" ");
}

export async function suggestSocialReply(opts: {
  clientId: string;
  detail: SocialConversationDetail;
}): Promise<{ draft: string; source: "ai" | "template" }> {
  const latestInbound = [...opts.detail.messages].reverse().find((m) => m.direction === "inbound" && !m.isInternalNote);
  const customerMessage = latestInbound?.body || opts.detail.conversation.preview;
  let brainBlock = "";
  try {
    const assembled = await assembleCompanyBrainContext({
      clientId: opts.clientId,
      customerMessage,
      productInterest: opts.detail.intelligence.detectedProduct,
    });
    brainBlock = serializeCompanyBrainContext(assembled);
  } catch {
    brainBlock = "";
  }

  try {
    const provider = getAgentModelProvider();
    const system = [
      "You draft a short sales reply for Facebook or Instagram.",
      "The salesperson will review it before sending. Do not send anything yourself.",
      "Never invent prices, stock, delivery coverage, or financing terms.",
      "If a fact is missing, ask the right question or say you will confirm.",
      "Keep it under 80 words. No emojis unless the customer used them.",
      "If this is a public comment, keep the public reply brief and move detail to a private message.",
      brainBlock,
    ]
      .filter(Boolean)
      .join("\n");
    const history = opts.detail.messages
      .filter((m) => !m.isInternalNote)
      .slice(-8)
      .map((m) => `${m.direction === "inbound" ? "Customer" : "Sales"}: ${m.body}`)
      .join("\n");
    const res = await provider.generate({
      system,
      messages: [
        {
          role: "user",
          text: [
            `Reply mode: ${opts.detail.replyMode}`,
            `Product: ${opts.detail.intelligence.detectedProduct ?? "unknown"}`,
            `Location: ${opts.detail.intelligence.detectedLocation ?? "unknown"}`,
            `Intent: ${opts.detail.intelligence.reasons.join(", ") || "unspecified"}`,
            history || customerMessage,
            "Draft the reply only. No preamble.",
          ].join("\n"),
        },
      ],
      maxTokens: 220,
      temperature: 0.3,
    });
    const draft = (res.text ?? "").trim();
    if (draft) return { draft, source: "ai" };
  } catch (err) {
    console.warn("[social-inbox] suggest reply fallback", err);
  }
  return { draft: fallbackDraft(opts.detail), source: "template" };
}

export async function summarizeSocialConversation(detail: SocialConversationDetail): Promise<string> {
  if (detail.intelligence.summary) return detail.intelligence.summary;
  const inbound = detail.messages.filter((m) => m.direction === "inbound" && !m.isInternalNote);
  if (!inbound.length) return "No customer messages yet.";
  const last = inbound[inbound.length - 1]!.body;
  const classified = classifySocialIntent({
    text: last,
    conversationKind: detail.conversation.conversationKind,
  });
  const parts = [
    classified.detectedProduct ? `Interested in ${classified.detectedProduct}.` : null,
    classified.detectedLocation ? `Asked about ${classified.detectedLocation}.` : null,
    classified.reasons[0] ? classified.reasons[0] + "." : null,
    detail.intelligence.crm.openDealName ? `Open deal: ${detail.intelligence.crm.openDealName}.` : null,
    detail.conversation.unread ? "Customer is waiting for a reply." : null,
  ].filter(Boolean);
  return parts.join(" ") || last.slice(0, 180);
}
