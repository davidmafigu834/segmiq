"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRightLeft,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  FileText,
  Flame,
  Inbox,
  ListTodo,
  Mail,
  MailCheck,
  PhoneCall,
  Pin,
  PinOff,
  RefreshCw,
  StickyNote,
  Upload,
  UserPlus,
  UserRound,
  Workflow,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { ActivityIconKey, ActivityTone } from "@/lib/activity/presentation";
import { cn } from "@/lib/ui/cn";

export function ActivityIcon({
  iconKey,
  tone = "neutral",
  className,
}: {
  iconKey: ActivityIconKey;
  tone?: ActivityTone;
  className?: string;
}) {
  const toneClass: Record<ActivityTone, string> = {
    neutral: "bg-sales-neutral-100 text-sales-text-secondary",
    success: "bg-sales-success-soft text-sales-success-fg",
    info: "bg-[rgba(38,132,255,0.10)] text-[#1768C5] dark:text-[#79AEF7]",
    warning: "bg-sales-warning-soft text-sales-warning-fg",
    brand: "bg-sales-brand-soft text-sales-brand-fg",
    danger: "bg-sales-danger-soft text-sales-danger-fg",
  };

  const Icon = resolveIcon(iconKey);
  const isWhatsApp = iconKey === "whatsapp";

  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] sm:h-[34px] sm:w-[34px]",
        !isWhatsApp && toneClass[tone],
        isWhatsApp && "bg-[rgba(37,211,102,0.12)]",
        className
      )}
      aria-hidden
    >
      {isWhatsApp ? (
        <SiWhatsapp size={16} color="#25D366" aria-hidden />
      ) : (
        <Icon size={16} strokeWidth={1.8} />
      )}
    </span>
  );
}

function resolveIcon(key: ActivityIconKey): LucideIcon {
  const map: Record<ActivityIconKey, LucideIcon> = {
    "user-plus": UserPlus,
    "phone-call": PhoneCall,
    whatsapp: SiWhatsapp as unknown as LucideIcon,
    mail: Mail,
    "mail-check": MailCheck,
    "sticky-note": StickyNote,
    "file-text": FileText,
    "file-check": FileCheck2,
    upload: Upload,
    "calendar-clock": CalendarClock,
    "list-todo": ListTodo,
    "check-circle": CheckCircle2,
    "arrow-right-left": ArrowRightLeft,
    flame: Flame,
    activity: Activity,
    refresh: RefreshCw,
    workflow: Workflow,
    "user-round": UserRound,
    inbox: Inbox,
  };
  return map[key] ?? Activity;
}

export { Pin, PinOff };
