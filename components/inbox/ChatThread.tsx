"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  MoreHorizontal,
  Paperclip,
  PanelRight,
  Phone,
  Send,
  StickyNote,
  UserRound,
  X,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { InboxChatMessage, InboxConversation } from "@/lib/inbox/types";
import { formatDealValue } from "@/lib/inbox/queue-filters";
import { formatDealStage } from "@/lib/sales/deals/display";
import { applyQuickReplyVariables } from "@/lib/inbox/quick-reply-vars";
import { resolveNextBestAction } from "@/lib/inbox/next-best-action";
import { CONVERSATION_TYPE_LABEL } from "@/lib/inbox/conversation-type";
import type { SalesActionRecommendation } from "@/lib/sales/intelligence/types";
import { LogCallForm } from "@/components/leads/LogCallForm";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button } from "@/components/sales/ui/Button";
import { TextArea } from "@/components/sales/ui/Input";
import { groupMessagesByDay, MessageBubble } from "./MessageBubble";
import { LeadStageBadge } from "./LeadStageBadge";
import { QuickReplyBar, type QuickReplyAction, type SavedQuickReply } from "./QuickReplyBar";
import { displayContactName, WhatsAppAvatar } from "./WhatsAppAvatar";
import { TransferDialog } from "./TransferDialog";
import { TransferToSupportDialog } from "./TransferToSupportDialog";
import { CreateDealSheet } from "@/components/sales/deals/CreateDealSheet";
import { SalesConversationAssist } from "./SalesConversationAssist";
import { AssetDrawer } from "./AssetDrawer";
import { AgentComposerAssist } from "./AgentComposerAssist";
import { SalespersonComposerToolbar } from "./SalespersonComposerToolbar";
import { ManagerComposerToolbar } from "./ManagerComposerToolbar";
import { ManagerWorkflowStrip } from "./ManagerWorkflowStrip";
import { ConversationTypeBadge } from "./ConversationTypeBadge";
import { LearningConversationMenuItems, LearningConversationSheets } from "./LearningConversationSheets";
import type { LeadRow } from "@/types";
import { initials } from "@/lib/inbox/assignee-colors";
import { sendComposerMedia } from "@/lib/inbox/send-composer-media";
import {
  classifyWhatsAppOutboundMedia,
  resolveOutboundMediaContentType,
  validateWhatsAppOutboundMedia,
} from "@/lib/whatsapp/outbound-media";

type ComposerAttachment = {
  file: File;
  previewUrl: string | null;
  kind: "image" | "video" | "document";
};

const COMPOSER_ACCEPT =
  "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";

type Props = {
  conversation: InboxConversation | null;
  clientId: string;
  userName: string;
  companyName?: string;
  canSend: boolean;
  transportAvailable?: boolean;
  canTransfer?: boolean;
  canUpdateStatus?: boolean;
  salespeople?: { id: string; name: string }[];
  showLogCall: boolean;
  onBack?: () => void;
  onToggleIntel: () => void;
  onMessagesChange: () => void;
  onConversationUpdate?: () => void;
  onSessionChange?: (open: boolean | null) => void;
  companyMode?: boolean;
  canReassign?: boolean;
  canCreateDeal?: boolean;
  leadHref?: string;
  dealHref?: string;
  contextOpen?: boolean;
  canClaim?: boolean;
  onClaim?: (leadId: string) => void;
  claiming?: boolean;
  userId?: string;
  dailyPlanQueue?: SalesActionRecommendation[];
  salespersonHub?: boolean;
  alsoSells?: boolean;
};

