"use client";

import type { LucideIcon } from "lucide-react";
import {
  DollarSign,
  FileText,
  Image,
  LayoutGrid,
  MessageSquare,
  Star,
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

type Props = {
  onAction: (action: QuickReplyAction) => void;
  disabled?: boolean;
};

export function QuickReplyBar({ onAction, disabled }: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--border)] px-5 py-2.5">
      {QUICK_REPLY_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            disabled={disabled}
            onClick={() => onAction(action)}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon size={12} />
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
