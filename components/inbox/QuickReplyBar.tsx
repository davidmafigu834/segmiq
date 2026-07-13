"use client";

import type { LucideIcon } from "lucide-react";
import {
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
  disabled?: boolean;
  variant?: "whatsapp" | "default";
};

export function QuickReplyBar({ onAction, disabled, variant = "whatsapp" }: Props) {
  const isWa = variant === "whatsapp";

  return (
    <div className={isWa ? "px-3 pb-3 pt-2.5 sm:px-4" : "px-3 pb-3 pt-2.5 sm:px-4"}>
      <div className="mb-2 flex items-center gap-1.5">
        <Zap
          size={12}
          className={isWa ? "text-[#00A884]" : "text-[var(--accent)]"}
        />
        <span
          className={
            isWa
              ? "text-[11px] font-semibold uppercase tracking-wide text-[#8696A0]"
              : "text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]"
          }
        >
          Quick actions
        </span>
      </div>

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
              onClick={() => onAction(action)}
              className={
                isWa
                  ? "group flex min-h-[54px] items-center gap-2.5 rounded-xl border border-[#E9EDEF] bg-white p-2.5 text-left shadow-[0_1px_2px_rgba(17,27,33,0.05)] transition-all active:scale-[0.98] hover:border-[#00A884]/35 hover:shadow-[0_2px_10px_rgba(0,168,132,0.1)] disabled:pointer-events-none disabled:opacity-45"
                  : "group flex min-h-[54px] items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-2.5 text-left transition-all active:scale-[0.98] hover:border-[var(--accent-border)] hover:bg-[var(--bg-tertiary)] disabled:pointer-events-none disabled:opacity-45"
              }
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
                style={{ background: meta.tintBg }}
              >
                <Icon size={17} style={{ color: meta.tintFg }} strokeWidth={2.25} />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span
                  className={
                    isWa
                      ? "block truncate text-[13px] font-semibold text-[#111B21]"
                      : "block truncate text-[13px] font-semibold text-[var(--text-primary)]"
                  }
                >
                  {meta.shortLabel}
                </span>
                <span
                  className={
                    isWa
                      ? "mt-0.5 block truncate text-[10px] text-[#8696A0]"
                      : "mt-0.5 block truncate text-[10px] text-[var(--text-tertiary)]"
                  }
                >
                  {action.type === "CUSTOM_MESSAGE" && action.preset
                    ? "Tap to send"
                    : action.type === "PRICING_PACKAGE"
                      ? "Pick a package"
                      : "Tap to send"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
