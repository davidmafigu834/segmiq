"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Zap } from "lucide-react";
import { SalesThemeToggle } from "@/components/sales/navigation/SalesThemeToggle";
import { ReSheet } from "@/components/real-estate/ui/ReSheet";
import { cn } from "@/lib/ui/cn";

export type ReMenuItem = {
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
  active: boolean;
  badge?: number;
  courseTarget?: string;
};

export type ReMenuGroup = { id: string; label: string; items: ReMenuItem[] };

const START_COLLAPSED = new Set(["more_tools"]);

/**
 * Full-height Real Estate menu for phones. Same groups as the desktop sidebar;
 * the group holding the current page starts open and the current page is marked.
 */
export function ReMobileMenuSheet({
  groups,
  onClose,
  onQuickActions,
  description,
}: {
  groups: ReMenuGroup[];
  onClose: () => void;
  onQuickActions?: () => void;
  description?: string;
}) {
  const visible = groups.filter((g) => g.items.length > 0);
  const [open, setOpen] = useState<Set<string>>(
    () =>
      new Set(
        visible
          .filter((g) => !START_COLLAPSED.has(g.id) || g.items.some((i) => i.active))
          .map((g) => g.id)
      )
  );

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ReSheet title="Menu" description={description} onClose={onClose} placement="drawer" bodyClassName="px-3 py-3">
      {onQuickActions ? (
        <button
          type="button"
          onClick={() => {
            onClose();
            onQuickActions();
          }}
          className="re-focus mb-3 flex min-h-12 w-full items-center gap-3 rounded-[10px] border border-sales-border px-3 text-left text-[14px] font-semibold text-sales-text-primary hover:bg-sales-surface-hover"
        >
          <Zap size={18} strokeWidth={1.8} className="text-sales-text-secondary" aria-hidden />
          Quick actions
        </button>
      ) : null}

      <div className="space-y-1">
        {visible.map((group) => {
          const isOpen = open.has(group.id);
          const panelId = `re-menu-${group.id}`;
          const holdsActive = group.items.some((i) => i.active);
          return (
            <section key={group.id}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(group.id)}
                className="re-focus flex min-h-11 w-full items-center gap-2 rounded-[8px] px-3 text-left text-[13px] font-semibold text-sales-text-secondary hover:text-sales-text-primary"
              >
                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                {!isOpen && holdsActive ? (
                  <>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sales-sidebar-icon-active)]" aria-hidden />
                    <span className="sr-only">, contains the current page</span>
                  </>
                ) : null}
                <ChevronDown
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden
                  className={cn("shrink-0 transition-transform duration-150 motion-reduce:transition-none", isOpen ? "rotate-0" : "-rotate-90")}
                />
              </button>
              <ul id={panelId} hidden={!isOpen} className="mb-2 space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={item.active ? "page" : undefined}
                      data-course-target={item.courseTarget}
                      className={cn(
                        "re-focus flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-[15px] transition-colors",
                        item.active
                          ? "bg-[var(--sales-sidebar-active)] font-semibold text-sales-text-primary"
                          : "font-medium text-sales-text-primary hover:bg-sales-surface-hover"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex shrink-0 [&_svg]:size-[18px]",
                          item.active ? "text-[var(--sales-sidebar-icon-active)]" : "text-sales-text-secondary"
                        )}
                        aria-hidden
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sales-sm bg-[var(--sales-sidebar-badge-bg)] px-1.5 text-[11px] font-semibold tabular-nums text-[var(--sales-sidebar-badge-text)]">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="mt-3 flex min-h-12 items-center justify-between gap-3 border-t border-sales-border-subtle px-3 pt-3">
        <span className="text-[14px] font-medium text-sales-text-primary">Appearance</span>
        <SalesThemeToggle size="mobile" />
      </div>
    </ReSheet>
  );
}
