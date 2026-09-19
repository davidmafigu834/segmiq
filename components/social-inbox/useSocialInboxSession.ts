"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSalesToast } from "@/components/sales/ui";
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
  type TeamScope,
} from "@/lib/social-inbox/inbox-ui";
import type {
  SafeSocialConnection,
  SocialConversationDetail,
  SocialInboxViewId,
  SocialInboxWorkspace,
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
  | "search";

export type ActionFlash = {
  title: string;
  description?: string;
  undo?: () => void;
  hrefLabel?: string;
  href?: string;
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
  clientId: string;
  canViewUnassigned: boolean;
  canAssign: boolean;
  canManageChannels: boolean;
  canReply: boolean;
};

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
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
    id: `local-${Math.random().toString(36).slice(2, 9)}`,
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

function facebookOAuthUrl(returnPath: string) {
  return `/api/social-inbox/oauth/start?return=${encodeURIComponent(returnPath)}`;
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

  const initialView = parseInboxView(searchParams.get("view"));
  const initialConversation = searchParams.get("conversation");

  const [view, setView] = useState<SocialInboxViewId>(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversation);
  const [items, setItems] = useState<SocialQueueItem[]>([]);
  const [details, setDetails] = useState<Record<string, SocialConversationDetail>>({});
  const [connections, setConnections] = useState<SafeSocialConnection[]>([]);
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState<InboxFilterState>(EMPTY_FILTERS);
  const [query, setQuery] = useState("");
  const [teamScope, setTeamScope] = useState<TeamScope>(seed.canViewUnassigned ? "team" : "mine");
  const [viewsCollapsed, setViewsCollapsed] = useState(false);
  const [intelCollapsed, setIntelCollapsed] = useState(false);
  const [intelSection, setIntelSection] = useState<"customer" | "intent" | "deal" | "ai">("customer");
  const [mobilePane, setMobilePane] = useState<"queue" | "thread" | "intel">("queue");
  const [overlay, setOverlay] = useState<OverlayId>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode>("reply");
  const [draft, setDraft] = useState("");
  const [draftedByAi, setDraftedByAi] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [flash, setFlash] = useState<ActionFlash | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [insightDismissed, setInsightDismissed] = useState<Record<string, boolean>>({});
  const [newCount, setNewCount] = useState(0);
  const [stickBottom, setStickBottom] = useState(true);
  const [convertBusy, setConvertBusy] = useState(false);
  const [dealBusy, setDealBusy] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [canViewUnassigned, setCanViewUnassigned] = useState(seed.canViewUnassigned);
  const [canAssign, setCanAssign] = useState(seed.canAssign);
  const [canManageChannels, setCanManageChannels] = useState(seed.canManageChannels);
  const [canReply, setCanReply] = useState(seed.canReply);
  const [hydrating, setHydrating] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const syncUrl = useCallback(
    (nextView: SocialInboxViewId, nextId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", nextView);
      if (nextId) params.set("conversation", nextId);
      else params.delete("conversation");
      params.delete("scene");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const showFlash = useCallback(
    (next: ActionFlash, tone: "success" | "info" | "warning" | "error" = "success") => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      setFlash(next);
      toast({ tone, title: next.title, description: next.description });
      flashTimer.current = window.setTimeout(() => setFlash(null), 5600);
    },
    [toast]
  );

  const applyWorkspace = useCallback((workspace: SocialInboxWorkspace) => {
    setItems(workspace.items);
    setConnections(workspace.connections);
    setTeam(workspace.team);
    setCanViewUnassigned(workspace.canViewUnassigned);
    setCanAssign(workspace.canAssign);
    setCanManageChannels(workspace.canManageChannels);
    setCanReply(workspace.canReply);
  }, []);

  const refreshWorkspace = useCallback(
    async (opts?: { announce?: boolean }) => {
      let syncError: string | null = null;
      let imported = { conversations: 0, messages: 0, comments: 0 };
      try {
        const sync = await apiJson<{
          conversations: number;
          messages: number;
          comments: number;
          errors?: string[];
        }>("/api/social-inbox/sync", { method: "POST" });
        imported = sync;
        if (sync.errors?.length) syncError = sync.errors[0] ?? null;
      } catch (error) {
        syncError = error instanceof Error ? error.message : "Could not import Facebook history.";
      }
      const workspace = await apiJson<SocialInboxWorkspace>("/api/social-inbox/workspace");
      applyWorkspace(workspace);
      if (opts?.announce) {
        if (syncError) {
          showFlash({ title: "Couldn't import all Page history", description: syncError }, "warning");
        } else if (imported.conversations || imported.messages || imported.comments) {
          showFlash(
            {
              title: "Imported Page history",
              description: `${imported.conversations} conversations · ${imported.messages} messages · ${imported.comments} comments`,
            },
            "success"
          );
        } else {
          showFlash({ title: "Inbox is up to date" }, "info");
        }
      } else if (syncError) {
        showFlash({ title: "Couldn't import Page history", description: syncError }, "warning");
      }
      return workspace;
    },
    [applyWorkspace, showFlash]
  );

  const loadConversation = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await apiJson<SocialConversationDetail>(`/api/social-inbox/conversations/${id}`);
      setDetails((prev) => ({ ...prev, [id]: detail }));
      setItems((prev) => prev.map((item) => (item.conversationId === id ? detail.conversation : item)));
      return detail;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    setViewsCollapsed(loadBool("segmiq-social-inbox-nav-collapsed", false));
    setIntelCollapsed(loadBool("segmiq-social-inbox-intel-collapsed", false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    void (async () => {
      try {
        const workspace = await refreshWorkspace();
        if (cancelled) return;
        const wanted = selectedIdRef.current;
        const stillThere = wanted && workspace.items.some((item) => item.conversationId === wanted);
        if (wanted && !stillThere) {
          setSelectedId(null);
        }
      } catch (error) {
        if (!cancelled) {
          showFlash(
            { title: "Couldn't load Social Inbox", description: error instanceof Error ? error.message : undefined },
            "error"
          );
        }
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshWorkspace, showFlash]);

  useEffect(() => {
    if (!selectedId) return;
    void loadConversation(selectedId).catch((error) => {
      showFlash(
        { title: "Couldn't load conversation", description: error instanceof Error ? error.message : undefined },
        "error"
      );
    });
  }, [loadConversation, selectedId, showFlash]);

  const selected = selectedId ? details[selectedId] ?? null : null;

  const visibleItems = useMemo(
    () => filterQueue(items, view, seed.viewerId, filters, query, teamScope, canViewUnassigned),
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
        void apiJson(`/api/social-inbox/conversations/${id}/actions`, {
          method: "POST",
          body: JSON.stringify({ action: "read", read: true }),
        }).catch(() => undefined);
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

  const appendMessage = useCallback(
    (id: string, message: SocialMessageDto) => {
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
    },
    [patchConversation]
  );

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
    const visibility: SocialMessageDto["visibility"] = composerMode === "public_reply" ? "public" : "private";
    const message = makeMsg("outbound", body, {
      visibility,
      isInternalNote: isNote,
      aiDraft: draftedByAi,
      sendStatus: "sending",
    });
    appendMessage(selectedId, message);
    setDraft("");
    setDraftedByAi(false);

    try {
      const sent = await apiJson<{ ok: true; messageId?: string }>(`/api/social-inbox/conversations/${selectedId}/reply`, {
        method: "POST",
        body: JSON.stringify({
          text: body,
          visibility,
          internalNote: isNote,
          aiDraft: draftedByAi,
          idempotencyKey: message.id,
        }),
      });
      updateMessage(selectedId, message.id, {
        id: sent.messageId ?? message.id,
        sendStatus: "sent",
        sendError: null,
      });
      showFlash({
        title: isNote ? "Internal note added" : visibility === "public" ? "Public reply sent" : "Private message sent",
      });
      void loadConversation(selectedId).catch(() => undefined);
    } catch (error) {
      updateMessage(selectedId, message.id, {
        sendStatus: "failed",
        sendError: error instanceof Error ? error.message : "Not sent",
      });
      showFlash({ title: "Couldn't send message", description: error instanceof Error ? error.message : undefined }, "error");
    }
  }, [
    appendMessage,
    canReply,
    composerMode,
    draft,
    draftedByAi,
    loadConversation,
    selected,
    selectedId,
    showFlash,
    updateMessage,
  ]);

  const retryMessage = useCallback(
    async (messageId: string) => {
      if (!selectedId || !selected) return;
      const failed = selected.messages.find((m) => m.id === messageId);
      if (!failed) return;
      updateMessage(selectedId, messageId, { sendStatus: "sending", sendError: null });
      try {
        await apiJson(`/api/social-inbox/conversations/${selectedId}/reply`, {
          method: "POST",
          body: JSON.stringify({
            text: failed.body,
            visibility: failed.visibility,
            internalNote: failed.isInternalNote,
            aiDraft: failed.aiDraft,
          }),
        });
        updateMessage(selectedId, messageId, { sendStatus: "sent" });
        showFlash({ title: "Message sent" });
        void loadConversation(selectedId).catch(() => undefined);
      } catch (error) {
        updateMessage(selectedId, messageId, {
          sendStatus: "failed",
          sendError: error instanceof Error ? error.message : "Not sent",
        });
        showFlash({ title: "Couldn't send message" }, "error");
      }
    },
    [loadConversation, selected, selectedId, showFlash, updateMessage]
  );

  const draftWithAi = useCallback(async () => {
    if (!selectedId || !selected) return;
    if (draft.trim()) {
      showFlash({ title: "Composer already has a message", description: "Clear it first, or edit it yourself." }, "info");
      return;
    }
    setDrafting(true);
    try {
      const suggested = await apiJson<{ draft: string }>(`/api/social-inbox/conversations/${selectedId}/suggest-reply`, {
        method: "POST",
      });
      setDraft(suggested.draft);
      setDraftedByAi(true);
    } catch (error) {
      showFlash(
        { title: "Couldn't draft a reply", description: error instanceof Error ? error.message : undefined },
        "error"
      );
    } finally {
      setDrafting(false);
    }
  }, [draft, selected, selectedId, showFlash]);

  const postAction = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      return apiJson<{ ok: true; leadId?: string; dealId?: string }>(`/api/social-inbox/conversations/${id}/actions`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    []
  );

  const assignTo = useCallback(
    async (userId: string | null, name: string | null) => {
      if (!selectedId) return;
      const prev = details[selectedId]?.conversation;
      patchConversation(selectedId, (item) => ({
        ...item,
        assignedToId: userId,
        assignedToName: name,
      }));
      try {
        await postAction(selectedId, { action: "assign", assigneeId: userId });
        showFlash({
          title: name ? `Conversation assigned to ${name.split(" ")[0]}` : "Conversation unassigned",
        });
      } catch (error) {
        if (prev) {
          patchConversation(selectedId, () => prev);
        }
        showFlash({ title: "Couldn't assign conversation", description: error instanceof Error ? error.message : undefined }, "error");
      }
    },
    [details, patchConversation, postAction, selectedId, showFlash]
  );

  const bulkAssign = useCallback(
    async (userId: string, name: string) => {
      const ids = selectedIds;
      setItems((prev) =>
        prev.map((item) =>
          ids.includes(item.conversationId) ? { ...item, assignedToId: userId, assignedToName: name } : item
        )
      );
      setSelectedIds([]);
      setSelectionMode(false);
      try {
        await apiJson("/api/social-inbox/bulk", {
          method: "POST",
          body: JSON.stringify({ action: "assign", conversationIds: ids, assigneeId: userId }),
        });
        showFlash({ title: `${ids.length} conversations assigned to ${name.split(" ")[0]}` });
      } catch (error) {
        showFlash({ title: "Couldn't assign conversations", description: error instanceof Error ? error.message : undefined }, "error");
        void refreshWorkspace().catch(() => undefined);
      }
    },
    [refreshWorkspace, selectedIds, showFlash]
  );

  const setFollowUp = useCallback(
    async (when: Date, reason?: string) => {
      if (!selectedId) return;
      const label =
        when.toDateString() === new Date().toDateString()
          ? "Follow up today"
          : `Follow up ${formatFollowUpShort(when.toISOString())}`;
      const prev = details[selectedId]?.conversation.followUpLabel;
      patchConversation(selectedId, (item) => ({ ...item, followUpLabel: label }), {
        nextAction: {
          label: "Follow-up scheduled",
          code: "create_follow_up",
          followUpAt: when.toISOString(),
          followUpReason: reason ?? details[selectedId]?.intelligence.nextAction.followUpReason ?? null,
        },
      });
      try {
        await postAction(selectedId, { action: "follow_up", followUpAt: when.toISOString(), reason });
        showFlash({ title: `Follow-up scheduled for ${formatFollowUpShort(when.toISOString())}` });
      } catch (error) {
        patchConversation(selectedId, (item) => ({ ...item, followUpLabel: prev ?? null }));
        showFlash({ title: "Couldn't schedule follow-up", description: error instanceof Error ? error.message : undefined }, "error");
      }
    },
    [details, patchConversation, postAction, selectedId, showFlash]
  );

  const clearFollowUp = useCallback(async () => {
    if (!selectedId) return;
    try {
      await postAction(selectedId, { action: "follow_up", clear: true });
      patchConversation(selectedId, (item) => ({ ...item, followUpLabel: null }));
      showFlash({ title: "Follow-up removed" }, "info");
    } catch (error) {
      showFlash({ title: "Couldn't remove follow-up", description: error instanceof Error ? error.message : undefined }, "error");
    }
  }, [patchConversation, postAction, selectedId, showFlash]);

  const completeFollowUp = useCallback(async () => {
    if (!selectedId) return;
    try {
      await postAction(selectedId, { action: "follow_up", clear: true, completed: true });
      patchConversation(selectedId, (item) => ({ ...item, followUpLabel: null, unread: false }));
      showFlash({ title: "Follow-up completed" });
    } catch (error) {
      showFlash({ title: "Couldn't complete follow-up", description: error instanceof Error ? error.message : undefined }, "error");
    }
  }, [patchConversation, postAction, selectedId, showFlash]);

  const snoozeUntil = useCallback(
    async (when: Date) => {
      if (!selectedId) return;
      const id = selectedId;
      try {
        await postAction(id, { action: "follow_up", followUpAt: when.toISOString(), reason: "Snoozed" });
        patchConversation(id, (item) => ({ ...item, followUpLabel: "Snoozed", unread: false }));
        showFlash({
          title: "Conversation moved to later",
          description: `Returns ${formatFollowUpShort(when.toISOString())} at 9:00 AM`,
        });
        if (view !== "follow_up") setSelectedId(null);
      } catch (error) {
        showFlash({ title: "Couldn't snooze conversation", description: error instanceof Error ? error.message : undefined }, "error");
      }
    },
    [patchConversation, postAction, selectedId, showFlash, view]
  );

  const convertToLead = useCallback(
    async (payload?: { name?: string; phone?: string; email?: string; notes?: string }) => {
      if (!selectedId) return;
      setConvertBusy(true);
      try {
        const result = await postAction(selectedId, { action: "convert", ...payload });
        await loadConversation(selectedId);
        await refreshWorkspace();
        setOverlay(null);
        showFlash({
          title: "Lead created",
          description: `${details[selectedId]?.conversation.displayName} has been added to your pipeline.`,
          hrefLabel: "View lead",
          href: result.leadId ? `${seed.leadsBase}${encodeURIComponent(result.leadId)}` : seed.leadsBase,
        });
      } catch (error) {
        showFlash({ title: "Couldn't create lead", description: error instanceof Error ? error.message : undefined }, "error");
      } finally {
        setConvertBusy(false);
      }
    },
    [details, loadConversation, postAction, refreshWorkspace, seed.leadsBase, selectedId, showFlash]
  );

  const createDeal = useCallback(async () => {
    if (!selectedId || !selected) return;
    setDealBusy(true);
    try {
      const result = await postAction(selectedId, {
        action: "create_deal",
        name: selected.conversation.detectedProduct || selected.conversation.displayName,
      });
      await loadConversation(selectedId);
      await refreshWorkspace();
      setOverlay(null);
      showFlash({
        title: "Deal created",
        hrefLabel: "Open deal",
        href: result.dealId ? `${seed.dealsBase}${result.dealId}` : seed.dealsBase,
      });
    } catch (error) {
      showFlash({ title: "Couldn't create deal", description: error instanceof Error ? error.message : undefined }, "error");
    } finally {
      setDealBusy(false);
    }
  }, [loadConversation, postAction, refreshWorkspace, seed.dealsBase, selected, selectedId, showFlash]);

  const linkCustomer = useCallback(
    async (customer: LinkedCustomer) => {
      if (!selectedId) return;
      try {
        await postAction(selectedId, { action: "link_identity", contactId: customer.id });
        await loadConversation(selectedId);
        setOverlay(null);
        showFlash({
          title: "Customer linked",
          description: `This social profile is now linked to ${customer.name}.`,
        });
      } catch (error) {
        showFlash({ title: "Couldn't link customer", description: error instanceof Error ? error.message : undefined }, "error");
      }
    },
    [loadConversation, postAction, selectedId, showFlash]
  );

  const rejectMatch = useCallback(async () => {
    if (!selectedId) return;
    try {
      await postAction(selectedId, { action: "link_identity", rejected: true });
      setOverlay(null);
      showFlash({ title: "Match dismissed" }, "info");
    } catch (error) {
      showFlash({ title: "Couldn't update match", description: error instanceof Error ? error.message : undefined }, "error");
    }
  }, [postAction, selectedId, showFlash]);

  const markNotSales = useCallback(
    async (reason: string) => {
      if (!selectedId) return;
      const id = selectedId;
      try {
        await postAction(id, { action: "not_sales", reason });
        patchConversation(id, (item) => ({ ...item, intentBand: "cold", intentScore: 8, primaryLabel: null, unread: false }));
        setOverlay(null);
        showFlash({ title: "Removed from sales opportunities.", description: reason }, "info");
        if (view === "hot" || view === "for_you") setSelectedId(null);
        void refreshWorkspace().catch(() => undefined);
      } catch (error) {
        showFlash({ title: "Couldn't update conversation", description: error instanceof Error ? error.message : undefined }, "error");
      }
    },
    [patchConversation, postAction, refreshWorkspace, selectedId, showFlash, view]
  );

  const resolveConversation = useCallback(
    async (force = false) => {
      if (!selectedId || !selected) return;
      const hotOpen = selected.conversation.intentBand === "hot" && selected.conversation.crmState === "none";
      if (hotOpen && !force) {
        setOverlay("resolve_confirm");
        return;
      }
      const id = selectedId;
      try {
        await postAction(id, { action: "resolve", resolved: true });
        patchConversation(id, (item) => ({ ...item, unread: false, primaryLabel: "Resolved" }));
        setOverlay(null);
        showFlash({ title: "Conversation resolved" });
        void refreshWorkspace().catch(() => undefined);
      } catch (error) {
        showFlash({ title: "Couldn't resolve conversation", description: error instanceof Error ? error.message : undefined }, "error");
      }
    },
    [patchConversation, postAction, refreshWorkspace, selected, selectedId, showFlash]
  );

  const markUnread = useCallback(async () => {
    if (!selectedId) return;
    try {
      await postAction(selectedId, { action: "read", read: false });
      patchConversation(selectedId, (item) => ({ ...item, unread: true }));
      showFlash({ title: "Marked unread" }, "info");
    } catch (error) {
      showFlash({ title: "Couldn't mark unread", description: error instanceof Error ? error.message : undefined }, "error");
    }
  }, [patchConversation, postAction, selectedId, showFlash]);

  const insertProduct = useCallback((name: string) => {
    setDraft((prev) => (prev ? `${prev}\n\n${name}` : name));
    setOverlay(null);
  }, []);

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

  const connectChannels = useCallback(() => {
    window.location.href = facebookOAuthUrl(`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`);
  }, [pathname, searchParams]);

  const disconnectChannel = useCallback(
    async (provider: "facebook" | "instagram") => {
      const conn = connections.find((c) => c.provider === provider && c.status !== "disconnected");
      if (!conn) {
        setOverlay(null);
        return;
      }
      try {
        await apiJson("/api/social-inbox/connections", {
          method: "POST",
          body: JSON.stringify({ action: "disconnect", connectionId: conn.id }),
        });
        setConnections((prev) =>
          prev.map((c) => (c.id === conn.id ? { ...c, status: "disconnected" as const } : c))
        );
        setOverlay(null);
        showFlash({ title: `${provider === "facebook" ? "Facebook" : "Instagram"} disconnected.` }, "info");
        void refreshWorkspace().catch(() => undefined);
      } catch (error) {
        showFlash({ title: "Couldn't disconnect channel", description: error instanceof Error ? error.message : undefined }, "error");
      }
    },
    [connections, refreshWorkspace, showFlash]
  );

  const reconnectChannel = useCallback(() => {
    connectChannels();
  }, [connectChannels]);

  const finishTour = useCallback(() => {
    setOverlay(null);
    window.localStorage.setItem("segmiq-social-inbox-tour-done", "1");
  }, []);

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    const people = items.filter((i) => i.displayName.toLowerCase().includes(q)).slice(0, 4);
    const conversations = items.filter((i) => i.preview.toLowerCase().includes(q)).slice(0, 4);
    const products = items
      .filter((i) => (i.detectedProduct ?? "").toLowerCase().includes(q))
      .map((i) => ({ id: i.conversationId, name: i.detectedProduct ?? "" }))
      .filter((p, index, all) => p.name && all.findIndex((x) => x.name === p.name) === index)
      .slice(0, 4);
    const leads = items.filter((i) => i.crmState === "converted" && i.displayName.toLowerCase().includes(q));
    const deals = items.filter(
      (i) => i.crmState === "open_deal" && `${i.displayName} ${i.detectedProduct}`.toLowerCase().includes(q)
    );
    return { people, conversations, products, leads, deals };
  }, [items, query]);

  const suggestedThursday = upcomingThursday();
  const connectionAttention = connections.some(
    (c) => c.status === "attention_required" || c.status === "auth_expired" || c.status === "sync_issue"
  );
  const noChannels = !connections.some((c) => c.status !== "disconnected");

  return {
    seed,
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
    historyOpen,
    setHistoryOpen,
    insightDismissed,
    setInsightDismissed,
    newCount,
    setNewCount,
    stickBottom,
    setStickBottom,
    typingName: null as string | null,
    convertBusy,
    dealBusy,
    tourStep,
    setTourStep,
    canViewUnassigned,
    canAssign,
    canManageChannels,
    canReply,
    hydrating,
    detailLoading,
    suggestedThursday,
    connectionAttention,
    noChannels,
    uniqueSignalChips,
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
    createDeal,
    linkCustomer,
    rejectMatch,
    markNotSales,
    resolveConversation,
    markUnread,
    insertProduct,
    connectChannels,
    disconnectChannel,
    reconnectChannel,
    finishTour,
    refreshWorkspace,
    showFlash,
    patchConversation,
    syncUrl,
  };
}

export type SocialInboxSession = ReturnType<typeof useSocialInboxSession>;
