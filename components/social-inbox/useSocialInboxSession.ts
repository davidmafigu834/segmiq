"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSalesToast } from "@/components/sales/ui";
import {
  DEMO_PRODUCTS,
  DEMO_SUGGESTED_REPLIES,
  getDemoConversation,
  getDemoWorkspace,
} from "@/lib/social-inbox/demo-data";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  filterQueue,
  formatFollowUpShort,
  groupQueue,
  parseInboxView,
  uniqueSignalChips,
  upcomingThursday,
  viewCounts,
  type ComposerMode,
  type InboxFilterState,
  type InboxScene,
  type TeamScope,
} from "@/lib/social-inbox/inbox-ui";
import type {
  SafeSocialConnection,
  SocialConversationDetail,
  SocialInboxViewId,
  SocialMessageDto,
  SocialQueueItem,
} from "@/lib/social-inbox/types";

export type OverlayId =
  | null
  | "convert_lead"
  | "link_customer"
  | "create_quote"
  | "create_deal"
  | "connect_channels"
  | "manage_facebook"
  | "manage_instagram"
  | "disconnect_facebook"
  | "disconnect_instagram"
  | "match_review"
  | "not_sales"
  | "resolve_confirm"
  | "product_picker"
  | "post_preview"
  | "what_should_i_do"
  | "tour"
  | "setup"
  | "search";

export type ActionFlash = {
  title: string;
  description?: string;
  undo?: () => void;
  hrefLabel?: string;
  href?: string;
};

export type QuotationSnippet = {
  id: string;
  product: string;
  amount: string;
  status: string;
  sentAgo: string;
};

export type LinkedCustomer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  note: string;
};

type SessionSeed = {
  viewerId: string;
  canViewUnassigned: boolean;
  canAssign: boolean;
  canManageChannels: boolean;
  canReply: boolean;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

function makeMsg(
  direction: SocialMessageDto["direction"],
  body: string,
  extra?: Partial<SocialMessageDto>
): SocialMessageDto {
  return {
    id: `msg-${Math.random().toString(36).slice(2, 9)}`,
    direction,
    visibility: extra?.visibility ?? "private",
    body,
    isInternalNote: extra?.isInternalNote ?? false,
    sendStatus: extra?.sendStatus ?? "sending",
    sendError: extra?.sendError ?? null,
    aiDraft: extra?.aiDraft ?? false,
    sentAt: nowIso(),
    actorName: extra?.actorName ?? (direction === "outbound" ? "You" : null),
  };
}

function defaultComposerMode(kind: SocialQueueItem["conversationKind"]): ComposerMode {
  return kind === "comment" ? "public_reply" : "reply";
}

function loadBool(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw == null) return fallback;
  return raw === "1";
}

