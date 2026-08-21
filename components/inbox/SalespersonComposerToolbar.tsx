"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Headphones,
  Paperclip,
  Phone,
  StickyNote,
  UserRound,
  Zap,
} from "lucide-react";

const COLLAPSED_STORAGE_KEY = "segmiq-salesperson-composer-tools-collapsed";

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
  onTransfer,
  onTransferSupport,
  leadHref,
  dealHref,
  canCreateDeal = false,
  showLogCall = false,
  canTransfer = false,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_STORAGE_KEY) === "0") {
        setCollapsed(false);
      }
    } catch {
      /* ignore unavailable storage */
    }
    setHydrated(true);
  }, []);

  function setExpanded() {
    setCollapsed(false);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, "0");
    } catch {
      /* ignore unavailable storage */
    }
  }

  function handleToggleQuickActions() {
    if (collapsed) setExpanded();
    onToggleQuickActions?.();
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore unavailable storage */
      }
      return next;
    });
  }

  const title = variant === "support" ? "Support tools" : "Conversation tools";

  return (
    <div
      className={`wa-composer-toolbar ${collapsed ? "wa-composer-toolbar-collapsed" : ""}`}
      aria-label={title}
    >
      <div className="wa-composer-toolbar-head">
        <button
          type="button"
          className="wa-composer-toolbar-toggle"
          onClick={toggleCollapsed}
          aria-expanded={hydrated ? !collapsed : true}
          aria-controls="salesperson-composer-tools"
        >
          <span className="wa-composer-toolbar-title">{title}</span>
          <span className="wa-composer-toolbar-chevron" aria-hidden>
            {collapsed ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
          </span>
        </button>
        {collapsed ? (
          <span className="wa-composer-toolbar-hint">Tap to show actions</span>
        ) : null}
      </div>

      <div
        id="salesperson-composer-tools"
        className={`wa-composer-toolbar-panel ${collapsed ? "" : "wa-composer-toolbar-panel-open"}`}
        hidden={hydrated && collapsed}
      >
        <div className="wa-composer-toolbar-panel-inner">
          <div className="wa-composer-toolbar-scroll">
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
                    onClick={handleToggleQuickActions}
                    courseTarget="whatsapp-quick-replies"
                  />
                ) : null}
                {onOpenAssetDrawer ? (
                  <ComposerTool icon={Paperclip} label="Send asset" onClick={onOpenAssetDrawer} />
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
      </div>
    </div>
  );
}
