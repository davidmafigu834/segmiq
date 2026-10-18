"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app
   Component scope: triangular dock. Eight states: default, hover, focus-visible, pressed, open, unread, empty, error. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Handshake, Megaphone, MessageSquare, X } from "lucide-react";
import { OverlayPortal } from "@/components/sales/ui/OverlayPortal";
import { useFocusTrap } from "@/components/sales/ui/useFocusTrap";
import { ReEmptyState, ReErrorState } from "@/components/real-estate/ui/primitives";
import { ReSheet } from "@/components/real-estate/ui/ReSheet";
import { compactUnreadCount, filterImportantMessages, type ImportantCategory, type ImportantMessage } from "@/lib/important-messages/model";
import { cn } from "@/lib/ui/cn";

type FeedResponse = {
  items: ImportantMessage[];
  unreadCount: number;
  announcementsAvailable: boolean;
};

type ImportantMessagesContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  items: ImportantMessage[];
  unreadCount: number;
  announcementsAvailable: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  markRead: (item: ImportantMessage) => void;
  markAllRead: () => void;
};

const ImportantMessagesContext = createContext<ImportantMessagesContextValue | null>(null);

function useImportantMessages() {
  const value = useContext(ImportantMessagesContext);
  if (!value) {
    throw new Error("Important messages are only available inside the workspace shell.");
  }
  return value;
}

export function ImportantMessagesProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ImportantMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcementsAvailable, setAnnouncementsAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desktop, setDesktop] = useState(false);

  const refresh = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    void fetch("/api/important-messages")
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        return (await response.json()) as FeedResponse;
      })
      .then((data) => {
        setItems(data.items ?? []);
        setUnreadCount(data.unreadCount ?? 0);
        setAnnouncementsAvailable(data.announcementsAvailable !== false);
        setError(null);
      })
      .catch(() => setError("Could not load important messages."))
      .finally(() => setLoading(false));
  }, [enabled]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1100px)");
    const apply = () => setDesktop(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(refresh, 90_000);
    return () => window.clearInterval(timer);
  }, [open, refresh]);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("segmiq:open-important-messages", onOpen);
    return () => window.removeEventListener("segmiq:open-important-messages", onOpen);
  }, []);

  const markRead = useCallback((item: ImportantMessage) => {
    if (item.source === "introduction") return;
    const notificationIds = item.source === "notification" ? [item.id] : [];
    const announcementIds = item.source === "announcement" ? [item.id.replace("announcement:", "")] : [];
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
    setUnreadCount((count) => Math.max(0, count - (item.read ? 0 : 1)));
    void fetch("/api/important-messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds, announcementIds }),
    }).then((response) => {
      if (!response.ok) refresh();
    });
  }, [refresh]);

  const markAllRead = useCallback(() => {
    const unread = items.filter((item) => !item.read);
    if (unread.length === 0) return;
    void fetch("/api/important-messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notificationIds: unread.filter((item) => item.source === "notification").map((item) => item.id),
        announcementIds: unread
          .filter((item) => item.source === "announcement")
          .map((item) => item.id.replace("announcement:", "")),
      }),
    }).then((response) => {
      if (response.ok) refresh();
    });
  }, [items, refresh]);

  return (
    <ImportantMessagesContext.Provider
      value={{ open, setOpen, items, unreadCount, announcementsAvailable, loading, error, refresh, markRead, markAllRead }}
    >
      {children}
      {open && desktop ? <ImportantMessagesPanel /> : null}
      {open && !desktop ? <ImportantMessagesSheet /> : null}
    </ImportantMessagesContext.Provider>
  );
}