export function useSocialInboxSession(
  seed: SessionSeed & {
    leadsBase: string;
    quotesBase: string;
    dealsBase: string;
  }
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useSalesToast();

  const sceneParam = (searchParams.get("scene") as InboxScene | null) ?? null;
  const initialView = parseInboxView(searchParams.get("view"));
  const initialConversation = searchParams.get("conversation");

  const [scene, setScene] = useState<InboxScene>(sceneParam ?? "normal");
  const [view, setView] = useState<SocialInboxViewId>(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversation ?? "demo-tendai");
  const [items, setItems] = useState<SocialQueueItem[]>([]);
  const [details, setDetails] = useState<Record<string, SocialConversationDetail>>({});
  const [connections, setConnections] = useState<SafeSocialConnection[]>([]);
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<InboxFilterState>(EMPTY_FILTERS);
  const [query, setQuery] = useState("");
  const [teamScope, setTeamScope] = useState<TeamScope>("mine");
  const [viewsCollapsed, setViewsCollapsed] = useState(false);
  const [intelCollapsed, setIntelCollapsed] = useState(false);
  const [intelSection, setIntelSection] = useState<"customer" | "intent" | "deal" | "ai">("customer");
  const [mobilePane, setMobilePane] = useState<"queue" | "thread" | "intel">("queue");
  const [overlay, setOverlay] = useState<OverlayId>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>("public_reply");
  const [draft, setDraft] = useState("");
  const [draftedByAi, setDraftedByAi] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [flash, setFlash] = useState<ActionFlash | null>(null);
  const [quotations, setQuotations] = useState<Record<string, QuotationSnippet>>({
    "demo-chipo": {
      id: "Q-1041",
      product: "CAT 320 Excavator",
      amount: "$48,000",
      status: "Sent",
      sentAgo: "2 days ago",
    },
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [insightDismissed, setInsightDismissed] = useState<Record<string, boolean>>({});
  const [newCount, setNewCount] = useState(0);
  const [stickBottom, setStickBottom] = useState(true);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [convertBusy, setConvertBusy] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [tourStep, setTourStep] = useState(0);
  const [canViewUnassigned, setCanViewUnassigned] = useState(seed.canViewUnassigned);
  const [canAssign, setCanAssign] = useState(seed.canAssign);
  const [canManageChannels, setCanManageChannels] = useState(seed.canManageChannels);
  const [canReply] = useState(seed.canReply);
  const failNextSend = useRef(false);
  const tendaiJourney = useRef({ privateSent: false, customerReplied: false });
  const flashTimer = useRef<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const hydrating = scene === "loading";

  const resetFromDemo = useCallback(
    (nextScene: InboxScene, nextView?: SocialInboxViewId, nextConversation?: string | null) => {
      const workspace = getDemoWorkspace({
        view: "for_you",
        viewerId: seed.viewerId,
        canViewUnassigned: nextScene === "manager" ? true : seed.canViewUnassigned,
        canAssign: nextScene === "manager" ? true : seed.canAssign,
        canManageChannels: seed.canManageChannels,
        canReply: seed.canReply,
      });
      const allIds = [
        "demo-tendai",
        "demo-brian",
        "demo-tatenda",
        "demo-rudo",
        "demo-chipo",
        "demo-tawanda",
        "demo-nyasha",
        "demo-farai",
        "demo-blessing",
        "demo-chiedza",
        "demo-tarisai",
        "demo-gifts",
        "demo-gweru",
      ];
      const fullItems = allIds
        .map((id) => getDemoConversation(id, seed.viewerId)?.conversation)
        .filter(Boolean) as SocialQueueItem[];
      const map: Record<string, SocialConversationDetail> = {};
      for (const id of allIds) {
        const detail = getDemoConversation(id, seed.viewerId);
        if (detail) map[id] = cloneJson(detail);
      }

      setItems(cloneJson(fullItems));
      setDetails(map);
      setTeam(workspace.team);
      setFilters(EMPTY_FILTERS);
      setQuery("");
      setSelectedIds([]);
      setSelectionMode(false);
      setDraft("");
      setDraftedByAi(false);
      setInsightDismissed({});
      setNewCount(0);
      tendaiJourney.current = { privateSent: false, customerReplied: false };
      failNextSend.current = nextScene === "failed_send";

      if (nextScene === "no_channels") {
        setConnections([]);
        setSelectedId(null);
      } else if (nextScene === "empty") {
        setConnections(cloneJson(workspace.connections));
        setItems([]);
        setSelectedId(null);
      } else if (nextScene === "channel_error") {
        const conns = cloneJson(workspace.connections).map((c) =>
          c.provider === "instagram"
            ? { ...c, status: "auth_expired" as const, lastError: "Connection expired" }
            : c
        );
        setConnections(conns);
        setSelectedId("demo-tendai");
      } else if (nextScene === "existing_customer") {
        setConnections(cloneJson(workspace.connections));
        setSelectedId("demo-chipo");
        setView("for_you");
      } else if (nextScene === "hot_opportunity") {
        setConnections(cloneJson(workspace.connections));
        setSelectedId("demo-tendai");
        setView("hot");
      } else if (nextScene === "manager") {
        setConnections(cloneJson(workspace.connections));
        setCanViewUnassigned(true);
        setCanAssign(true);
        setTeamScope("team");
        setView("unassigned");
        setSelectedId("demo-nyasha");
      } else {
        setConnections(cloneJson(workspace.connections));
        const preferred =
          nextConversation && fullItems.some((row) => row.conversationId === nextConversation)
            ? nextConversation
            : "demo-tendai";
        setSelectedId(preferred);
        setView(nextView ?? "for_you");
      }

      if (nextScene !== "manager") {
        setCanViewUnassigned(seed.canViewUnassigned);
        setCanAssign(seed.canAssign);
        setTeamScope("mine");
      }
      setCanManageChannels(seed.canManageChannels);
      setScene(nextScene === "loading" ? "loading" : nextScene);
    },
    [seed]
  );

  useEffect(() => {
    setViewsCollapsed(loadBool("segmiq-social-inbox-nav-collapsed", false));
    setIntelCollapsed(loadBool("segmiq-social-inbox-intel-collapsed", false));
    resetFromDemo(sceneParam ?? "normal", initialView, initialConversation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncUrl = useCallback(
    (nextView: SocialInboxViewId, nextId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", nextView);
      if (nextId) params.set("conversation", nextId);
      else params.delete("conversation");
      if (scene !== "normal") params.set("scene", scene);
      else params.delete("scene");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, scene, searchParams]
  );

  const selected = selectedId ? details[selectedId] ?? null : null;

  const visibleItems = useMemo(
    () =>
      filterQueue(items, view, seed.viewerId, filters, query, teamScope, canViewUnassigned),
    [items, view, seed.viewerId, filters, query, teamScope, canViewUnassigned]
  );

  const groups = useMemo(() => groupQueue(visibleItems, view), [visibleItems, view]);
  const counts = useMemo(
    () => viewCounts(items, seed.viewerId, canViewUnassigned),
    [items, seed.viewerId, canViewUnassigned]
  );
  const filterBadge = activeFilterCount(filters);

  useEffect(() => {
    if (!selectedId) return;
    const detail = details[selectedId];
    if (!detail) return;
    setComposerMode(defaultComposerMode(detail.conversation.conversationKind));
    setDraft("");
    setDraftedByAi(false);
    setNewCount(0);
    setStickBottom(true);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const showFlash = useCallback(
    (next: ActionFlash, tone: "success" | "info" | "warning" | "error" = "success") => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      setFlash(next);
      toast({ tone, title: next.title, description: next.description });
      flashTimer.current = window.setTimeout(() => setFlash(null), 5600);
    },
    [toast]
  );

  const patchConversation = useCallback(
    (id: string, patch: (item: SocialQueueItem) => SocialQueueItem, intel?: Partial<SocialConversationDetail["intelligence"]>) => {
      setItems((prev) => prev.map((item) => (item.conversationId === id ? patch(item) : item)));
      setDetails((prev) => {
        const current = prev[id];
        if (!current) return prev;
        const conversation = patch(current.conversation);
        return {
          ...prev,
          [id]: {
            ...current,
            conversation,
            intelligence: {
              ...current.intelligence,
              ...intel,
              assignedToName: intel?.assignedToName ?? conversation.assignedToName,
              intentScore: intel?.intentScore ?? conversation.intentScore,
              intentBand: intel?.intentBand ?? conversation.intentBand,
            },
          },
        };
      });
    },
    []
  );

  const selectConversation = useCallback(
    (id: string | null, nextView?: SocialInboxViewId) => {
      const v = nextView ?? view;
      setSelectedId(id);
      if (nextView) setView(nextView);
      if (id) {
        patchConversation(id, (item) => ({ ...item, unread: false }));
        setMobilePane("thread");
      }
      syncUrl(v, id);
    },
    [patchConversation, syncUrl, view]
  );

  const changeView = useCallback(
    (next: SocialInboxViewId) => {
      setView(next);
      setSelectedIds([]);
      setSelectionMode(false);
      const nextItems = filterQueue(items, next, seed.viewerId, filters, query, teamScope, canViewUnassigned);
      const keep = selectedId && nextItems.some((i) => i.conversationId === selectedId);
      const id = keep ? selectedId : null;
      if (!keep) setSelectedId(null);
      setMobilePane("queue");
      syncUrl(next, id);
    },
    [canViewUnassigned, filters, items, query, seed.viewerId, selectedId, syncUrl, teamScope]
  );

  const moveSelection = useCallback(
    (delta: number) => {
      if (!visibleItems.length) return;
      const idx = Math.max(0, visibleItems.findIndex((i) => i.conversationId === selectedId));
      const next = visibleItems[Math.min(visibleItems.length - 1, Math.max(0, idx + delta))];
      if (next) selectConversation(next.conversationId);
    },
    [selectConversation, selectedId, visibleItems]
  );

  const appendMessage = useCallback((id: string, message: SocialMessageDto) => {
    setDetails((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, messages: [...current.messages, message] } };
    });
    patchConversation(id, (item) => ({
      ...item,
      preview: message.body,
      lastMessageAt: message.sentAt,
      unread: message.direction === "inbound",
    }));
  }, [patchConversation]);

  const updateMessage = useCallback((id: string, messageId: string, patch: Partial<SocialMessageDto>) => {
    setDetails((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return {
        ...prev,
        [id]: {
          ...current,
          messages: current.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
        },
      };
    });
  }, []);

  const sendMessage = useCallback(async () => {
    if (!selectedId || !selected || !draft.trim() || !canReply) return;
    const body = draft.trim();
    const isNote = composerMode === "internal_note";
    const visibility: SocialMessageDto["visibility"] =
      composerMode === "public_reply" ? "public" : "private";
    const message = makeMsg("outbound", body, {
      visibility,
      isInternalNote: isNote,
      aiDraft: draftedByAi,
      sendStatus: "sending",
    });
    appendMessage(selectedId, message);
    setDraft("");
    setDraftedByAi(false);

    if (failNextSend.current && !isNote) {
      failNextSend.current = false;
      window.setTimeout(() => {
        updateMessage(selectedId, message.id, { sendStatus: "failed", sendError: "Not sent" });
        showFlash({ title: "Couldn't send message" }, "error");
      }, 700);
      return;
    }

    window.setTimeout(() => {
      updateMessage(selectedId, message.id, { sendStatus: "sent", sendError: null });
      if (isNote) {
        showFlash({ title: "Internal note added" }, "info");
        return;
      }
      showFlash({
        title: visibility === "public" ? "Public reply sent" : "Private message sent",
      });

      if (
        selectedId === "demo-tendai" &&
        visibility === "private" &&
        !tendaiJourney.current.customerReplied
      ) {
        tendaiJourney.current.privateSent = true;
        setTypingName("Tendai");
        window.setTimeout(() => {
          setTypingName(null);
          const reply = makeMsg(
            "inbound",
            "Financing please, and do you deliver to Bulawayo?",
            { visibility: "private", sendStatus: "sent" }
          );
          appendMessage(selectedId, reply);
          tendaiJourney.current.customerReplied = true;
          patchConversation(
            selectedId,
            (item) => ({
              ...item,
              intentScore: 96,
              intentBand: "hot",
              intentReasons: [
                "Asked about price",
                "Asked about financing or deposit",
                "Asked if it is still available",
                "Asked about delivery",
              ],
              unread: stickBottom ? false : true,
            }),
            {
              intentScore: 96,
              intentBand: "hot",
              reasons: [
                "Asked about price",
                "Asked about financing or deposit",
                "Asked if it is still available",
                "Asked about delivery",
              ],
              detectedLocation: "Bulawayo",
              nextAction: {
                label: "Qualify financing and create lead.",
                code: "convert_lead",
                followUpAt: null,
                followUpReason: "Customer confirmed financing and asked about delivery to Bulawayo.",
              },
              summary:
                "Customer is interested in the CAT 320. Asked about deposit, financing and delivery to Bulawayo.",
            }
          );
          if (!stickBottom) setNewCount((n) => n + 1);
        }, 1400);
      }
    }, 550);
  }, [
    appendMessage,
    canReply,
    composerMode,
    draft,
    draftedByAi,
    patchConversation,
    selected,
    selectedId,
    showFlash,
    stickBottom,
    updateMessage,
  ]);

  const retryMessage = useCallback(
    (messageId: string) => {
      if (!selectedId) return;
      updateMessage(selectedId, messageId, { sendStatus: "sending", sendError: null });
      window.setTimeout(() => {
        updateMessage(selectedId, messageId, { sendStatus: "sent" });
        showFlash({ title: "Message sent" });
      }, 500);
    },
    [selectedId, showFlash, updateMessage]
  );

  const draftWithAi = useCallback(async () => {
    if (!selectedId || !selected) return;
    if (draft.trim()) {
      showFlash({ title: "Composer already has a message", description: "Clear it first, or edit it yourself." }, "info");
      return;
    }
    setDrafting(true);
    await new Promise((r) => window.setTimeout(r, 700));
    const text =
      DEMO_SUGGESTED_REPLIES[selectedId] ??
      `Hi ${selected.conversation.displayName.split(" ")[0]}, thanks for getting in touch. I can help with the details.`;
    const missingPrice = /how much is this/i.test(selected.messages.at(-1)?.body ?? "");
    setDraft(
      missingPrice
        ? `Hi ${selected.conversation.displayName.split(" ")[0]}, I'd be happy to help. Which configuration are you interested in?`
        : text
    );
    setDraftedByAi(true);
    setDrafting(false);
  }, [draft, selected, selectedId, showFlash]);

  const assignTo = useCallback(
    (userId: string | null, name: string | null) => {
      if (!selectedId) return;
      const prev = details[selectedId]?.conversation;
      patchConversation(selectedId, (item) => ({
        ...item,
        assignedToId: userId,
        assignedToName: name,
      }));
      showFlash({
        title: name ? `Conversation assigned to ${name.split(" ")[0]}` : "Conversation unassigned",
        undo: prev
          ? () =>
              patchConversation(selectedId, (item) => ({
                ...item,
                assignedToId: prev.assignedToId,
                assignedToName: prev.assignedToName,
              }))
          : undefined,
      });
    },
    [details, patchConversation, selectedId, showFlash]
  );

  const bulkAssign = useCallback(
    (userId: string, name: string) => {
      const ids = selectedIds;
      setItems((prev) =>
        prev.map((item) =>
          ids.includes(item.conversationId) ? { ...item, assignedToId: userId, assignedToName: name } : item
        )
      );
      setSelectedIds([]);
      setSelectionMode(false);
      showFlash({ title: `${ids.length} conversations assigned to ${name.split(" ")[0]}` });
    },
    [selectedIds, showFlash]
  );

  const setFollowUp = useCallback(
    (when: Date, reason?: string) => {
      if (!selectedId) return;
      const label = when.toDateString() === new Date().toDateString() ? "Follow up today" : `Follow up ${formatFollowUpShort(when.toISOString())}`;
      const prev = details[selectedId]?.conversation.followUpLabel;
      patchConversation(
        selectedId,
        (item) => ({ ...item, followUpLabel: label }),
        {
          nextAction: {
            label: "Follow-up scheduled",
            code: "create_follow_up",
            followUpAt: when.toISOString(),
            followUpReason: reason ?? details[selectedId]?.intelligence.nextAction.followUpReason ?? null,
          },
        }
      );
      showFlash({
        title: `Follow-up scheduled for ${formatFollowUpShort(when.toISOString())}`,
        undo: () =>
          patchConversation(selectedId, (item) => ({ ...item, followUpLabel: prev ?? null }), {
            nextAction: details[selectedId]!.intelligence.nextAction,
          }),
      });
    },
    [details, patchConversation, selectedId, showFlash]
  );

  const clearFollowUp = useCallback(() => {
    if (!selectedId) return;
    patchConversation(selectedId, (item) => ({ ...item, followUpLabel: null }));
    showFlash({ title: "Follow-up removed" }, "info");
  }, [patchConversation, selectedId, showFlash]);

  const completeFollowUp = useCallback(() => {
    if (!selectedId) return;
    patchConversation(selectedId, (item) => ({ ...item, followUpLabel: null, unread: false }));
    showFlash({ title: "Follow-up completed" });
  }, [patchConversation, selectedId, showFlash]);

  const snoozeUntil = useCallback(
    (when: Date) => {
      if (!selectedId) return;
      const id = selectedId;
      patchConversation(id, (item) => ({ ...item, followUpLabel: "Snoozed", unread: false }));
      showFlash({
        title: "Conversation moved to later",
        description: `Returns ${formatFollowUpShort(when.toISOString())} at 9:00 AM`,
        undo: () => patchConversation(id, (item) => ({ ...item, followUpLabel: null })),
      });
      if (view !== "follow_up") setSelectedId(null);
    },
    [patchConversation, selectedId, showFlash, view]
  );

  const convertToLead = useCallback(async () => {
    if (!selectedId) return;
    setConvertBusy(true);
    await new Promise((r) => window.setTimeout(r, 800));
    patchConversation(
      selectedId,
      (item) => ({ ...item, crmState: "converted", primaryLabel: "Lead", opportunityId: item.opportunityId ?? `opp-${item.conversationId}` }),
      {
        crm: {
          state: "converted",
          contactId: null,
          leadId: `lead-${selectedId}`,
          dealId: null,
          customerName: details[selectedId]?.conversation.displayName ?? null,
          openDealName: null,
          match: null,
        },
        nextAction: {
          label: "Create quotation or schedule a follow-up.",
          code: "create_quote",
          followUpAt: null,
          followUpReason: null,
        },
      }
    );
    setConvertBusy(false);
    setOverlay(null);
    showFlash({
      title: "Lead created",
      description: `${details[selectedId]?.conversation.displayName} has been added to your pipeline.`,
      hrefLabel: "View lead",
      href: `${seed.leadsBase}${encodeURIComponent(`lead-${selectedId}`)}`,
    });
  }, [details, patchConversation, seed.leadsBase, selectedId, showFlash]);

  const linkCustomer = useCallback(
    (customer: LinkedCustomer) => {
      if (!selectedId) return;
      patchConversation(
        selectedId,
        (item) => ({ ...item, crmState: item.crmState === "none" ? "existing_customer" : item.crmState }),
        {
          crm: {
            state: "existing_customer",
            contactId: customer.id,
            leadId: null,
            dealId: null,
            customerName: customer.name,
            openDealName: null,
            match: null,
          },
        }
      );
      setOverlay(null);
      showFlash({
        title: "Customer linked",
        description: `This social profile is now linked to ${customer.name}.`,
        undo: () =>
          patchConversation(selectedId, (item) => ({ ...item, crmState: "none" }), {
            crm: {
              state: "none",
              contactId: null,
              leadId: null,
              dealId: null,
              customerName: null,
              openDealName: null,
              match: null,
            },
          }),
      });
    },
    [patchConversation, selectedId, showFlash]
  );

  const markNotSales = useCallback(
    (reason: string) => {
      if (!selectedId) return;
      const id = selectedId;
      patchConversation(id, (item) => ({ ...item, intentBand: "cold", intentScore: 8, primaryLabel: null, unread: false }));
      setOverlay(null);
      showFlash({ title: "Removed from sales opportunities.", description: reason }, "info");
      if (view === "hot" || view === "for_you") setSelectedId(null);
    },
    [patchConversation, selectedId, showFlash, view]
  );

  const resolveConversation = useCallback(
    (force = false) => {
      if (!selectedId || !selected) return;
      const hotOpen = selected.conversation.intentBand === "hot" && selected.conversation.crmState === "none";
      if (hotOpen && !force) {
        setOverlay("resolve_confirm");
        return;
      }
      const id = selectedId;
      const prev = selected.conversation;
      patchConversation(id, (item) => ({ ...item, unread: false, primaryLabel: "Resolved" }));
      setOverlay(null);
      showFlash({
        title: "Conversation resolved",
        undo: () => patchConversation(id, () => prev),
      });
    },
    [patchConversation, selected, selectedId, showFlash]
  );

  const markUnread = useCallback(() => {
    if (!selectedId) return;
    patchConversation(selectedId, (item) => ({ ...item, unread: true }));
    showFlash({ title: "Marked unread" }, "info");
  }, [patchConversation, selectedId, showFlash]);

  const insertProduct = useCallback(
    (name: string) => {
      setDraft((prev) => (prev ? `${prev}\n\n${name}` : name));
      setOverlay(null);
    },
    []
  );

  const toggleViewsCollapsed = useCallback(() => {
    setViewsCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem("segmiq-social-inbox-nav-collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

  const toggleIntelCollapsed = useCallback(() => {
    setIntelCollapsed((v) => {
      const next = !v;
      window.localStorage.setItem("segmiq-social-inbox-intel-collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

  const applyScene = useCallback(
    (next: InboxScene) => {
      if (next === "loading") {
        setScene("loading");
        window.setTimeout(() => resetFromDemo("normal"), 1200);
        return;
      }
      resetFromDemo(next);
    },
    [resetFromDemo]
  );

  const connectChannels = useCallback(() => {
    setOverlay("setup");
    setSetupStep(0);
    window.setTimeout(() => setSetupStep(1), 700);
    window.setTimeout(() => setSetupStep(2), 1400);
    window.setTimeout(() => setSetupStep(3), 2100);
  }, []);

  const finishSetup = useCallback(() => {
    setOverlay(null);
    resetFromDemo("normal");
  }, [resetFromDemo]);

  const disconnectChannel = useCallback(
    (provider: "facebook" | "instagram") => {
      setConnections((prev) =>
        prev.map((c) => (c.provider === provider ? { ...c, status: "disconnected" as const } : c))
      );
      setOverlay(null);
      showFlash({ title: `${provider === "facebook" ? "Facebook" : "Instagram"} disconnected.` }, "info");
    },
    [showFlash]
  );

  const reconnectChannel = useCallback(
    (provider: "facebook" | "instagram") => {
      setConnections((prev) =>
        prev.map((c) =>
          c.provider === provider ? { ...c, status: "connected" as const, lastError: null, lastSyncAt: nowIso() } : c
        )
      );
      showFlash({ title: `${provider === "facebook" ? "Facebook" : "Instagram"} reconnected` });
    },
    [showFlash]
  );

  const finishTour = useCallback(() => {
    setOverlay(null);
    window.localStorage.setItem("segmiq-social-inbox-tour-done", "1");
  }, []);

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    const people = items.filter((i) => i.displayName.toLowerCase().includes(q)).slice(0, 4);
    const conversations = items.filter((i) => i.preview.toLowerCase().includes(q)).slice(0, 4);
    const products = DEMO_PRODUCTS.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 4);
    const leads = items.filter((i) => i.crmState === "converted" && i.displayName.toLowerCase().includes(q));
    const deals = items.filter((i) => i.crmState === "open_deal" && `${i.displayName} ${i.detectedProduct}`.toLowerCase().includes(q));
    return { people, conversations, products, leads, deals };
  }, [items, query]);

  const suggestedThursday = upcomingThursday();
  const connectionAttention = connections.some((c) => c.status !== "connected");
  const noChannels = connections.length === 0 || scene === "no_channels";

  return {
    seed,
    scene,
    view,
    selectedId,
    selected,
    items,
    visibleItems,
    groups,
    counts,
    connections,
    team,
    filters,
    setFilters,
    filterBadge,
    query,
    setQuery,
    searchHits,
    teamScope,
    setTeamScope,
    viewsCollapsed,
    toggleViewsCollapsed,
    intelCollapsed,
    toggleIntelCollapsed,
    intelSection,
    setIntelSection,
    mobilePane,
    setMobilePane,
    overlay,
    setOverlay,
    composerMode,
    setComposerMode,
    draft,
    setDraft,
    draftedByAi,
    setDraftedByAi,
    drafting,
    composerRef,
    selectedIds,
    setSelectedIds,
    selectionMode,
    setSelectionMode,
    flash,
    setFlash,
    quotations,
    setQuotations,
    historyOpen,
    setHistoryOpen,
    insightDismissed,
    setInsightDismissed,
    newCount,
    setNewCount,
    stickBottom,
    setStickBottom,
    typingName,
    convertBusy,
    setupStep,
    tourStep,
    setTourStep,
    canViewUnassigned,
    canAssign,
    canManageChannels,
    canReply,
    hydrating,
    suggestedThursday,
    connectionAttention,
    noChannels,
    uniqueSignalChips,
    DEMO_PRODUCTS,
    selectConversation,
    changeView,
    moveSelection,
    sendMessage,
    retryMessage,
    draftWithAi,
    assignTo,
    bulkAssign,
    setFollowUp,
    clearFollowUp,
    completeFollowUp,
    snoozeUntil,
    convertToLead,
    linkCustomer,
    markNotSales,
    resolveConversation,
    markUnread,
    insertProduct,
    applyScene,
    connectChannels,
    finishSetup,
    disconnectChannel,
    reconnectChannel,
    finishTour,
    showFlash,
    patchConversation,
    syncUrl,
  };
}

export type SocialInboxSession = ReturnType<typeof useSocialInboxSession>;
