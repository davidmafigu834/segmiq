/**
 * Sales Agent handlers for Today's Focus / Next Best Action / Call Brief / Draft.
 */

import {
  buildCallBrief,
  buildSalesContextSummary,
  draftFollowupMessage,
  getTodaysFocus,
  type SalesAttentionItem,
} from "@/lib/sales/attention";
import type { SalesActor, SalesBlock } from "@/lib/agent/sales/types";
import type { CommandOutcome } from "@/lib/agent/sales/quotation-command";

function itemActions(item: SalesAttentionItem): SalesBlock {
  return {
    type: "actions",
    actions: item.actions
      .filter((a) => a.kind !== "snooze" && a.kind !== "done" && a.kind !== "not_relevant")
      .slice(0, 4)
      .map((a) => ({
        label: a.label,
        href: a.href,
        prompt: a.prompt,
        style: a.primary ? "primary" : "secondary",
      })),
  };
}

function formatItemLine(item: SalesAttentionItem, index: number): string {
  const n = String(index + 1).padStart(2, "0");
  const who = item.customerName || item.title;
  const why = item.whyNow;
  return `${n}  ${item.type.replace(/_/g, " ")}\n    ${who}\n    ${why}`;
}

export async function runGetTodaysFocus(opts: {
  actor: SalesActor;
  filter?: "ALL" | "IMMEDIATE" | "TODAY" | "NEEDS_PROGRESS" | "WATCH";
}): Promise<CommandOutcome> {
  const focus = await getTodaysFocus({
    userId: opts.actor.userId,
    clientId: opts.actor.clientId,
    filter: opts.filter,
  });

  if (focus.planError) {
    return {
      reply: focus.emptyMessage || "Today's Focus couldn't be refreshed.",
      status: "FAILED",
      blocks: [
        {
          type: "status",
          kind: "error",
          message: focus.emptyMessage || "Today's Focus couldn't be refreshed.",
        },
        {
          type: "actions",
          actions: [{ label: "Try again", prompt: "What should I focus on today?", style: "primary" }],
        },
      ],
    };
  }

  if (focus.empty) {
    return {
      reply: focus.emptyMessage || "You're clear for now.",
      status: "COMPLETED",
      blocks: [
        { type: "status", kind: "done", message: focus.emptyMessage || "You're clear for now." },
        {
          type: "actions",
          actions: [
            { label: "Open my Deals", href: "/sales/pipeline", style: "secondary" },
            { label: "Refresh priorities", prompt: "What should I focus on today?", style: "primary" },
          ],
        },
      ],
    };
  }

  const { summary } = focus;
  const enquiryCount = focus.newEnquiries?.length ?? 0;

  if (focus.items.length === 0 && enquiryCount > 0) {
    const topEnquiry = focus.newEnquiries[0]!;
    return {
      reply: `No active follow-ups right now. ${enquiryCount} new enquir${enquiryCount === 1 ? "y" : "ies"} can be summarized and drafted — WhatsApp already shows unread. Start with ${topEnquiry.customerName || topEnquiry.title}.`,
      status: "COMPLETED",
      blocks: [
        {
          type: "text",
          text: `New enquiries (not Today's Focus)\n\n${focus.newEnquiries
            .slice(0, 6)
            .map((item, i) => formatItemLine(item, i))
            .join("\n\n")}`,
        },
        {
          type: "actions",
          actions: [
            {
              label: "Draft & send first reply",
              href: "/sales/command?view=focus",
              style: "primary",
            },
            {
              label: "Open WhatsApp",
              href: topEnquiry.leadId ? `/sales/whatsapp?lead=${topEnquiry.leadId}` : "/sales/whatsapp",
              style: "secondary",
            },
          ],
        },
      ],
      activeLeadId: topEnquiry.leadId,
      activeDealId: topEnquiry.dealId,
    };
  }

  const header = `${summary.total} sales priorit${summary.total === 1 ? "y" : "ies"} · ${summary.immediate} Immediate · ${summary.today} Today · ${summary.needsProgress} Need progress${
    enquiryCount > 0 ? ` · ${enquiryCount} new enquir${enquiryCount === 1 ? "y" : "ies"} to draft` : ""
  }`;
  const lines = focus.items.slice(0, 8).map((item, i) => formatItemLine(item, i));
  const reply = `Today's Focus\n\n${header}\n\n${lines.join("\n\n")}`;

  const top = focus.items[0]!;
  const blocks: SalesBlock[] = [
    { type: "text", text: reply },
    {
      type: "status",
      kind: "done",
      message: `Priority 1: ${top.customerName || top.title} — ${top.whyNow}`,
    },
    itemActions(top),
    {
      type: "actions",
      actions: [
        { label: "What's next?", prompt: "What should I do next?", style: "secondary" },
        {
          label: "Open Today's Focus",
          href: "/sales/command?view=focus",
          style: "secondary",
        },
      ],
    },
  ];

  return {
    reply: `You have ${summary.total} sales priorities today (follow-ups and mid-thread replies — not raw unread chats). Start with ${top.customerName || top.title}: ${top.suggestedActionSummary}`,
    status: "COMPLETED",
    blocks,
    activeLeadId: top.leadId,
    activeDealId: top.dealId,
  };
}

