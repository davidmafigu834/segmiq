/**
 * Development / preview fixtures for Social Inbox.
 * African machinery + solar conversations. Never mixed with live Meta data.
 */

import type {
  SocialConversationDetail,
  SocialInboxWorkspace,
  SocialMessageDto,
  SocialQueueItem,
} from "./types";
import { decorateQueueItem, computeIndicators, matchesView, sortQueue } from "./ranking";
import type { SocialInboxViewId } from "./types";

const NOW = Date.now();
function ago(hours: number, minutes = 0): string {
  return new Date(NOW - hours * 3600_000 - minutes * 60_000).toISOString();
}

function msg(
  id: string,
  direction: "inbound" | "outbound",
  body: string,
  sentAt: string,
  extra?: Partial<SocialMessageDto>
): SocialMessageDto {
  return {
    id,
    direction,
    visibility: extra?.visibility ?? "private",
    body,
    isInternalNote: extra?.isInternalNote ?? false,
    sendStatus: extra?.sendStatus ?? "sent",
    sendError: extra?.sendError ?? null,
    aiDraft: extra?.aiDraft ?? false,
    sentAt,
    actorName: extra?.actorName ?? (direction === "outbound" ? "You" : null),
  };
}

const QUEUE: SocialQueueItem[] = [
  {
    conversationId: "demo-tendai",
    opportunityId: "demo-opp-tendai",
    displayName: "Tendai Moyo",
    username: "tendai.moyo",
    avatarUrl: null,
    channel: "facebook_ad_comment",
    conversationKind: "comment",
    visibility: "public",
    preview: "How much deposit do I need for this machine?",
    lastMessageAt: ago(0, 18),
    unread: true,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 94,
    intentBand: "hot",
    intentReasons: ["Asked about price", "Asked if it is still available", "Asked about financing or deposit"],
    detectedProduct: "CAT 320 Excavator",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: "Hot",
    origin: {
      kind: "advertisement",
      campaignName: "CAT 320 Excavator Campaign",
      campaignId: "demo-camp-320",
      adName: "CAT 320 in stock - Harare",
      adId: "demo-ad-320",
      postId: "demo-post-320",
      permalink: null,
      caption: "CAT 320 excavator ready for site work. Enquire for viewing.",
      customerQuote: "How much deposit do I need for this machine?",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-brian",
    opportunityId: "demo-opp-brian",
    displayName: "Brian Ncube",
    username: "brian.solar",
    avatarUrl: null,
    channel: "instagram_dm",
    conversationKind: "dm",
    visibility: "private",
    preview: "Can you quote me for a 5kVA system?",
    lastMessageAt: ago(1, 12),
    unread: true,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 88,
    intentBand: "hot",
    intentReasons: ["Requested a quotation", "Asked about installation"],
    detectedProduct: "5kVA Solar System",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: "Hot",
    origin: {
      kind: "organic",
      campaignName: null,
      campaignId: null,
      adName: null,
      adId: null,
      postId: null,
      permalink: null,
      caption: null,
      customerQuote: "Hi, do you guys install solar systems in Chitungwiza?",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-rudo",
    opportunityId: "demo-opp-rudo",
    displayName: "Rudo Sibanda",
    username: null,
    avatarUrl: null,
    channel: "facebook_messenger",
    conversationKind: "dm",
    visibility: "private",
    preview: "I should have the funds next Thursday.",
    lastMessageAt: ago(28, 0),
    unread: false,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 76,
    intentBand: "hot",
    intentReasons: ["Asked about financing or deposit", "Committed to a later follow-up"],
    detectedProduct: "CAT 320 Excavator",
    followUpLabel: "Follow up today",
    crmState: "none",
    primaryLabel: "Follow up today",
    origin: {
      kind: "organic",
      campaignName: null,
      campaignId: null,
      adName: null,
      adId: null,
      postId: null,
      permalink: null,
      caption: null,
      customerQuote: "How much deposit do I need for this excavator?",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-chipo",
    opportunityId: "demo-opp-chipo",
    displayName: "Chipo Dube",
    username: "chipo.dube",
    avatarUrl: null,
    channel: "facebook_messenger",
    conversationKind: "dm",
    visibility: "private",
    preview: "Is the CAT 320 we discussed still on the yard?",
    lastMessageAt: ago(2, 40),
    unread: true,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 81,
    intentBand: "hot",
    intentReasons: ["Asked if it is still available"],
    detectedProduct: "CAT 320 Excavator",
    followUpLabel: null,
    crmState: "open_deal",
    primaryLabel: "Open deal",
    origin: {
      kind: "organic",
      campaignName: null,
      campaignId: null,
      adName: null,
      adId: null,
      postId: null,
      permalink: null,
      caption: null,
      customerQuote: null,
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-tawanda",
    opportunityId: "demo-opp-tawanda",
    displayName: "Tawanda Chirwa",
    username: "tawanda.c",
    avatarUrl: null,
    channel: "instagram_comment",
    conversationKind: "comment",
    visibility: "public",
    preview: "Is this still available?",
    lastMessageAt: ago(3, 5),
    unread: true,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 58,
    intentBand: "warm",
    intentReasons: ["Asked if it is still available"],
    detectedProduct: "CAT 320 Excavator",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: "Needs reply",
    origin: {
      kind: "reel",
      campaignName: null,
      campaignId: null,
      adName: null,
      adId: null,
      postId: "demo-reel-1",
      permalink: null,
      caption: "Walkaround of the CAT 320 before it leaves the yard.",
      customerQuote: "Is this still available?",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-nyasha",
    opportunityId: "demo-opp-nyasha",
    displayName: "Nyasha Dube",
    username: "nyasha.dube",
    avatarUrl: null,
    channel: "instagram_comment",
    conversationKind: "comment",
    visibility: "public",
    preview: "Can someone call me about the 10kVA package?",
    lastMessageAt: ago(5, 20),
    unread: true,
    assignedToId: null,
    assignedToName: null,
    intentScore: 91,
    intentBand: "hot",
    intentReasons: ["Asked to be called back", "Named a product or package"],
    detectedProduct: "10kVA Solar Package",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: "Hot",
    origin: {
      kind: "organic",
      campaignName: null,
      campaignId: null,
      adName: null,
      adId: null,
      postId: null,
      permalink: null,
      caption: null,
      customerQuote: "Can someone call me about the 10kVA package?",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-farai",
    opportunityId: null,
    displayName: "Farai Mutasa",
    username: "farai.mutasa",
    avatarUrl: null,
    channel: "facebook_comment",
    conversationKind: "comment",
    visibility: "public",
    preview: "Great machine",
    lastMessageAt: ago(6, 10),
    unread: false,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 8,
    intentBand: "cold",
    intentReasons: [],
    detectedProduct: "CAT 320 Excavator",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: null,
    origin: {
      kind: "post",
      campaignName: null,
      campaignId: null,
      adName: null,
      adId: null,
      postId: "demo-post-320",
      permalink: null,
      caption: "CAT 320 excavator ready for site work. Enquire for viewing.",
      customerQuote: "Great machine",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-blessing",
    opportunityId: "demo-opp-blessing",
    displayName: "Blessing Phiri",
    username: null,
    avatarUrl: null,
    channel: "facebook_ad_comment",
    conversationKind: "comment",
    visibility: "public",
    preview: "Can you deliver to Bulawayo and what is the deposit?",
    lastMessageAt: ago(8, 0),
    unread: true,
    assignedToId: null,
    assignedToName: null,
    intentScore: 86,
    intentBand: "hot",
    intentReasons: ["Asked about price", "Asked about delivery"],
    detectedProduct: "CAT 320 Excavator",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: "Hot",
    origin: {
      kind: "advertisement",
      campaignName: "CAT 320 Excavator Campaign",
      campaignId: "demo-camp-320",
      adName: "CAT 320 in stock - Harare",
      adId: "demo-ad-320",
      postId: "demo-post-320",
      permalink: null,
      caption: "CAT 320 excavator ready for site work. Enquire for viewing.",
      customerQuote: "Can you deliver to Bulawayo and what is the deposit?",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-tatenda",
    opportunityId: "demo-opp-tatenda",
    displayName: "Tatenda M.",
    username: "tatenda.m",
    avatarUrl: null,
    channel: "instagram_dm",
    conversationKind: "dm",
    visibility: "private",
    preview: "Can you quote me for a 5kVA solar system?",
    lastMessageAt: ago(0, 42),
    unread: true,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 88,
    intentBand: "hot",
    intentReasons: ["Asked for a quotation", "Named a product or package"],
    detectedProduct: "5kVA Hybrid System",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: "Hot",
    origin: {
      kind: "organic",
      campaignName: null,
      campaignId: null,
      adName: null,
      adId: null,
      postId: null,
      permalink: null,
      caption: null,
      customerQuote: "Can you quote me for a 5kVA solar system?",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-chiedza",
    opportunityId: null,
    displayName: "Chiedza Ncube",
    username: "chiedza.n",
    avatarUrl: null,
    channel: "facebook_comment",
    conversationKind: "comment",
    visibility: "public",
    preview: "Beautiful machine",
    lastMessageAt: ago(1, 40),
    unread: false,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 6,
    intentBand: "cold",
    intentReasons: [],
    detectedProduct: "CAT 320 Excavator",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: null,
    origin: {
      kind: "advertisement",
      campaignName: "CAT 320 Excavator Campaign",
      campaignId: "demo-camp-320",
      adName: "CAT 320 in stock - Harare",
      adId: "demo-ad-320",
      postId: "demo-post-320",
      permalink: null,
      caption: "CAT 320 excavator ready for site work. Enquire for viewing.",
      customerQuote: "Beautiful machine",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-tarisai",
    opportunityId: null,
    displayName: "Tarisai K.",
    username: "tarisai.k",
    avatarUrl: null,
    channel: "facebook_ad_comment",
    conversationKind: "comment",
    visibility: "public",
    preview: "Nice",
    lastMessageAt: ago(2, 5),
    unread: false,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 4,
    intentBand: "cold",
    intentReasons: [],
    detectedProduct: "CAT 320 Excavator",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: null,
    origin: {
      kind: "advertisement",
      campaignName: "CAT 320 Excavator Campaign",
      campaignId: "demo-camp-320",
      adName: "CAT 320 in stock - Harare",
      adId: "demo-ad-320",
      postId: "demo-post-320",
      permalink: null,
      caption: "CAT 320 excavator ready for site work. Enquire for viewing.",
      customerQuote: "Nice",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-gifts",
    opportunityId: null,
    displayName: "Gifts Moyo",
    username: null,
    avatarUrl: null,
    channel: "instagram_comment",
    conversationKind: "comment",
    visibility: "public",
    preview: "This is fire",
    lastMessageAt: ago(0, 50),
    unread: false,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 5,
    intentBand: "cold",
    intentReasons: [],
    detectedProduct: null,
    followUpLabel: null,
    crmState: "none",
    primaryLabel: null,
    origin: {
      kind: "reel",
      campaignName: null,
      campaignId: null,
      adName: null,
      adId: null,
      postId: "demo-reel-1",
      permalink: null,
      caption: "Walkaround of the CAT 320 before it leaves the yard.",
      customerQuote: "This is fire",
    },
    isDemo: true,
    rankScore: 0,
  },
  {
    conversationId: "demo-gweru",
    opportunityId: "demo-opp-gweru",
    displayName: "Tariro Ndlovu",
    username: "tariro.n",
    avatarUrl: null,
    channel: "facebook_ad_comment",
    conversationKind: "comment",
    visibility: "public",
    preview: "Do you deliver to Gweru?",
    lastMessageAt: ago(4, 12),
    unread: true,
    assignedToId: "demo-rep",
    assignedToName: "You",
    intentScore: 62,
    intentBand: "warm",
    intentReasons: ["Asked about delivery", "Asked about location or service area"],
    detectedProduct: "CAT 320 Excavator",
    followUpLabel: null,
    crmState: "none",
    primaryLabel: "Needs reply",
    origin: {
      kind: "advertisement",
      campaignName: "CAT 320 Excavator Campaign",
      campaignId: "demo-camp-320",
      adName: "CAT 320 in stock - Harare",
      adId: "demo-ad-320",
      postId: "demo-post-320",
      permalink: null,
      caption: "CAT 320 excavator ready for site work. Enquire for viewing.",
      customerQuote: "Do you deliver to Gweru?",
    },
    isDemo: true,
    rankScore: 0,
  },
];

const THREADS: Record<string, SocialMessageDto[]> = {
  "demo-tendai": [
    msg("t1", "inbound", "How much deposit do I need for this machine?", ago(0, 18), {
      visibility: "public",
    }),
  ],
  "demo-brian": [
    msg("b1", "inbound", "Hi, do you guys install solar systems in Chitungwiza?", ago(3, 0)),
    msg("b2", "outbound", "Yes Brian, we install in Chitungwiza. Which size are you looking at?", ago(2, 40), {
      actorName: "You",
    }),
    msg("b3", "inbound", "Can you quote me for a 5kVA system?", ago(1, 12)),
  ],
  "demo-tatenda": [
    msg("tt1", "inbound", "Can you quote me for a 5kVA solar system?", ago(0, 42)),
  ],
  "demo-rudo": [
    msg("r1", "inbound", "How much deposit do I need for this excavator?", ago(96, 0)),
    msg("r2", "outbound", "Hi Rudo, we typically work on a 30% deposit. I can walk you through the figures.", ago(95, 0), {
      actorName: "You",
    }),
    msg("r3", "inbound", "I should have the funds next Thursday.", ago(28, 0)),
  ],
  "demo-chipo": [
    msg("c1", "inbound", "Is the CAT 320 we discussed still on the yard?", ago(2, 40)),
  ],
  "demo-tawanda": [
    msg("tw1", "inbound", "Is this still available?", ago(3, 5), { visibility: "public" }),
  ],
  "demo-nyasha": [
    msg("n1", "inbound", "Can someone call me about the 10kVA package?", ago(5, 20), {
      visibility: "public",
    }),
  ],
  "demo-farai": [
    msg("f1", "inbound", "Great machine", ago(6, 10), { visibility: "public" }),
  ],
  "demo-blessing": [
    msg("bl1", "inbound", "Can you deliver to Bulawayo and what is the deposit?", ago(8, 0), {
      visibility: "public",
    }),
  ],
  "demo-chiedza": [
    msg("ch1", "inbound", "Beautiful machine", ago(1, 40), { visibility: "public" }),
  ],
  "demo-tarisai": [
    msg("tr1", "inbound", "Nice", ago(2, 5), { visibility: "public" }),
  ],
  "demo-gifts": [
    msg("g1", "inbound", "This is fire", ago(0, 50), { visibility: "public" }),
  ],
  "demo-gweru": [
    msg("gw1", "inbound", "Do you deliver to Gweru?", ago(4, 12), { visibility: "public" }),
  ],
};

function intelligenceFor(item: SocialQueueItem): SocialConversationDetail["intelligence"] {
  const existing =
    item.conversationId === "demo-chipo"
      ? {
          state: "open_deal" as const,
          contactId: "demo-contact-chipo",
          leadId: "demo-lead-chipo",
          dealId: "demo-deal-chipo",
          customerName: "Chipo Dube",
          openDealName: "CAT 320 - proposal sent",
          match: {
            contactId: "demo-contact-chipo",
            leadId: "demo-lead-chipo",
            dealId: "demo-deal-chipo",
            name: "Chipo Dube",
            reason: "Existing CRM customer with an open deal",
            confidence: "high" as const,
            openDealName: "CAT 320 - proposal sent",
            previousEnquiryCount: 2,
          },
        }
      : {
          state: item.crmState,
          contactId: null,
          leadId: item.crmState === "converted" ? "demo-lead" : null,
          dealId: null,
          customerName: null,
          openDealName: null,
          match: null,
        };

  const next =
    item.conversationId === "demo-tendai"
      ? {
          label: "Answer financing question and qualify purchase timeline.",
          code: "reply",
          followUpAt: null,
          followUpReason: "Customer asked about deposit, financing and availability on a CAT 320 ad.",
        }
      : item.conversationId === "demo-brian" || item.conversationId === "demo-tatenda"
      ? { label: "Prepare quotation", code: "create_quote", followUpAt: null, followUpReason: null }
      : item.conversationId === "demo-chipo"
        ? {
            label: "Follow up on quotation.",
            code: "open_deal",
            followUpAt: null,
            followUpReason: "Open deal is in negotiating. Quotation Q-1041 is outstanding.",
          }
      : item.conversationId === "demo-rudo"
        ? {
            label: "Send follow-up",
            code: "create_follow_up",
            followUpAt: new Date().toISOString(),
            followUpReason: "Customer said funds would be ready Thursday. No follow-up has been sent yet.",
          }
        : item.conversationId === "demo-nyasha" || item.conversationId === "demo-blessing"
          ? { label: "Assign salesperson now.", code: "assign", followUpAt: null, followUpReason: null }
          : item.intentBand === "hot"
            ? { label: "Reply and convert to lead", code: "convert_lead", followUpAt: null, followUpReason: null }
            : { label: "Reply if useful", code: "reply", followUpAt: null, followUpReason: null };

  const summaries: Record<string, string> = {
    "demo-tendai":
      "Customer is interested in the CAT 320. Asked about deposit on a Facebook advertisement. Not in CRM yet.",
    "demo-brian":
      "Instagram DM. Installs in Chitungwiza. Now asked for a 5kVA quotation.",
    "demo-tatenda":
      "Instagram DM. Requested a quotation for a 5kVA hybrid solar system.",
    "demo-rudo":
      "Discussed 30% deposit. Customer will confirm financing Thursday. Follow-up is due.",
    "demo-chipo":
      "Existing customer. Open deal on CAT 320, proposal sent. Quotation Q-1041 is outstanding. Asking if the machine is still on the yard.",
    "demo-nyasha":
      "Instagram comment. Asked to be called about the 10kVA package. Unassigned for 2 hours.",
    "demo-blessing":
      "Ad comment. Delivery to Bulawayo and deposit. Unassigned high-intent opportunity.",
    "demo-gweru":
      "Asked whether CAT 320 can be delivered to Gweru. Warm buying signal.",
  };

  return {
    displayName: item.displayName,
    username: item.username,
    avatarUrl: item.avatarUrl,
    channel: item.channel,
    assignedToName: item.assignedToName,
    intentScore: item.intentScore,
    intentBand: item.intentBand,
    reasons: item.intentReasons,
    signals: [],
    detectedProduct: item.detectedProduct,
    detectedLocation:
      item.conversationId === "demo-brian"
        ? "Chitungwiza"
        : item.conversationId === "demo-nyasha"
          ? "Ruwa"
          : item.conversationId === "demo-blessing" || item.conversationId === "demo-tendai"
            ? "Bulawayo"
            : item.conversationId === "demo-gweru"
              ? "Gweru"
            : null,
    origin: item.origin,
    crm: existing,
    nextAction: next,
    summary: summaries[item.conversationId] ?? null,
  };
}

export function getDemoWorkspace(opts: {
  view: SocialInboxViewId;
  viewerId: string;
  canViewUnassigned: boolean;
  canAssign: boolean;
  canManageChannels: boolean;
  canReply: boolean;
}): SocialInboxWorkspace {
  const scoped = QUEUE.filter((item) => {
    if (!opts.canViewUnassigned && !item.assignedToId) return false;
    if (!opts.canViewUnassigned && item.assignedToId && item.assignedToId !== "demo-rep" && item.assignedToId !== opts.viewerId) {
      return false;
    }
    return matchesView(item, opts.view);
  });
  const items = sortQueue(scoped, opts.view, opts.viewerId).map((item) =>
    decorateQueueItem({ ...item, assignedToId: item.assignedToId === "demo-rep" ? opts.viewerId : item.assignedToId }, opts.viewerId)
  );
  return {
    view: opts.view,
    items,
    nextCursor: null,
    indicators: computeIndicators(QUEUE.map((i) => decorateQueueItem(i, opts.viewerId))),
    connections: [
      {
        id: "demo-fb",
        provider: "facebook",
        channelKind: "page",
        status: "connected",
        displayName: "Sample Facebook Page",
        username: null,
        pageId: "demo-page",
        igAccountId: null,
        scopesOk: true,
        lastSyncAt: ago(0, 5),
        lastEventAt: ago(0, 18),
        lastError: null,
        isDemo: true,
      },
      {
        id: "demo-ig",
        provider: "instagram",
        channelKind: "ig_business",
        status: "connected",
        displayName: "Sample Instagram",
        username: "sample.solar",
        pageId: "demo-page",
        igAccountId: "demo-ig",
        scopesOk: true,
        lastSyncAt: ago(0, 5),
        lastEventAt: ago(1, 12),
        lastError: null,
        isDemo: true,
      },
    ],
    connectionState: "demo",
    canViewUnassigned: opts.canViewUnassigned,
    canManageChannels: opts.canManageChannels,
    canAssign: opts.canAssign,
    canReply: opts.canReply,
    team: [
      { id: opts.viewerId, name: "You" },
      { id: "rep-tawanda", name: "Tawanda M." },
      { id: "rep-farai", name: "Farai T." },
      { id: "rep-nyasha", name: "Nyasha C." },
    ],
    isDemo: true,
  };
}

export function getDemoConversation(
  conversationId: string,
  viewerId: string
): SocialConversationDetail | null {
  const raw = QUEUE.find((i) => i.conversationId === conversationId);
  if (!raw) return null;
  const item = decorateQueueItem(
    { ...raw, assignedToId: raw.assignedToId === "demo-rep" ? viewerId : raw.assignedToId },
    viewerId
  );
  return {
    conversation: item,
    messages: THREADS[conversationId] ?? [],
    intelligence: intelligenceFor(item),
    replyMode: item.conversationKind === "comment" ? "public_comment" : "private_dm",
    canReply: true,
    canConvert: item.crmState !== "converted",
    canCreateDeal: true,
    canCreateQuote: true,
    canAssign: true,
  };
}

export const DEMO_SUGGESTED_REPLIES: Record<string, string> = {
  "demo-tendai":
    "Hi Tendai, yes, the CAT 320 is available. Are you looking to purchase outright or through financing?",
  "demo-brian":
    "Hi Brian, I can prepare a 5kVA quotation for Chitungwiza. I will use the standard package and send it for your review shortly.",
  "demo-tatenda":
    "Hi Tatenda, I can prepare a quotation for the 5kVA hybrid system. I will use the current package and send it for your review.",
  "demo-rudo":
    "Hi Rudo, checking in as discussed. Have you managed to arrange the financing for the CAT 320?",
  "demo-nyasha":
    "Hi Nyasha, yes we can call you about the 10kVA package. What is the best number and time today?",
  "demo-blessing":
    "Hi Blessing, we can discuss delivery to Bulawayo. I have sent you the deposit details privately.",
  "demo-tawanda":
    "Hi Tawanda, yes it is still available. I have sent you more information privately.",
  "demo-chipo":
    "Hi Chipo, I am checking the CAT 320 against your open deal now and will confirm if it is still on the yard.",
  "demo-gweru":
    "Hi Tariro, yes we deliver to Gweru. I can send the transport estimate with the machine details privately.",
};

export const DEMO_CRM_CUSTOMERS = [
  {
    id: "crm-tendai",
    name: "Tendai Moyo",
    phone: "+263 77 214 8831",
    email: "tendai.moyo@example.co.zw",
    previousEnquiries: 2,
    openDeals: 1,
    note: "2 previous enquiries · 1 open deal",
  },
  {
    id: "crm-chipo",
    name: "Chipo Dube",
    phone: "+263 71 445 2290",
    email: "chipo@example.co.zw",
    previousEnquiries: 3,
    openDeals: 1,
    note: "Customer since May 2026 · CAT 320 deal open",
  },
  {
    id: "crm-brian",
    name: "Brian Ncube",
    phone: "+263 78 112 4402",
    email: "brian.n@example.co.zw",
    previousEnquiries: 1,
    openDeals: 0,
    note: "1 previous enquiry",
  },
] as const;

export const DEMO_PRODUCTS = [
  { id: "p-cat320", name: "CAT 320 Excavator", detail: "Used equipment · Harare yard" },
  { id: "p-cat336", name: "CAT 336 Excavator", detail: "Used equipment" },
  { id: "p-5kva", name: "5kVA Hybrid System", detail: "Solar · installation available" },
  { id: "p-42kva", name: "4.2kVA Solar System", detail: "Solar · Ruwa / Harare" },
  { id: "p-10kva", name: "10kVA Solar Package", detail: "Solar · commercial" },
  { id: "p-jcb", name: "JCB 3CX", detail: "Backhoe · in transit" },
  { id: "p-hilux", name: "Toyota Hilux", detail: "Double cab" },
] as const;
