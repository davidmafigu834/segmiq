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
    <div className="inbox-scroll flex shrink-0 items-center gap-2 overflow-x-auto border-t border-[#E9EDEF] bg-[#F0F2F5] px-3 py-2.5 sm:flex-wrap sm:overflow-x-visible sm:px-4">
      {QUICK_REPLY_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            disabled={disabled}
            onClick={() => onAction(action)}
            className="shrink-0 rounded-full border border-[#D1D7DB] bg-white px-3 py-1.5 text-xs font-medium text-[#111B21] shadow-sm transition-all hover:border-[#00A884] hover:bg-[#E7FCE3] hover:text-[#008069] disabled:opacity-40"
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon size={12} className="text-[#54656F]" />
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