export async function runWhatNext(opts: {
  actor: SalesActor;
  afterItemId?: string | null;
}): Promise<CommandOutcome> {
  const focus = await getTodaysFocus({
    userId: opts.actor.userId,
    clientId: opts.actor.clientId,
  });
  if (focus.empty || !focus.nextBest) {
    return runGetTodaysFocus({ actor: opts.actor });
  }

  let item = focus.nextBest;
  if (opts.afterItemId) {
    const idx = focus.items.findIndex(
      (i) => i.id === opts.afterItemId || i.fingerprint === opts.afterItemId
    );
    item = focus.items[idx + 1] ?? focus.items[0]!;
  }

  return {
    reply: `Next: ${item.customerName || item.title}. ${item.suggestedActionSummary}`,
    status: "COMPLETED",
    blocks: [
      {
        type: "text",
        text: `${item.type.replace(/_/g, " ")}\n${item.customerName || item.title}\n\nWhy now\n${item.whyNow}\n\nSuggested next step\n${item.suggestedActionSummary}`,
      },
      itemActions(item),
      {
        type: "actions",
        actions: [{ label: "What's next?", prompt: "What should I do next?", style: "secondary" }],
      },
    ],
    activeLeadId: item.leadId,
    activeDealId: item.dealId,
  };
}

export async function runDraftFollowup(opts: {
  actor: SalesActor;
  itemId?: string | null;
}): Promise<CommandOutcome> {
  const focus = await getTodaysFocus({
    userId: opts.actor.userId,
    clientId: opts.actor.clientId,
  });
  const item =
    (opts.itemId
      ? focus.items.find((i) => i.id === opts.itemId || i.fingerprint === opts.itemId)
      : null) ?? focus.nextBest;

  if (!item) {
    return {
      reply: "There's nothing to draft a follow-up for right now.",
      status: "COMPLETED",
      blocks: [{ type: "status", kind: "done", message: "No open focus item to draft against." }],
    };
  }

  const summary = buildSalesContextSummary({
    projectType: item.projectType,
    dealStage: item.dealStage,
    quoteLabel: item.quotationLabel,
    whyNow: item.whyNow,
    nextActionLabel: item.suggestedActionSummary,
  });
  const draft = draftFollowupMessage({ item, summary });

  const blocks: SalesBlock[] = [
    {
      type: "text",
      text: `Suggested follow-up\n\n${draft.body}${
        draft.warnings.length ? `\n\nNote: ${draft.warnings.join(" ")}` : ""
      }`,
    },
    {
      type: "actions",
      actions: [
        ...(item.leadId
          ? [
              {
                label: "Open WhatsApp",
                href: `/sales/whatsapp?lead=${item.leadId}`,
                style: "primary" as const,
              },
            ]
          : []),
        { label: "Try another", prompt: "Draft a shorter follow-up message.", style: "secondary" as const },
        { label: "Make it shorter", prompt: "Make the follow-up draft shorter.", style: "secondary" as const },
      ],
    },
  ];

  return {
    reply: "I've prepared a follow-up draft. Review it, then send from WhatsApp — nothing was sent automatically.",
    status: "COMPLETED",
    blocks,
    activeLeadId: item.leadId,
    activeDealId: item.dealId,
  };
}

export async function runPrepareCallBrief(opts: {
  actor: SalesActor;
  itemId?: string | null;
}): Promise<CommandOutcome> {
  const focus = await getTodaysFocus({
    userId: opts.actor.userId,
    clientId: opts.actor.clientId,
  });
  const item =
    (opts.itemId
      ? focus.items.find((i) => i.id === opts.itemId || i.fingerprint === opts.itemId)
      : null) ?? focus.nextBest;

  if (!item) {
    return {
      reply: "I need a customer or Deal in focus before I can prepare a call brief.",
      status: "FAILED",
      blocks: [
        {
          type: "status",
          kind: "error",
          message: "I need a customer or Deal in focus before I can prepare a call brief.",
        },
      ],
    };
  }

  const brief = buildCallBrief({ item });
  const text = [
    `CALL BRIEF`,
    brief.customerName,
    ``,
    `Why you're calling`,
    brief.whyCalling,
    ``,
    brief.customerPosition ? `Customer position\n${brief.customerPosition}\n` : "",
    brief.previouslyExplained ? `What you previously explained\n${brief.previouslyExplained}\n` : "",
    brief.openIssue ? `Open issue\n${brief.openIssue}\n` : "",
    `Goal for this call`,
    brief.goalForCall,
    ``,
    brief.suggestedOpening ? `Suggested opening\n${brief.suggestedOpening}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    reply: `Call brief ready for ${brief.customerName}.`,
    status: "COMPLETED",
    blocks: [
      { type: "text", text },
      {
        type: "actions",
        actions: [
          ...(brief.dealHref
            ? [{ label: "Open Deal", href: brief.dealHref, style: "secondary" as const }]
            : []),
          ...(brief.whatsappHref
            ? [{ label: "Open WhatsApp", href: brief.whatsappHref, style: "primary" as const }]
            : []),
        ],
      },
    ],
    activeLeadId: item.leadId,
    activeDealId: item.dealId,
  };
}
