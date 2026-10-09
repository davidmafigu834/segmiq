"use client";

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
  const title = variant === "support" ? "Support tools" : "Conversation tools";

  return (
    <div className="wa-composer-toolbar" aria-label={title}>
      <div className="wa-composer-toolbar-scroll" role="toolbar" aria-label={title}>
        {variant === "support" ? (
          <>
            <ComposerTool icon={StickyNote} label="Add note" onClick={onInternalNote} />
            {leadHref ? <ComposerTool icon={UserRound} label="View customer" href={leadHref} /> : null}
            {canTransfer && onTransfer ? (
              <ComposerTool icon={Headphones} label="Transfer" onClick={onTransfer} />
            ) : null}
            {onTransferSupport ? (
              <ComposerTool icon={Headphones} label="To Support" onClick={onTransferSupport} />
            ) : null}
          </>
        ) : (
          <>
            {onToggleQuickActions ? (
              <ComposerTool
                icon={Zap}
                label="Quick replies"
                active={quickActionsOpen}
                onClick={onToggleQuickActions}
                courseTarget="whatsapp-quick-replies"
              />
            ) : null}
            {onOpenAssetDrawer ? (
              <ComposerTool icon={Paperclip} label="Send asset" onClick={onOpenAssetDrawer} />
            ) : null}
            {onCommandSegmiq ? (
              <ComposerTool icon={MessageSquare} label="Command SegmiQ" onClick={onCommandSegmiq} />
            ) : null}
            <ComposerTool icon={StickyNote} label="Internal note" onClick={onInternalNote} />
            {showLogCall && onLogCall ? (
              <ComposerTool icon={Phone} label="Log call" onClick={onLogCall} courseTarget="whatsapp-log-call" />
            ) : null}
            {leadHref ? <ComposerTool icon={UserRound} label="View Lead" href={leadHref} /> : null}
            {dealHref ? (
              <ComposerTool icon={BriefcaseBusiness} label="View Deal" href={dealHref} accent />
            ) : canCreateDeal && onOpenCreateDeal ? (
              <ComposerTool icon={BriefcaseBusiness} label="Create Deal" accent onClick={onOpenCreateDeal} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
