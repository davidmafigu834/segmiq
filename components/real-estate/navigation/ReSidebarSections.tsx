"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/ui/cn";

type Group<T> = { id: string; label: string; items: T[] };

const DEFAULT_COLLAPSED = ["more_tools", "system"];

function readCollapsed(storageKey: string): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is string => typeof v === "string")) : null;
  } catch {
    return null;
  }
}

/**
 * Which sidebar groups are collapsed. Persisted per shell; the group holding the
 * current page is reopened whenever the route moves into it.
 */
export function useReNavGroups(storageKey: string, activeGroupId: string | null) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(DEFAULT_COLLAPSED));

  useEffect(() => {
    const stored = readCollapsed(storageKey);
    if (stored) setCollapsed(stored);
  }, [storageKey]);

  const persist = useCallback(
    (next: Set<string>) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        /* storage unavailable: state still works for this visit */
      }
    },
    [storageKey]
  );

  useEffect(() => {
    if (!activeGroupId) return;
    setCollapsed((prev) => {
      if (!prev.has(activeGroupId)) return prev;
      const next = new Set(prev);
      next.delete(activeGroupId);
      persist(next);
      return next;
    });
  }, [activeGroupId, persist]);

  const toggle = useCallback(
    (id: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { isOpen: (id: string) => !collapsed.has(id), toggle };
}

/**
 * Real Estate sidebar body: an unlabelled main group, then labelled groups that
 * collapse. In icon-only mode every item stays reachable (with tooltips from the
 * item renderer) and groups are separated by a hairline instead of a label.
 */
export function ReSidebarSections<T extends { id: string }>({
  groups,
  isActive,
  renderItem,
  collapsedMode,
  storageKey,
  ariaLabel,
}: {
  groups: Group<T>[];
  isActive: (item: T) => boolean;
  renderItem: (item: T) => ReactNode;
  collapsedMode: boolean;
  storageKey: string;
  ariaLabel: string;
}) {
  const activeGroup = groups.find((g) => g.items.some(isActive))?.id ?? null;
  const { isOpen, toggle } = useReNavGroups(storageKey, activeGroup);

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-3" aria-label={ariaLabel}>
      {groups.map((group, index) => {
        if (group.items.length === 0) return null;
        const isMain = index === 0;
        const open = collapsedMode || isMain || isOpen(group.id);
        const panelId = `re-nav-${storageKey}-${group.id}`;
        const holdsActive = group.items.some(isActive);

        if (collapsedMode) {
          return (
            <div key={group.id} className={cn("px-2", index > 0 && "mt-2 border-t border-[var(--sales-sidebar-border)] pt-2")}>
              <span className="sr-only">{group.label}</span>
              <div className="flex flex-col items-center gap-1">{group.items.map(renderItem)}</div>
            </div>
          );
        }

        return (
          <div key={group.id} className={cn("px-3", index > 0 && "mt-3")}>
            {isMain ? (
              <span className="sr-only">{group.label}</span>
            ) : (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(group.id)}
                className="re-focus group mb-1 flex h-8 w-full items-center gap-1.5 rounded-[6px] px-3 text-left text-[11px] font-medium text-[var(--sales-sidebar-muted)] transition-colors hover:text-[var(--sales-sidebar-text-hover)]"
              >
                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                {!open && holdsActive ? (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sales-sidebar-icon-active)]" aria-hidden />
                ) : null}
                {!open && holdsActive ? <span className="sr-only">, contains the current page</span> : null}
                <ChevronDown
                  size={14}
                  strokeWidth={1.8}
                  aria-hidden
                  className={cn(
                    "shrink-0 transition-transform duration-150 motion-reduce:transition-none",
                    open ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>
            )}
            <div id={panelId} hidden={!open} className="flex flex-col gap-1">
              {group.items.map(renderItem)}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** Agency / agent identity under the wordmark so the workspace is never ambiguous. */
export function ReWorkspaceContext({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <div className="mx-3 mb-3 shrink-0 rounded-[10px] border border-[var(--sales-sidebar-border)] px-3 py-2">
      <p className="truncate text-[11px] font-medium text-[var(--sales-sidebar-muted)]">{secondary}</p>
      <p className="truncate text-[13px] font-semibold text-sales-text-primary">{primary}</p>
    </div>
  );
}