function mergeChatMessages(
  existing: InboxChatMessage[],
  incoming: InboxChatMessage[]
): InboxChatMessage[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) {
    if (!message.id.startsWith("pending-")) {
      for (const [id, pending] of Array.from(byId.entries())) {
        if (!id.startsWith("pending-") || pending.direction !== message.direction) continue;
        const sameText = pending.text === message.text;
        const sameMedia =
          Boolean(pending.messageType) &&
          pending.messageType === message.messageType &&
          (sameText || (!pending.text && !message.text));
        if (sameText || sameMedia) {
          byId.delete(id);
        }
      }
    }
    byId.set(message.id, message);
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function ChatThread({
  conversation,
  clientId,
  userName,
  companyName = "",
  canSend,
  transportAvailable = true,
  canTransfer = false,
  canUpdateStatus = false,
  salespeople = [],
  showLogCall,
  onBack,
  onToggleIntel,
  onMessagesChange,
  onConversationUpdate,
  onSessionChange,
  companyMode = false,
  canReassign = false,
  canCreateDeal = false,
  leadHref,
  dealHref,
  contextOpen = false,
  canClaim = false,
  onClaim,
  claiming = false,
  userId = "",
  dailyPlanQueue = [],
  salespersonHub = false,
  alsoSells = false,
}: Props) {
  const [messages, setMessages] = useState<InboxChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<ComposerAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [logCallOpen, setLogCallOpen] = useState(false);
  const [pricingPicker, setPricingPicker] = useState<{ id: string; name: string }[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [supportTransferOpen, setSupportTransferOpen] = useState(false);
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [savedReplies, setSavedReplies] = useState<SavedQuickReply[]>([]);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [dealLead, setDealLead] = useState<LeadRow | null>(null);
  const [contextLead, setContextLead] = useState<LeadRow | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [teachOpen, setTeachOpen] = useState(false);
  const [excludeLearningOpen, setExcludeLearningOpen] = useState(false);
  const [fromChatOpen, setFromChatOpen] = useState(false);
  const [teachMessageIds, setTeachMessageIds] = useState<string[]>([]);
  const [planCompleting, setPlanCompleting] = useState(false);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [campaignContext, setCampaignContext] = useState<{
    campaignName: string;
    sentAt: string | null;
    responseClassification: string | null;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const composerRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentRef = useRef<ComposerAttachment | null>(null);
  attachmentRef.current = attachment;
  const onMessagesChangeRef = useRef(onMessagesChange);
  const onSessionChangeRef = useRef(onSessionChange);
  const loadOlderRef = useRef<() => void>(() => {});
  onMessagesChangeRef.current = onMessagesChange;
  onSessionChangeRef.current = onSessionChange;

  useEffect(() => {
    stickToBottomRef.current = true;
    setQuickActionsOpen(false);
    setMenuOpen(false);
    setAssetDrawerOpen(false);
    clearAttachment();
    if (!conversation?.id) onSessionChangeRef.current?.(null);
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id || (!salespersonHub && !(companyMode && alsoSells))) {
      setContextLead(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/leads/${conversation.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { lead?: LeadRow } | null) => {
        if (!cancelled) setContextLead(json?.lead ?? null);
      })
      .catch(() => {
        if (!cancelled) setContextLead(null);
      });
    return () => {
      cancelled = true;
    };
  }, [conversation?.id, salespersonHub, companyMode, alsoSells]);

  useEffect(() => {
    const focusComposer = () => composerRef.current?.focus();
    window.addEventListener("segmiq:focus-whatsapp-composer", focusComposer);
    return () => window.removeEventListener("segmiq:focus-whatsapp-composer", focusComposer);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onScroll() {
      const node = scrollRef.current;
      if (!node) return;
      const threshold = 96;
      const nearBottom =
        node.scrollHeight - node.scrollTop - node.clientHeight < threshold;
      stickToBottomRef.current = nearBottom;
      if (nearBottom) setHasNewBelow(false);
      if (node.scrollTop < 48) loadOlderRef.current();
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [conversation?.id]);

  useEffect(() => {
    if (!conversation?.id) {
      setMessages([]);
      setHasOlder(false);
      setNextBefore(null);
      setLoading(false);
      return;
    }
    const conversationId = conversation.id;
    const conversationSource = conversation.source;
    setMessages([]);
    setLoading(true);
    setHasOlder(false);
    setNextBefore(null);
    setHasNewBelow(false);
    let cancelled = false;
    let requestInFlight = false;

    async function loadMessages(isInitial = false) {
      if (requestInFlight) return;
      requestInFlight = true;
      if (isInitial) setLoading(true);
      try {
        const res = await fetch(`/api/inbox/conversations/${conversationId}/messages?limit=80`);
        const d = (await res.json()) as {
          messages?: InboxChatMessage[];
          sessionOpen?: boolean;
          hasMore?: boolean;
          nextBefore?: string | null;
          campaignContext?: {
            campaignName: string;
            sentAt: string | null;
            responseClassification: string | null;
          } | null;
        };
        if (!cancelled) {
          const next = d.messages ?? [];
          setMessages((prev) => {
            if (!isInitial) return mergeChatMessages(prev, next);
            if (
              prev.length === next.length
              && prev.every((m, i) => {
                const n = next[i];
                return n && m.id === n.id && m.status === n.status && m.text === n.text;
              })
            ) {
              return prev;
            }
            return next;
          });
          if (isInitial) {
            setHasOlder(d.hasMore === true);
            setNextBefore(d.nextBefore ?? next[0]?.createdAt ?? null);
          }
          const open = d.sessionOpen === true;
          setSessionOpen(open);
          onSessionChangeRef.current?.(open);
          setCampaignContext(d.campaignContext ?? null);
        }
      } finally {
        requestInFlight = false;
        if (!cancelled && isInitial) setLoading(false);
      }
    }

    void loadMessages(true);
    const interval = conversationSource === "WHATSAPP_INBOUND"
      ? window.setInterval(() => void loadMessages(false), 2_500)
      : null;

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [conversation?.id, conversation?.source]);

  async function loadOlderMessages() {
    if (!conversation?.id || !hasOlder || !nextBefore || loadingOlder) return;
    const scroller = scrollRef.current;
    const previousHeight = scroller?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const response = await fetch(
        `/api/inbox/conversations/${conversation.id}/messages?limit=80&before=${encodeURIComponent(nextBefore)}`
      );
      if (!response.ok) return;
      const data = (await response.json()) as {
        messages?: InboxChatMessage[];
        hasMore?: boolean;
        nextBefore?: string | null;
      };
      const older = data.messages ?? [];
      setMessages((current) => mergeChatMessages(current, older));
      setHasOlder(data.hasMore === true && older.length > 0);
      setNextBefore(data.nextBefore ?? older[0]?.createdAt ?? null);
      window.requestAnimationFrame(() => {
        const node = scrollRef.current;
        if (node) node.scrollTop = Math.max(0, node.scrollHeight - previousHeight);
      });
    } finally {
      setLoadingOlder(false);
    }
  }

  loadOlderRef.current = () => void loadOlderMessages();

  useEffect(() => {
    if (!canSend) return;
    fetch("/api/inbox/quick-replies")
      .then((r) => r.json())
      .then((d: { replies?: SavedQuickReply[] }) => setSavedReplies(d.replies ?? []))
      .catch(() => {});
  }, [canSend, clientId]);

  useEffect(() => {
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setHasNewBelow(false);
      return;
    }
    if (messages.length > 0) setHasNewBelow(true);
  }, [messages, conversation?.id]);

  function clearAttachment() {
    const current = attachmentRef.current;
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function attachFile(file: File | null | undefined) {
    if (!file) return;
    const validated = validateWhatsAppOutboundMedia({
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });
    if (!validated.ok) {
      setSendError(validated.error);
      return;
    }
    const current = attachmentRef.current;
    if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
    const mime = resolveOutboundMediaContentType(file.name, file.type) ?? file.type;
    const kind = classifyWhatsAppOutboundMedia(mime);
    const previewUrl = kind === "image" || kind === "video" ? URL.createObjectURL(file) : null;
    setSendError(null);
    setAttachment({ file, previewUrl, kind });
  }

  async function sendCustomMessage(text: string) {
    if (attachment) {
      await sendAttachedMedia(text);
      return;
    }
    if (!conversation || !text.trim() || sending || !transportAvailable) return;
    setSending(true);
    setSendError(null);
    try {
      const isWhatsApp = conversation.source === "WHATSAPP_INBOUND";
      const endpoint = isWhatsApp
        ? `/api/leads/${conversation.id}/send-message`
        : `/api/leads/${conversation.id}/send-asset`;
      const payload = isWhatsApp
        ? { text: text.trim() }
        : { assetType: "CUSTOM_MESSAGE", customMessage: text.trim() };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const sentText = text.trim();
        setInput("");
        setQuickActionsOpen(false);
        stickToBottomRef.current = true;
        setMessages((prev) => [
          ...prev,
          {
            id: `pending-${Date.now()}`,
            direction: "rep",
            text: sentText,
            createdAt: new Date().toISOString(),
            kind: "message",
            status: "sent",
          },
        ]);
        onMessagesChange();
        const msgRes = await fetch(`/api/inbox/conversations/${conversation.id}/messages?limit=80`);
        const data = (await msgRes.json()) as {
          messages?: InboxChatMessage[];
          sessionOpen?: boolean;
        };
        setMessages((current) => mergeChatMessages(current, data.messages ?? []));
        const open = data.sessionOpen === true;
        setSessionOpen(open);
        onSessionChangeRef.current?.(open);
      } else if (isWhatsApp) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setSendError(err.error ?? "Could not send message");
      }
    } finally {
      setSending(false);
    }
  }

  async function sendAttachedMedia(caption: string) {
    if (!conversation || !attachment || sending || !transportAvailable) return;
    const pending = attachment;
    setSending(true);
    setSendError(null);
    try {
      const result = await sendComposerMedia({
        leadId: conversation.id,
        file: pending.file,
        caption,
      });
      if (!result.ok) {
        setSendError(result.error);
        return;
      }
      setInput("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setQuickActionsOpen(false);
      stickToBottomRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: `pending-${Date.now()}`,
          direction: "rep",
          text: caption.trim(),
          createdAt: new Date().toISOString(),
          kind: "message",
          status: "sent",
          messageType: result.messageType,
          mediaUrl: pending.previewUrl,
          mediaMimeType: pending.file.type || null,
        },
      ]);
      onMessagesChange();
      const msgRes = await fetch(`/api/inbox/conversations/${conversation.id}/messages?limit=80`);
      const data = (await msgRes.json()) as {
        messages?: InboxChatMessage[];
        sessionOpen?: boolean;
      };
      setMessages((current) => mergeChatMessages(current, data.messages ?? []));
      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      const open = data.sessionOpen === true;
      setSessionOpen(open);
      onSessionChangeRef.current?.(open);
    } finally {
      setSending(false);
    }
  }

  async function sendAsset(
    assetType: "PORTFOLIO" | "TESTIMONIALS" | "PRICING_PACKAGE" | "DOCUMENT",
    assetId?: string
  ) {
    if (!conversation || sending || !transportAvailable) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/leads/${conversation.id}/send-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType, assetId }),
      });
      if (res.ok) {
        setQuickActionsOpen(false);
        onMessagesChange();
        const msgRes = await fetch(`/api/inbox/conversations/${conversation.id}/messages?limit=80`);
        const data = (await msgRes.json()) as { messages?: InboxChatMessage[] };
        setMessages((current) => mergeChatMessages(current, data.messages ?? []));
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setSendError(err.error ?? "Could not send message");
      }
    } finally {
      setSending(false);
      setPricingPicker(null);
    }
  }

  async function handleQuickAction(action: QuickReplyAction) {
    if (!conversation || !canSend) return;
    if (action.type === "CUSTOM_MESSAGE") {
      if (action.preset) {
        await sendCustomMessage(action.preset);
      } else {
        composerRef.current?.focus();
      }
      return;
    }
    if (action.type === "PRICING_PACKAGE" && "needsPicker" in action) {
      const res = await fetch(`/api/clients/${clientId}/packages`);
      const data = (await res.json()) as { packages?: { id: string; name: string }[] };
      const pkgs = data.packages ?? [];
      if (pkgs.length === 1) {
        await sendAsset("PRICING_PACKAGE", pkgs[0].id);
      } else if (pkgs.length > 1) {
        setPricingPicker(pkgs);
      }
      return;
    }
    await sendAsset(action.type);
  }

  async function handleSavedReply(body: string) {
    if (!conversation) return;
    const text = applyQuickReplyVariables(body, {
      customerName: displayContactName(conversation),
      companyName,
      salespersonName: userName,
      projectType: conversation.projectType,
      location: conversation.location,
    });
    await sendCustomMessage(text);
  }

  function handleInternalNote() {
    if (!conversation) return;
    setNoteDraft("");
    setNoteOpen(true);
  }

  async function saveInternalNote() {
    if (!conversation || !noteDraft.trim() || noteSaving) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/leads/${conversation.id}/internal-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteDraft.trim() }),
      });
      if (res.ok) {
        setNoteOpen(false);
        setNoteDraft("");
        onMessagesChange();
        const msgRes = await fetch(`/api/inbox/conversations/${conversation.id}/messages?limit=80`);
        const data = (await msgRes.json()) as { messages?: InboxChatMessage[] };
        setMessages((current) => mergeChatMessages(current, data.messages ?? []));
      }
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleTransfer(assigneeId: string, handoverNotes: string) {
    if (!conversation) return;
    const res = await fetch(`/api/leads/${conversation.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assigned_to_id: assigneeId,
        handover_notes: handoverNotes || null,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Transfer failed");
    onConversationUpdate?.();
    onMessagesChange();
  }

  async function handleConversationStatus(status: "OPEN" | "RESOLVED") {
    if (!conversation || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/inbox/conversations/${conversation.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        onConversationUpdate?.();
        onMessagesChange();
      }
    } finally {
      setStatusUpdating(false);
      setMenuOpen(false);
    }
  }

  async function openCreateDeal() {
    if (!conversation || !canCreateDeal) return;
    const res = await fetch(`/api/leads/${conversation.id}`);
    if (!res.ok) return;
    const data = (await res.json()) as { lead?: LeadRow };
    if (!data.lead) return;
    setDealLead(data.lead);
    setCreateDealOpen(true);
  }

  const nextBestAction = useMemo(
    () =>
      (salespersonHub || (companyMode && alsoSells && canSend)) && conversation
        ? resolveNextBestAction({ conversation, dailyPlan: dailyPlanQueue })
        : null,
    [conversation, dailyPlanQueue, salespersonHub, companyMode, alsoSells, canSend]
  );

  if (!conversation) {
    return (
      <div className="wa-chat-wallpaper flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-6">
        <div className="wa-empty-hint max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] border border-sales-border bg-sales-bg text-[#25D366]">
            <SiWhatsapp size={24} aria-hidden />
          </div>
          <div className="mb-1.5 text-[16px] font-semibold tracking-tight text-sales-text-primary">
            Select a conversation
          </div>
          <p className="text-[13px] leading-relaxed text-sales-text-secondary">
            Choose a WhatsApp conversation to view the customer&apos;s messages and sales context.
          </p>
        </div>
      </div>
    );
  }

  const name = displayContactName(conversation);
  const messageGroups = groupMessagesByDay(messages);
  const isWhatsApp = conversation.source === "WHATSAPP_INBOUND";
  const dealLabel = formatDealValue(conversation.dealValue, conversation.dealCurrency ?? "USD");
  const sessionClosed = isWhatsApp && !sessionOpen && !salespersonHub;
  const isSupport = conversation.conversationType === "SUPPORT";

  async function handleCompletePlanAction() {
    if (!nextBestAction?.dailyPlanKey || planCompleting) return;
    const planItem = dailyPlanQueue.find((item) => item.idempotencyKey === nextBestAction.dailyPlanKey);
    if (!planItem) return;
    setPlanCompleting(true);
    try {
      await fetch("/api/sales/daily-plan/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: planItem.idempotencyKey,
          actionType: planItem.actionType,
          reasonCode: planItem.reasonCode,
          sourceEntityType: planItem.sourceEntityType,
          sourceEntityId: planItem.sourceEntityId,
          action: "complete",
        }),
      });
      onConversationUpdate?.();
    } finally {
      setPlanCompleting(false);
    }
  }

  function insertComposerText(text: string) {
    setInput((current) => (current.trim() ? `${current.trim()} ${text}` : text));
    composerRef.current?.focus();
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        className={`shrink-0 max-[1099px]:pt-[max(0.75rem,env(safe-area-inset-top))] ${
          isWhatsApp ? "wa-panel-header" : "border-b border-[var(--border)] bg-[var(--bg-primary)]"
        }`}
      >
        <div className={`flex items-center justify-between gap-2 px-3 sm:px-4 ${
          (salespersonHub || companyMode) && isWhatsApp ? "py-2" : "py-3"
        }`}>
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to conversations"
                className={
                  isWhatsApp
                    ? "wa-icon-btn-muted shrink-0"
                    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-all hover:bg-[var(--bg-quaternary)]"
                }
              >
                <ArrowLeft size={20} />
              </button>
            ) : null}
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <WhatsAppAvatar
                name={name}
                phone={conversation.phone}
                size="sm"
                className="max-[480px]:h-9 max-[480px]:w-9"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 layout:flex-row layout:items-center layout:gap-2.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold tracking-tight text-sales-text-primary">
                    {name}
                  </span>
                  {isWhatsApp ? (
                    <SiWhatsapp size={14} className="shrink-0 text-[#25D366]" aria-label="WhatsApp" />
                  ) : null}
                </div>
                {conversation.phone ? (
                  <div className="truncate text-[11px] tabular-nums text-sales-text-secondary layout:shrink-0">
                    {conversation.phone}
                    {companyMode && conversation.location ? ` · ${conversation.location}` : ""}
                  </div>
                ) : null}
                {conversation.agentStatus === "HUMAN_NEEDED" ? (
                  <span className="inline-flex w-fit rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    Human needed
                    {conversation.agentHumanNeededReason ? ` · ${conversation.agentHumanNeededReason}` : ""}
                  </span>
                ) : conversation.agentStatus === "AI_HANDLING" ||
                  conversation.agentStatus === "WAITING_ON_CUSTOMER" ? (
                  <span className="inline-flex w-fit rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    SegmiQ Agent handling
                  </span>
                ) : conversation.agentStatus === "PAUSED" ? (
                  <span className="inline-flex w-fit rounded-full bg-sales-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-sales-text-muted">
                    Agent paused
                  </span>
                ) : null}
                {!companyMode && salespersonHub ? (
                  <div className="hidden min-w-0 shrink-0 items-center gap-1.5 overflow-hidden min-[860px]:flex">
                    {conversation.activeDealId ? (
                      <>
                        <span className="inline-flex shrink-0 rounded-full bg-sales-info-soft px-2 py-0.5 text-[10px] font-semibold text-sales-info">
                          Deal
                        </span>
                        {conversation.dealStage ? (
                          <span className="inline-flex shrink-0 rounded-full border border-sales-border bg-sales-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-sales-text-primary">
                            {formatDealStage(conversation.dealStage)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${
                          isSupport
                            ? "bg-[#EFF8FF] text-[#175CD3]"
                            : "bg-sales-surface-subtle text-sales-text-secondary"
                        }`}
                      >
                        {CONVERSATION_TYPE_LABEL[conversation.conversationType]}
                      </span>
                    )}
                  </div>
                ) : !companyMode ? (
                  <div className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-hidden">
                    {conversation.activeDealId ? (
                      <>
                        {conversation.dealStage ? (
                          <span className="inline-flex shrink-0 rounded-full bg-sales-info-soft px-2 py-0.5 text-[10px] font-semibold text-sales-info">
                            {formatDealStage(conversation.dealStage)}
                          </span>
                        ) : null}
                        {dealLabel ? (
                          <span className="truncate rounded-full border border-sales-border bg-sales-surface-subtle px-2 py-0.5 text-[10px] font-semibold tabular-nums text-sales-text-primary">
                            {dealLabel}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <LeadStageBadge status={conversation.status} variant="list" className="shrink-0" />
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-0.5 sm:gap-1">
            {salespersonHub && !companyMode ? (
              <div className="mr-1 hidden min-w-0 items-center gap-2 text-right min-[720px]:flex">
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-[0.04em] text-sales-text-muted">Owner</div>
                  <div className={`truncate text-[11px] font-medium ${conversation.assignee ? "text-sales-text-primary" : "text-[#D97706]"}`}>
                    {conversation.assignee ? `Assigned to ${conversation.assignee.name.split(" ")[0]}` : "Unassigned"}
                  </div>
                </div>
                {!conversation.assignedToId && canClaim && onClaim ? (
                  <button
                    type="button"
                    disabled={claiming}
                    onClick={() => onClaim(conversation.id)}
                    className="rounded-[8px] bg-sales-brand px-2.5 py-1 text-[11px] font-semibold text-sales-brand-text disabled:opacity-50"
                  >
                    {claiming ? "Claiming…" : "Claim"}
                  </button>
                ) : null}
              </div>
            ) : null}
            {companyMode ? (
              <button
                type="button"
                onClick={() => {
                  if (canReassign) setTransferOpen(true);
                }}
                disabled={!canReassign}
                className="mr-1 hidden min-w-0 items-center gap-2 rounded-[8px] px-2 py-1 text-left hover:bg-sales-surface-hover disabled:cursor-default layout:flex"
                aria-label={canReassign ? "Assign or reassign conversation" : "Conversation owner"}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sales-surface-hover text-[9px] font-semibold text-sales-text-primary">
                  {conversation.assignee ? initials(conversation.assignee.name) : <UserRound size={13} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[8px] uppercase tracking-[0.04em] text-sales-text-muted">Owner</span>
                  <span className={`block max-w-24 truncate text-[10.5px] font-medium ${conversation.assignee ? "text-sales-text-primary" : "text-[#D97706]"}`}>
                    {conversation.assignee?.name ?? "Unassigned"}
                  </span>
                </span>
                {canReassign ? <ChevronDown size={12} className="text-sales-text-muted" /> : null}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleIntel}
              aria-label={contextOpen ? "Hide customer context" : "Show customer context"}
              title={contextOpen ? "Hide customer context" : "Show customer context"}
              className={isWhatsApp ? `wa-icon-btn !h-9 !w-9 ${contextOpen ? "!border-sales-brand-border !bg-sales-brand-soft" : ""}` : "flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"}
            >
              <PanelRight size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Conversation actions"
              aria-expanded={menuOpen}
              className={isWhatsApp ? "wa-icon-btn !h-9 !w-9" : "flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen ? (
              <div className={`absolute right-0 top-11 z-20 min-w-[200px] ${isWhatsApp ? "wa-dropdown" : "rounded-lg border border-[var(--border)] bg-[var(--surface-card)] py-1 shadow-lg"}`}>
                {canSend || canReassign ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void handleInternalNote();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-sales-text-primary hover:bg-sales-surface-hover"
                  >
                    <StickyNote size={14} />
                    Add internal note
                  </button>
                ) : null}
                {showLogCall ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setLogCallOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-sales-text-primary hover:bg-sales-surface-hover"
                  >
                    <Phone size={14} />
                    Log call
                  </button>
                ) : null}
                {canTransfer ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setTransferOpen(true);
                    }}
                    className="flex w-full px-3 py-2.5 text-left text-sm text-sales-text-primary hover:bg-sales-surface-hover"
                  >
                    Transfer conversation
                  </button>
                ) : null}
                {(salespersonHub || companyMode) && !isSupport ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setSupportTransferOpen(true);
                    }}
                    className="flex w-full px-3 py-2.5 text-left text-sm text-sales-text-primary hover:bg-sales-surface-hover"
                  >
                    Transfer to Support
                  </button>
                ) : null}
                {companyMode && (canReassign || canUpdateStatus) ? (
                  <button
                    type="button"
                    disabled={statusUpdating}
                    onClick={() => void handleConversationStatus(conversation.conversationStatus === "RESOLVED" ? "OPEN" : "RESOLVED")}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-sales-text-primary hover:bg-sales-surface-hover disabled:opacity-50"
                  >
                    <CheckCircle2 size={14} />
                    {conversation.conversationStatus === "RESOLVED" ? "Reopen conversation" : "Resolve conversation"}
                  </button>
                ) : null}
                {isWhatsApp ? (
                  <LearningConversationMenuItems
                    onTeach={() => {
                      setMenuOpen(false);
                      const lastHuman = [...messages].reverse().find((m) => m.direction === "rep" && m.kind !== "system");
                      setTeachMessageIds(lastHuman ? [lastHuman.id] : []);
                      setTeachOpen(true);
                    }}
                    onExclude={() => {
                      setMenuOpen(false);
                      setExcludeLearningOpen(true);
                    }}
                    onFromChat={() => {
                      setMenuOpen(false);
                      setFromChatOpen(true);
                    }}
                  />
                ) : null}
                {!canTransfer && !canUpdateStatus && !canSend && !canReassign && !showLogCall && !isWhatsApp ? (
                  <div className="px-3 py-2 text-xs text-sales-text-muted">No actions available</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {companyMode ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-sales-border bg-sales-surface px-3 py-2 sm:px-4">
          <ConversationTypeBadge type={conversation.conversationType} />
          {conversation.activeDealId ? (
            <span className="inline-flex rounded-full bg-sales-info-soft px-2 py-0.5 text-[10px] font-semibold text-sales-info">
              Deal
            </span>
          ) : null}
          {conversation.dealStage ? (
            <span className="inline-flex rounded-full border border-sales-border bg-sales-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-sales-text-primary">
              {formatDealStage(conversation.dealStage)}
            </span>
          ) : null}
        </div>
      ) : null}

      {salespersonHub && !isSupport ? (
        <SalesConversationAssist
          conversation={conversation}
          lead={contextLead}
          action={nextBestAction}
          onCall={conversation.phone ? () => window.open(`tel:${conversation.phone}`, "_self") : undefined}
          onSchedule={() => {
            window.location.href = `/sales/calendar?lead=${conversation.id}`;
          }}
          onViewQuote={dealHref ? () => window.location.assign(dealHref) : undefined}
          onCompletePlan={() => void handleCompletePlanAction()}
          completing={planCompleting}
          onInsertQuestion={insertComposerText}
          onCreateDeal={() => void openCreateDeal()}
          canCreateDeal={canCreateDeal}
        />
      ) : null}

      {companyMode && alsoSells && canSend && !isSupport ? (
        <SalesConversationAssist
          conversation={conversation}
          lead={contextLead}
          action={nextBestAction}
          onCall={conversation.phone ? () => window.open(`tel:${conversation.phone}`, "_self") : undefined}
          scheduleHref={`/client/calendar?lead=${conversation.id}`}
          onViewQuote={dealHref ? () => window.location.assign(dealHref) : undefined}
          onCompletePlan={() => void handleCompletePlanAction()}
          completing={planCompleting}
          onInsertQuestion={insertComposerText}
          onCreateDeal={() => void openCreateDeal()}
          canCreateDeal={canCreateDeal}
        />
      ) : null}

      {companyMode && !(alsoSells && canSend) ? (
        <ManagerWorkflowStrip
          conversation={conversation}
          canReassign={canReassign}
          onAssign={canReassign ? () => setTransferOpen(true) : undefined}
          onTransfer={canReassign ? () => setTransferOpen(true) : undefined}
          onNote={handleInternalNote}
          onResolve={
            canReassign || canUpdateStatus
              ? () => void handleConversationStatus(conversation.conversationStatus === "RESOLVED" ? "OPEN" : "RESOLVED")
              : undefined
          }
          resolving={statusUpdating}
        />
      ) : null}

      {campaignContext ? (
        <div className="border-b border-[var(--border)] bg-[rgba(212,255,79,0.06)] px-4 py-2 text-xs text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">Campaign:</span>{" "}
          {campaignContext.campaignName}
          {campaignContext.sentAt
            ? ` · Sent ${new Date(campaignContext.sentAt).toLocaleDateString("en-GB")}`
            : ""}
          {campaignContext.responseClassification
            ? ` · Response: ${campaignContext.responseClassification.replace(/_/g, " ")}`
            : ""}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="wa-chat-wallpaper inbox-scroll relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-5"
      >
        {loadingOlder ? (
          <div className="sticky top-0 z-10 mx-auto rounded-full border border-sales-border bg-sales-surface px-2.5 py-1 text-[10px] font-medium text-sales-text-secondary">
            Loading older messages...
          </div>
        ) : null}
        {loading ? (
          <div className="flex flex-1 flex-col justify-center gap-3 px-2 py-6">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
              >
                <div
                  className="h-10 animate-pulse rounded-[14px] bg-sales-surface-hover/80"
                  style={{ width: `${42 + index * 12}%`, maxWidth: "280px" }}
                />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 items-start justify-center pt-16">
            <span className="wa-empty-hint">No messages yet — say hello to start the conversation</span>
          </div>
        ) : (
          messageGroups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <div className="flex justify-center py-1">
                <div className="wa-day-rule">
                  <span>{group.label}</span>
                </div>
              </div>
              {group.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onTeach={
                    m.direction === "rep" && m.kind !== "system" && m.kind !== "internal"
                      ? () => {
                          setTeachMessageIds([m.id]);
                          setTeachOpen(true);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
        {hasNewBelow ? (
          <button
            type="button"
            onClick={() => {
              stickToBottomRef.current = true;
              setHasNewBelow(false);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="sticky bottom-3 z-10 mx-auto rounded-full border border-sales-border bg-sales-surface px-3 py-1.5 text-[12px] font-semibold text-sales-text-primary shadow-[0_4px_12px_rgba(16,24,40,0.08)]"
          >
            New messages ↓
          </button>
        ) : null}
      </div>

      {canSend || companyMode ? (
        <div className={`shrink-0 bg-sales-surface ${isWhatsApp ? "wa-composer" : "border-t border-[var(--border)]"}`}>
          {sendError ? (
            <div role="alert" className="border-b border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-center text-xs text-[var(--danger-fg)]">
              {sendError}
            </div>
          ) : null}
          {quickActionsOpen ? (
            <QuickReplyBar
              onAction={(a) => void handleQuickAction(a)}
              onSavedReply={(body) => void handleSavedReply(body)}
              savedReplies={savedReplies}
              disabled={sending || !transportAvailable}
              variant={isWhatsApp ? "whatsapp" : "default"}
              onCollapse={() => setQuickActionsOpen(false)}
            />
          ) : null}
          {!transportAvailable ? (
            <div className="mx-3 mt-2 flex items-start gap-2 rounded-[9px] border border-sales-danger/30 bg-sales-danger-soft px-3 py-2.5 text-sales-danger-fg">
              <AlertTriangle size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <div className="text-[12px] font-semibold">WhatsApp temporarily offline</div>
                <p className="mt-0.5 text-[11px] leading-snug">
                  Sending will resume after your company reconnects WhatsApp.
                </p>
              </div>
            </div>
          ) : null}
          {isWhatsApp && conversation ? (
            <AgentComposerAssist
              leadId={conversation.id}
              canSend={canSend}
              onEditDraft={(text) => {
                setInput(text);
                composerRef.current?.focus();
              }}
              onSent={() => {
                onMessagesChange();
                void fetch(`/api/inbox/conversations/${conversation.id}/messages?limit=80`)
                  .then((res) => (res.ok ? res.json() : null))
                  .then((data: { messages?: InboxChatMessage[] } | null) => {
                    if (data?.messages) {
                      setMessages((current) => mergeChatMessages(current, data.messages ?? []));
                    }
                  })
                  .catch(() => {});
              }}
            />
          ) : null}
          {salespersonHub && isWhatsApp && !isSupport ? (
            <SalespersonComposerToolbar
              variant="sales"
              quickActionsOpen={quickActionsOpen}
              onToggleQuickActions={() => setQuickActionsOpen((value) => !value)}
              onOpenAssetDrawer={() => setAssetDrawerOpen(true)}
              onInternalNote={handleInternalNote}
              onLogCall={() => setLogCallOpen(true)}
              onOpenCreateDeal={() => void openCreateDeal()}
              leadHref={leadHref}
              dealHref={dealHref}
              canCreateDeal={canCreateDeal}
              showLogCall={showLogCall}
            />
          ) : null}
          {salespersonHub && isWhatsApp && isSupport ? (
            <SalespersonComposerToolbar
              variant="support"
              onInternalNote={handleInternalNote}
              onTransfer={canTransfer ? () => setTransferOpen(true) : undefined}
              onTransferSupport={() => setSupportTransferOpen(true)}
              leadHref={leadHref}
              canTransfer={canTransfer}
            />
          ) : null}
          {companyMode && isWhatsApp ? (
            <ManagerComposerToolbar
              canSend={canSend}
              alsoSells={alsoSells}
              quickActionsOpen={quickActionsOpen}
              onToggleQuickActions={() => setQuickActionsOpen((value) => !value)}
              onOpenAssetDrawer={() => setAssetDrawerOpen(true)}
              onInternalNote={handleInternalNote}
              onLogCall={() => setLogCallOpen(true)}
              onTransfer={canReassign ? () => setTransferOpen(true) : undefined}
              onTransferSupport={!isSupport ? () => setSupportTransferOpen(true) : undefined}
              leadHref={leadHref}
              dealHref={dealHref}
              canCreateDeal={canCreateDeal}
              onOpenCreateDeal={() => void openCreateDeal()}
              showLogCall={showLogCall}
              isSupport={isSupport}
            />
          ) : null}
          {canSend ? (
          <div
            className={`${
              isWhatsApp && !salespersonHub && !companyMode ? "" : isWhatsApp ? "" : "border-t border-[var(--border)]"
            }`}
            onDragOver={(e) => {
              if (!isWhatsApp || sending || !transportAvailable) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              if (!isWhatsApp || sending || !transportAvailable) return;
              e.preventDefault();
              attachFile(e.dataTransfer.files?.[0]);
            }}
          >
            {isWhatsApp && attachment ? (
              <div className="wa-attach-preview mx-2 mt-2 sm:mx-3">
                {attachment.kind === "image" && attachment.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={attachment.previewUrl} alt="" className="wa-attach-thumb" />
                ) : attachment.kind === "video" && attachment.previewUrl ? (
                  <video src={attachment.previewUrl} className="wa-attach-thumb" muted />
                ) : (
                  <div className="wa-attach-file">
                    <FileText size={16} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-sales-text-primary">
                    {attachment.file.name}
                  </div>
                  <div className="text-[11px] text-sales-text-muted">
                    {attachment.kind === "image"
                      ? "Photo"
                      : attachment.kind === "video"
                        ? "Video"
                        : "File"}{" "}
                    · add a caption if you want
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearAttachment}
                  className="wa-attach-remove"
                  aria-label="Remove attachment"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
            <div
              className={`flex items-center gap-2 px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))] sm:px-3 ${
                companyMode ? "py-1.5" : "py-2.5"
              }`}
            >
            {!isWhatsApp ? (
              <button
                type="button"
                onClick={() => setQuickActionsOpen((open) => !open)}
                title={quickActionsOpen ? "Hide quick actions" : "Quick actions"}
                aria-expanded={quickActionsOpen}
                aria-label="Quick actions"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                  quickActionsOpen
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
                }`}
              >
                <FileText size={18} />
              </button>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={COMPOSER_ACCEPT}
                  className="sr-only"
                  onChange={(e) => {
                    attachFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={sending || !transportAvailable}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach a photo, video, or file"
                  aria-label="Attach a photo, video, or file"
                  className={`wa-plus-btn ${attachment ? "wa-plus-btn-open" : ""}`}
                >
                  <Paperclip size={18} strokeWidth={1.8} />
                </button>
              </>
            )}
            <input
              ref={composerRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendCustomMessage(input);
              }}
              onPaste={(e) => {
                const file = Array.from(e.clipboardData.files ?? [])[0];
                if (!file || !isWhatsApp) return;
                e.preventDefault();
                attachFile(file);
              }}
              placeholder={
                !transportAvailable
                  ? "WhatsApp temporarily offline"
                  : attachment
                    ? "Add a caption…"
                    : sessionClosed
                      ? "Type a message…"
                      : salespersonHub
                        ? "Type a message..."
                        : "Type a WhatsApp reply..."
              }
              disabled={sending || !transportAvailable}
              aria-label="Type a WhatsApp reply"
              className={
                isWhatsApp
                  ? `wa-composer-input sm:text-[14px] ${sessionClosed ? "opacity-80" : ""}`
                  : "min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-input)] px-4 py-2.5 text-[16px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border-focus)] sm:text-[15px]"
              }
            />
            <button
              type="button"
              disabled={(!input.trim() && !attachment) || sending || !transportAvailable}
              onClick={() => void sendCustomMessage(input)}
              aria-label="Send WhatsApp message"
              className={
                isWhatsApp
                  ? "wa-send-btn"
                  : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] transition-opacity disabled:opacity-40"
              }
            >
              <Send size={18} strokeWidth={1.8} />
            </button>
            </div>
          </div>
          ) : companyMode ? (
            <div className="border-t border-sales-border-subtle px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[11px] text-sales-text-secondary">
              {conversation.assignee ? (
                <span>
                  Assigned to <strong className="text-sales-text-primary">{conversation.assignee.name}</strong> — only the conversation owner can reply.
                </span>
              ) : (
                <span>This conversation is unassigned — assign an owner before sending messages.</span>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="wa-composer flex shrink-0 flex-col gap-2 bg-sales-surface px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[11px] font-medium text-sales-text-secondary">
          <div className="flex items-center justify-between gap-3">
            <span>Read-only — claim this conversation to send messages</span>
            {!conversation.assignedToId && canClaim && onClaim ? (
              <button
                type="button"
                disabled={claiming}
                onClick={() => onClaim(conversation.id)}
                className="shrink-0 rounded-[8px] bg-[#D4FF4F] px-2.5 py-1.5 text-[11px] font-semibold text-[#101828] disabled:opacity-50"
              >
                {claiming ? "Claiming..." : "Claim"}
              </button>
            ) : null}
          </div>
          {!transportAvailable ? (
            <p className="text-[11px] text-sales-text-muted">
              WhatsApp temporarily offline. CRM tools and message history remain available.
            </p>
          ) : null}
        </div>
      )}

      {pricingPicker ? (
        <PremiumSheet
          eyebrow="Assets"
          title="Select package"
          description="Choose which pricing package to send."
          onClose={() => setPricingPicker(null)}
          labelledBy="pricing-picker-title"
          maxWidthClass="max-w-sm"
        >
          <div className="flex flex-col gap-2">
            {pricingPicker.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void sendAsset("PRICING_PACKAGE", p.id)}
                className="rounded-[10px] border border-sales-border bg-sales-surface px-3 py-2.5 text-left text-[13px] font-medium text-sales-text-primary transition-colors hover:bg-sales-surface-hover"
              >
                {p.name}
              </button>
            ))}
          </div>
        </PremiumSheet>
      ) : null}

      {noteOpen ? (
        <PremiumSheet
          eyebrow="Internal"
          title="Add internal note"
          description="The customer will not see this note."
          onClose={() => {
            if (!noteSaving) setNoteOpen(false);
          }}
          closeDisabled={noteSaving}
          labelledBy="inbox-internal-note-title"
          maxWidthClass="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={noteSaving}
                onClick={() => setNoteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={noteSaving}
                disabled={!noteDraft.trim()}
                onClick={() => void saveInternalNote()}
              >
                Save note
              </Button>
            </div>
          }
        >
          <TextArea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder="Write a note for the team…"
            rows={5}
            autoFocus
          />
        </PremiumSheet>
      ) : null}

      {logCallOpen ? (
        <PremiumSheet
          eyebrow="Call log"
          title="Log call"
          description="Record the outcome and next step."
          onClose={() => setLogCallOpen(false)}
          labelledBy="inbox-log-call-title"
          maxWidthClass="max-w-lg"
        >
          <LogCallForm
            leadId={conversation.id}
            variant="compact"
            appearance="premium"
            onLogged={() => {
              setLogCallOpen(false);
              onMessagesChange();
              void fetch(`/api/inbox/conversations/${conversation.id}/messages?limit=80`)
                .then((r) => r.json())
                .then((d: { messages?: InboxChatMessage[] }) =>
                  setMessages((current) => mergeChatMessages(current, d.messages ?? []))
                );
            }}
          />
        </PremiumSheet>
      ) : null}

      <TransferDialog
        open={transferOpen}
        salespeople={salespeople}
        currentAssigneeId={conversation.assignedToId}
        onClose={() => setTransferOpen(false)}
        onTransfer={handleTransfer}
        whatsappMode={isWhatsApp}
      />
      {(salespersonHub || companyMode) ? (
        <TransferToSupportDialog
          open={supportTransferOpen}
          salespeople={salespeople}
          currentUserId={userId}
          onClose={() => setSupportTransferOpen(false)}
          onTransfer={async (payload) => {
            const res = await fetch(`/api/inbox/conversations/${conversation.id}/transfer-support`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const json = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) throw new Error(json.error ?? "Transfer failed");
            onConversationUpdate?.();
            onMessagesChange();
          }}
        />
      ) : null}
      <AssetDrawer
        open={assetDrawerOpen}
        clientId={clientId}
        disabled={sending || !transportAvailable}
        onClose={() => setAssetDrawerOpen(false)}
        onSendDocument={(id) => void sendAsset("DOCUMENT", id)}
        onSendPortfolio={() => void sendAsset("PORTFOLIO")}
        onSendTestimonials={() => void sendAsset("TESTIMONIALS")}
        onSendPackage={(id) => void sendAsset("PRICING_PACKAGE", id)}
      />
      {dealLead ? (
        <CreateDealSheet
          lead={dealLead}
          open={createDealOpen}
          onClose={() => setCreateDealOpen(false)}
          onCreated={() => {
            setCreateDealOpen(false);
            onConversationUpdate?.();
          }}
          currency={conversation.dealCurrency ?? "USD"}
        />
      ) : null}
      {conversation ? (
        <LearningConversationSheets
          leadId={conversation.id}
          teachOpen={teachOpen}
          excludeOpen={excludeLearningOpen}
          fromChatOpen={fromChatOpen}
          messageIds={teachMessageIds}
          onClose={() => {
            setTeachOpen(false);
            setExcludeLearningOpen(false);
            setFromChatOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