export function ImportantMessagesTrigger({
  collapsed = false,
  floating = false,
}: {
  collapsed?: boolean;
  floating?: boolean;
}) {
  const { open, setOpen, unreadCount } = useImportantMessages();
  const keyboardOpen = useKeyboardOpen();
  const count = compactUnreadCount(unreadCount);
  if (floating && keyboardOpen) return null;
  const label = count ? `Important messages, ${unreadCount} unread` : "Important messages";
  const button = (
    <button
      type="button"
      className={cn(
        "important-messages-trigger relative inline-flex h-12 w-12 items-center justify-center focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
        floating && "layout:hidden",
        !floating && "mx-auto"
      )}
      style={
        floating
          ? {
              position: "fixed",
              right: 16,
              left: "auto",
              bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 12px)",
              zIndex: 60,
            }
          : undefined
      }
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={() => setOpen(!open)}
    >
      <svg viewBox="0 0 48 44" className={cn("h-12 w-12 drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)]", collapsed && "h-10 w-10")} aria-hidden>
        <path
          d="M8 36.5 L24 7.5 L40 36.5 Z"
          fill="#101828"
          stroke="#d4ff4f"
          strokeWidth={1.75}
          strokeLinejoin="round"
        />
      </svg>
      <MessageSquare size={15} strokeWidth={2} className="absolute text-[#d4ff4f]" aria-hidden />
      {floating ? (
        <span className="absolute bottom-[calc(100%+4px)] right-0 whitespace-nowrap rounded-full bg-[#101828] px-2 py-1 text-[11px] font-semibold leading-none text-[#f9fafc]">
          Messages
        </span>
      ) : null}
      {count ? (
        <span className="absolute -right-0.5 top-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d4ff4f] px-1 text-[10px] font-semibold leading-none text-[#101828]">
          {count}
        </span>
      ) : null}
    </button>
  );
  if (floating) return <OverlayPortal>{button}</OverlayPortal>;
  return button;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "collaboration", label: "Collaboration" },
  { id: "approvals", label: "Approvals" },
  { id: "whats_new", label: "What's New" },
] as const;

