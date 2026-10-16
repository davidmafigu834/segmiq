"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { useState, type ReactNode } from "react";
import { ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/sales/ui/DropdownMenu";
import { salesMenuTriggerClass } from "@/components/sales/ui/Button";
import { cn } from "@/lib/ui/cn";
import { ReSheet } from "./ReSheet";
import { RE_MOBILE_QUERY, useMediaQuery } from "./primitives";

export type ReAction = {
  id: string;
  label: string;
  /** One line under the label in the mobile sheet. */
  description?: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

function SheetActionList({ actions, onPick }: { actions: ReAction[]; onPick: (action: ReAction) => void }) {
  return (
    <ul className="-mx-2 space-y-0.5">
      {actions.map((action) => (
        <li key={action.id}>
          <button
            type="button"
            disabled={action.disabled}
            onClick={() => onPick(action)}
            className={cn(
              "re-focus flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              action.destructive ? "text-sales-danger hover:bg-sales-danger-soft" : "text-sales-text-primary hover:bg-sales-surface-hover"
            )}
          >
            {action.icon ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-sales-surface-subtle text-sales-text-secondary [&_svg]:size-[18px]" aria-hidden>
                {action.icon}
              </span>
            ) : null}
            <span className="min-w-0">
              <span className="block text-[14px] font-medium">{action.label}</span>
              {action.description ? (
                <span className="mt-0.5 block text-[12px] leading-snug text-sales-text-secondary">{action.description}</span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Three-dot overflow menu. Desktop: anchored dropdown (portalled, so it never
 * clips inside cards). Mobile: bottom sheet. Clicks never reach a parent row.
 */
export function ReActionMenu({
  actions,
  label,
  sheetTitle,
}: {
  actions: ReAction[];
  /** Accessible name, e.g. "More actions for Jane Moyo". */
  label: string;
  sheetTitle?: string;
}) {
  const mobile = useMediaQuery(RE_MOBILE_QUERY);
  const [sheetOpen, setSheetOpen] = useState(false);
  if (actions.length === 0) return null;

  const triggerClass =
    "re-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--re-radius-control,8px)] text-sales-text-secondary transition-colors hover:bg-sales-surface-hover hover:text-sales-text-primary sm:h-9 sm:w-9";

  if (mobile) {
    return (
      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
        <button
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className={triggerClass}
          onClick={() => setSheetOpen(true)}
        >
          <MoreHorizontal size={18} strokeWidth={1.8} aria-hidden />
        </button>
        {sheetOpen ? (
          <ReSheet title={sheetTitle ?? "Actions"} placement="bottom" onClose={() => setSheetOpen(false)}>
            <SheetActionList
              actions={actions}
              onPick={(action) => {
                setSheetOpen(false);
                action.onSelect();
              }}
            />
          </ReSheet>
        ) : null}
      </span>
    );
  }

  const regular = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex">
      <DropdownMenu align="end">
        <DropdownMenuTrigger aria-label={label} className={triggerClass}>
          <MoreHorizontal size={18} strokeWidth={1.8} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[200px]">
          {regular.map((action) => (
            <DropdownMenuItem key={action.id} icon={action.icon} disabled={action.disabled} onSelect={action.onSelect}>
              {action.label}
            </DropdownMenuItem>
          ))}
          {destructive.length > 0 && regular.length > 0 ? <DropdownMenuSeparator /> : null}
          {destructive.map((action) => (
            <DropdownMenuItem key={action.id} icon={action.icon} disabled={action.disabled} destructive onSelect={action.onSelect}>
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

/**
 * Page-level create actions: one lime primary plus a grouped "More" menu on
 * wider screens; a single "New" button opening a sheet on phones.
 */
export function ReQuickActions({
  primary,
  secondary,
  sheetTitle = "Create or log",
}: {
  primary: ReAction;
  secondary: ReAction[];
  sheetTitle?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const all = [primary, ...secondary];

  return (
    <>
      <div className="hidden items-center gap-2 sm:flex">
        <button
          type="button"
          onClick={primary.onSelect}
          disabled={primary.disabled}
          className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11 sm:h-10")}
        >
          {primary.icon ? <span className="inline-flex shrink-0" aria-hidden>{primary.icon}</span> : null}
          {primary.label}
        </button>
        {secondary.length > 0 ? (
          <DropdownMenu align="end">
            <DropdownMenuTrigger className={cn(salesMenuTriggerClass({ variant: "secondary", size: "md" }), "min-h-11 sm:h-10")}>
              More actions
              <ChevronDown size={14} strokeWidth={1.8} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[220px]">
              {secondary.map((action) => (
                <DropdownMenuItem key={action.id} icon={action.icon} disabled={action.disabled} onSelect={action.onSelect}>
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        className={cn(salesMenuTriggerClass({ variant: "primary", size: "md" }), "min-h-11 sm:hidden")}
      >
        <Plus size={16} strokeWidth={2} aria-hidden />
        New
      </button>
      {sheetOpen ? (
        <ReSheet title={sheetTitle} placement="bottom" onClose={() => setSheetOpen(false)}>
          <SheetActionList
            actions={all}
            onPick={(action) => {
              setSheetOpen(false);
              action.onSelect();
            }}
          />
        </ReSheet>
      ) : null}
    </>
  );
}
