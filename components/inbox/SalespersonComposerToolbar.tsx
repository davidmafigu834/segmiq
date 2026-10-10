"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  Headphones,
  MessageSquare,
  Paperclip,
  Phone,
  StickyNote,
  UserRound,
  Zap,
} from "lucide-react";

type ToolProps = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  accent?: boolean;
  onClick?: () => void;
  href?: string;
  courseTarget?: string;
};

function ComposerTool({ icon: Icon, label, active, accent, onClick, href, courseTarget }: ToolProps) {
  const className = [
    "wa-composer-tool",
    active ? "wa-composer-tool-active" : "",
    accent ? "wa-composer-tool-accent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="wa-composer-tool-icon" aria-hidden>
        <Icon size={15} strokeWidth={1.85} />
      </span>
      <span className="wa-composer-tool-label">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} data-course-target={courseTarget}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      data-course-target={courseTarget}
      aria-pressed={active}
    >
      {content}
    </button>
  );
}

type Props = {
  variant: "sales" | "support";
  quickActionsOpen?: boolean;
  onToggleQuickActions?: () => void;
  onOpenAssetDrawer?: () => void;
  onInternalNote: () => void;
  onLogCall?: () => void;
  onOpenCreateDeal?: () => void;
  onCommandSegmiq?: () => void;
  onTransfer?: () => void;
  onTransferSupport?: () => void;
  leadHref?: string;
  dealHref?: string;
  canCreateDeal?: boolean;
  showLogCall?: boolean;
  canTransfer?: boolean;
};

export function SalespersonComposerToolbar({
  variant,
  quickActionsOpen = false,
  onToggleQuickActions,
  onOpenAssetDrawer,
  onInternalNote,
  onLogCall,
  onOpenCreateDeal,
  onCommandSegmiq,
  onTransfer,
  onTransferSupport,
  leadHref,
  dealHref,
  canCreateDeal = false,
  showLogCall = false,
  canTransfer = false,
}: Props) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const title = variant === "support" ? "Support tools" : "Sales actions";

  function run(action?: () => void) {
    setActionsOpen(false);
    action?.();
  }

  const tools = (
    <>
      {variant === "support" ? (
        <>
          <ComposerTool icon={StickyNote} label="Add note" onClick={() => run(onInternalNote)} />
          {leadHref ? <ComposerTool icon={UserRound} label="View customer" href={leadHref} /> : null}
          {canTransfer && onTransfer ? (
            <ComposerTool icon={Headphones} label="Transfer" onClick={() => run(onTransfer)} />
          ) : null}
          {onTransferSupport ? (
            <ComposerTool icon={Headphones} label="To Support" onClick={() => run(onTransferSupport)} />
          ) : null}
        </>
      ) : (
        <>
          {onToggleQuickActions ? (
            <ComposerTool
              icon={Zap}
              label="Quick replies"
              active={quickActionsOpen}
              onClick={() => run(onToggleQuickActions)}
              courseTarget="whatsapp-quick-replies"
            />
          ) : null}
          {onOpenAssetDrawer ? (
            <ComposerTool icon={Paperclip} label="Send asset" onClick={() => run(onOpenAssetDrawer)} />
          ) : null}
          {onCommandSegmiq ? (
            <ComposerTool icon={MessageSquare} label="Command SegmiQ" onClick={() => run(onCommandSegmiq)} />
          ) : null}
          <ComposerTool icon={StickyNote} label="Internal note" onClick={() => run(onInternalNote)} />
          {showLogCall && onLogCall ? (
            <ComposerTool icon={Phone} label="Log call" onClick={() => run(onLogCall)} courseTarget="whatsapp-log-call" />
          ) : null}
          {leadHref ? <ComposerTool icon={UserRound} label="View Lead" href={leadHref} /> : null}
          {dealHref ? (
            <ComposerTool icon={BriefcaseBusiness} label="View Deal" href={dealHref} accent />
          ) : canCreateDeal && onOpenCreateDeal ? (
            <ComposerTool icon={BriefcaseBusiness} label="Create Deal" accent onClick={() => run(onOpenCreateDeal)} />
          ) : null}
        </>
      )}
    </>
  );

  return (
    <div className="wa-composer-toolbar" aria-label={title}>
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-full px-1 text-[13px] font-semibold text-sales-text-primary min-[1100px]:hidden"
        onClick={() => setActionsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={actionsOpen}
      >
        {title}
      </button>
      <div className="wa-composer-toolbar-scroll hidden min-[1100px]:flex" role="toolbar" aria-label={title}>
        {tools}
      </div>
      {actionsOpen ? (
        <div className="min-[1100px]:hidden">
          <button
            type="button"
            className="fixed inset-0 z-[46] bg-[rgba(11,16,20,0.62)]"
            aria-label="Close sales actions"
            onClick={() => setActionsOpen(false)}
          />
          <div
            role="dialog"
            aria-label={title}
            className="fixed inset-x-0 bottom-0 z-[47] rounded-t-[16px] bg-sales-surface px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.28)]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-sales-border" />
            <div className="wa-sales-actions-sheet flex max-h-[50vh] flex-col gap-1 overflow-y-auto">{tools}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
