"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Headphones,
  MoreHorizontal,
  Paperclip,
  Phone,
  StickyNote,
  UserRound,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

const COLLAPSED_STORAGE_KEY = "segmiq-manager-composer-tools-collapsed";

type ToolProps = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  accent?: boolean;
  onClick?: () => void;
  href?: string;
};

function ComposerTool({ icon: Icon, label, active, accent, onClick, href }: ToolProps) {
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
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-pressed={active}>
      {content}
    </button>
  );
}

type Props = {
  canSend: boolean;
  alsoSells: boolean;
  quickActionsOpen?: boolean;
  onToggleQuickActions?: () => void;
  onOpenAssetDrawer?: () => void;
  onInternalNote: () => void;
  onLogCall?: () => void;
  onTransfer?: () => void;
  onTransferSupport?: () => void;
  onMore?: () => void;
  leadHref?: string;
  dealHref?: string;
  canCreateDeal?: boolean;
  onOpenCreateDeal?: () => void;
  showLogCall?: boolean;
  isSupport?: boolean;
};

export function ManagerComposerToolbar({
  canSend,
  alsoSells,
  quickActionsOpen = false,
  onToggleQuickActions,
  onOpenAssetDrawer,
  onInternalNote,
  onLogCall,
  onTransfer,
  onTransferSupport,
  onMore,
  leadHref,
  dealHref,
  canCreateDeal = false,
  onOpenCreateDeal,
  showLogCall = false,
  isSupport = false,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const sellingActions = alsoSells && canSend;

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_STORAGE_KEY) === "0") {
        setCollapsed(false);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className={`wa-composer-toolbar ${collapsed ? "wa-composer-toolbar-collapsed" : ""}`}>
      <div className="wa-composer-toolbar-head">
        <button
          type="button"
          className="wa-composer-toolbar-toggle"
          onClick={toggleCollapsed}
          aria-expanded={hydrated ? !collapsed : true}
        >
          <span className="wa-composer-toolbar-title">Conversation tools</span>
          <span className="wa-composer-toolbar-chevron" aria-hidden>
            {collapsed ? <ChevronUp size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
          </span>
        </button>
      </div>
      <div className={`wa-composer-toolbar-panel ${collapsed ? "" : "wa-composer-toolbar-panel-open"}`} hidden={hydrated && collapsed}>
        <div className="wa-composer-toolbar-panel-inner">
          <div className="wa-composer-toolbar-scroll">
            {sellingActions && onToggleQuickActions ? (
              <ComposerTool icon={Zap} label="Quick replies" active={quickActionsOpen} onClick={onToggleQuickActions} />
            ) : null}
            {sellingActions && onOpenAssetDrawer ? (
              <ComposerTool icon={Paperclip} label="Send asset" onClick={onOpenAssetDrawer} />
            ) : null}
            <ComposerTool icon={StickyNote} label="Internal note" onClick={onInternalNote} />
            {sellingActions && showLogCall && onLogCall ? (
              <ComposerTool icon={Phone} label="Log call" onClick={onLogCall} />
            ) : null}
            {leadHref ? <ComposerTool icon={UserRound} label="View Lead" href={leadHref} /> : null}
            {dealHref ? (
              <ComposerTool icon={BriefcaseBusiness} label="View Deal" href={dealHref} accent />
            ) : canCreateDeal && onOpenCreateDeal ? (
              <ComposerTool icon={BriefcaseBusiness} label="Create Deal" accent onClick={onOpenCreateDeal} />
            ) : null}
            {onTransfer ? (
              <ComposerTool icon={Headphones} label="Transfer" onClick={onTransfer} />
            ) : null}
            {!isSupport && onTransferSupport ? (
              <ComposerTool icon={Headphones} label="To Support" onClick={onTransferSupport} />
            ) : null}
            {onMore ? <ComposerTool icon={MoreHorizontal} label="More" onClick={onMore} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