function MessageList({
  category,
  onNavigate,
}: {
  category: "all" | ImportantCategory;
  onNavigate?: () => void;
}) {
  const { items, loading, error, refresh, announcementsAvailable, markRead } = useImportantMessages();
  const router = useRouter();
  const visible = filterImportantMessages(items, category);
  if (loading && items.length === 0) {
    return (
      <div className="space-y-2 px-3 py-3" aria-hidden>
        <div className="h-12 animate-pulse rounded-[8px] bg-sales-surface-hover motion-reduce:animate-none" />
        <div className="h-12 animate-pulse rounded-[8px] bg-sales-surface-hover motion-reduce:animate-none" />
      </div>
    );
  }
  if (error && items.length === 0) {
    return <ReErrorState title="Important messages didn't load" description="Try again in a moment." onRetry={refresh} />;
  }
  if (visible.length === 0) {
    const empty =
      category === "whats_new" && !announcementsAvailable
        ? { title: "Updates are not available yet", description: "Product announcements appear after the announcement update is applied." }
        : category === "approvals"
          ? { title: "No approvals waiting", description: "Decisions that need you will show up here." }
          : category === "collaboration"
            ? { title: "No collaboration updates", description: "Introduction decisions and requests will show up here." }
            : { title: "You're all caught up", description: "No important unread messages right now." };
    return <ReEmptyState compact title={empty.title} description={empty.description} />;
  }
  return (
    <ul className="divide-y divide-sales-border-subtle">
      {visible.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="flex min-h-11 w-full items-start gap-3 px-3 py-3 text-left hover:bg-sales-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]"
            onClick={() => {
              markRead(item);
              onNavigate?.();
              if (item.href) router.push(item.href);
            }}
          >
            <CategoryMark category={item.category} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className={cn("truncate text-[14px] text-sales-text-primary", item.read ? "font-medium" : "font-semibold")}>
                  {item.title}
                </span>
                {!item.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sales-brand" aria-label="Unread" /> : null}
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-sales-text-secondary">{item.description}</span>
              <span className="mt-1 block text-[11px] text-sales-text-muted">
                {relativeTime(item.createdAt)}
                {item.actionLabel ? ` · ${item.actionLabel}` : ""}
                {item.resolved ? " · Resolved" : item.priority === "action" ? " · Action required" : ""}
              </span>
            </span>
            <ChevronRight size={16} className="mt-1 shrink-0 text-sales-text-muted" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

function CategoryMark({ category }: { category: ImportantCategory }) {
  const Icon = category === "whats_new" ? Megaphone : Handshake;
  return (
    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sales-surface-hover text-sales-text-secondary">
      <Icon size={14} strokeWidth={1.8} aria-hidden />
    </span>
  );
}

function CategoryTabs({
  value,
  onChange,
}: {
  value: "all" | ImportantCategory;
  onChange: (value: "all" | ImportantCategory) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto px-3 pb-2" role="tablist" aria-label="Message categories">
      {CATEGORIES.map((category) => (
        <button
          key={category.id}
          type="button"
          role="tab"
          aria-selected={value === category.id}
          className={cn(
            "min-h-11 shrink-0 rounded-full px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:shadow-[var(--sales-focus-ring)]",
            value === category.id ? "bg-sales-text-primary text-sales-surface" : "text-sales-text-secondary hover:bg-sales-surface-hover"
          )}
          onClick={() => onChange(category.id)}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}

function ImportantMessagesPanel() {
  const { setOpen, unreadCount, markAllRead } = useImportantMessages();
  const [category, setCategory] = useState<"all" | ImportantCategory>("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(panelRef, true);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [setOpen]);

  return (
    <OverlayPortal>
      <div className="sales-modal-premium fixed inset-0 z-[80]">
      <button type="button" className="sales-modal-backdrop absolute inset-0" aria-label="Close important messages" onClick={() => setOpen(false)} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed bottom-4 left-[calc(var(--sales-sidebar-current-width,228px)+12px)] z-[81] flex max-h-[min(70vh,560px)] w-[min(400px,calc(100vw-var(--sales-sidebar-current-width,228px)-24px))] flex-col overflow-hidden rounded-[14px] border border-[var(--sales-border)] bg-[var(--sales-surface)] text-[var(--sales-text-primary)] shadow-sales-raised"
        style={{ backgroundColor: "var(--sales-surface, #f9fafc)", opacity: 1 }}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold text-[var(--sales-text-primary)]">Important Messages</h2>
            <p className="text-[12px] text-[var(--sales-text-secondary)]">{unreadCount > 0 ? `${unreadCount} unread` : "No unread messages"}</p>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 ? (
              <button type="button" className="min-h-11 rounded-[8px] px-2 text-[12px] font-medium text-sales-text-secondary hover:bg-sales-surface-hover" onClick={markAllRead}>
                Mark all read
              </button>
            ) : null}
            <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] hover:bg-sales-surface-hover" aria-label="Close important messages" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
        </div>
        <CategoryTabs value={category} onChange={setCategory} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MessageList category={category} onNavigate={() => setOpen(false)} />
        </div>
      </div>
      </div>
    </OverlayPortal>
  );
}

function ImportantMessagesSheet() {
  const { setOpen, unreadCount, markAllRead } = useImportantMessages();
  const [category, setCategory] = useState<"all" | ImportantCategory>("all");
  return (
    <ReSheet
      title="Important Messages"
      description={unreadCount > 0 ? `${unreadCount} unread` : "No unread messages"}
      placement="bottom"
      onClose={() => setOpen(false)}
      headerAside={
        unreadCount > 0 ? (
          <button type="button" className="min-h-11 rounded-[8px] px-2 text-[12px] font-medium text-sales-text-secondary" onClick={markAllRead}>
            Mark all read
          </button>
        ) : undefined
      }
    >
      <CategoryTabs value={category} onChange={setCategory} />
      <MessageList category={category} onNavigate={() => setOpen(false)} />
    </ReSheet>
  );
}

function useKeyboardOpen() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const check = () => setKeyboardOpen(window.innerHeight - viewport.height > 140);
    viewport.addEventListener("resize", check);
    return () => viewport.removeEventListener("resize", check);
  }, []);
  return keyboardOpen;
}

function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
