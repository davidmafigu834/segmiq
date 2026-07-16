"use client";

import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  DollarSign,
  FileText,
  Image,
  LayoutGrid,
  MessageSquare,
  Star,
  Zap,
} from "lucide-react";

export type QuickReplyAction =
  | { type: "PORTFOLIO" | "TESTIMONIALS"; label: string; icon: LucideIcon }
  | { type: "PRICING_PACKAGE"; label: string; icon: LucideIcon; needsPicker: true }
  | { type: "CUSTOM_MESSAGE"; label: string; icon: LucideIcon; preset: string };

export type SavedQuickReply = {
  id: string;
  title: string;
  body: string;
  isDefault?: boolean;
};

export const QUICK_REPLY_ACTIONS: QuickReplyAction[] = [
  { type: "PRICING_PACKAGE", label: "Send Pricing", icon: DollarSign, needsPicker: true },
  { type: "PORTFOLIO", label: "Send Portfolio", icon: LayoutGrid },
  { type: "CUSTOM_MESSAGE", label: "Schedule Site Visit", icon: MessageSquare, preset: "I can get a technician out for a free site visit — what day works for you this week?" },
  { type: "CUSTOM_MESSAGE", label: "Request Photos", icon: Image, preset: "Could you send a couple of photos of your roof or meter board so we can size the system accurately?" },
  { type: "TESTIMONIALS", label: "Reviews", icon: Star },
  { type: "CUSTOM_MESSAGE", label: "Custom", icon: FileText, preset: "" },
];

type DisplayMeta = {
  shortLabel: string;
  tintBg: string;
  tintFg: string;
};

const DISPLAY: Record<string, DisplayMeta> = {
  "Send Pricing": { shortLabel: "Pricing", tintBg: "#E7FCE3", tintFg: "#008069" },
  "Send Portfolio": { shortLabel: "Portfolio", tintBg: "#E0F2FE", tintFg: "#0369A1" },
  "Schedule Site Visit": { shortLabel: "Site visit", tintBg: "#EDE9FE", tintFg: "#6D28D9" },
  "Request Photos": { shortLabel: "Photos", tintBg: "#FFF4E5", tintFg: "#B45309" },
  Reviews: { shortLabel: "Reviews", tintBg: "#FEF9C3", tintFg: "#A16207" },
  Custom: { shortLabel: "Custom", tintBg: "#F0F2F5", tintFg: "#54656F" },
};

type Props = {
  onAction: (action: QuickReplyAction) => void;
  onSavedReply?: (body: string) => void;
  savedReplies?: SavedQuickReply[];
  disabled?: boolean;
  variant?: "whatsapp" | "default";
  onCollapse?: () => void;
  collapseAfterAction?: boolean;
};

export function QuickReplyBar({
  onAction,
  onSavedReply,
  savedReplies = [],
  disabled,
  variant = "whatsapp",
  onCollapse,
  collapseAfterAction = false,
}: Props) {
  const isWa = variant === "whatsapp";

  function handleAction(action: QuickReplyAction) {
    onAction(action);
    if (collapseAfterAction) onCollapse?.();
  }

  function handleSavedReply(body: string) {
    onSavedReply?.(body);
    if (collapseAfterAction) onCollapse?.();
  }

  return (
    <div
      className={
        isWa
          ? "max-h-[min(42vh,320px)] overflow-y-auto border-b border-[#DFE5EB] bg-[#F7F9FB]/95 px-3 py-3.5 sm:px-4 inbox-scroll backdrop-blur-sm"
          : "max-h-[min(42vh,320px)] overflow-y-auto border-b border-[var(--border)] bg-[var(--bg-tertiary)] px-3 py-2.5 sm:px-4 inbox-scroll"
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Zap
            size={12}
            className={isWa ? "text-[#0F9F73]" : "text-[var(--accent-fg)]"}
          />
          <span
            className={
              isWa
                ? "text-[11px] font-bold uppercase tracking-[0.12em] text-[#7B8996]"
                : "text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]"
            }
          >
            Quick actions
          </span>
        </div>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            title="Hide quick actions"
            className={
              isWa
                ? "flex h-7 w-7 items-center justify-center rounded-lg text-[#61707E] hover:bg-[#E9EEF2]"
                : "flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-quaternary)]"
            }
          >
            <ChevronDown size={16} />
          </button>
        ) : null}
      </div>

      {savedReplies.length > 0 && onSavedReply ? (
        <div className="mb-3">
          <div className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${isWa ? "text-[#8696A0]" : "text-[var(--text-tertiary)]"}`}>
            Saved replies
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {savedReplies.map((reply) => (
              <button
                key={reply.id}
                type="button"
                disabled={disabled}
                onClick={() => handleSavedReply(reply.body)}
                title={reply.body}
                className={
                  isWa
                    ? "shrink-0 rounded-lg border border-[#DFE5EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#53616E] shadow-sm transition-all hover:border-[#0F9F73]/45 hover:text-[#087B59] hover:shadow-md disabled:opacity-45"
                    : "shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-card)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent-border)] disabled:opacity-45"
                }
              >
                {reply.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {QUICK_REPLY_ACTIONS.map((action) => {
          const Icon = action.icon;
          const meta = DISPLAY[action.label] ?? {
            shortLabel: action.label,
            tintBg: "#F0F2F5",
            tintFg: "#54656F",
          };

          return (
            <button
              key={action.label}
              type="button"
              disabled={disabled}
              onClick={() => handleAction(action)}
              className={
                isWa
                  ? "group flex min-h-[54px] items-center gap-2.5 rounded-xl border border-[#DFE5EB] bg-white p-2.5 text-left shadow-[0_2px_6px_rgba(34,48,61,0.05)] transition-all active:scale-[0.98] hover:-translate-y-0.5 hover:border-[#0F9F73]/35 hover:shadow-[0_7px_18px_rgba(34,48,61,0.09)] disabled:pointer-events-none disabled:opacity-45"
                  : "group flex min-h-[48px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-2 text-left transition-all active:scale-[0.98] hover:border-[var(--accent-border)] hover:bg-[var(--bg-tertiary)] disabled:pointer-events-none disabled:opacity-45"
              }
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
                style={{ background: meta.tintBg }}
              >
                <Icon size={16} style={{ color: meta.tintFg }} strokeWidth={2.25} />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span
                  className={
                    isWa
                      ? "block truncate text-[12px] font-semibold text-[#25313C]"
                      : "block truncate text-[12px] font-semibold text-[var(--text-primary)]"
                  }
                >
                  {meta.shortLabel}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
