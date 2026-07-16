"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useRef } from "react";

type Props = {
  onResize: (deltaX: number) => void;
  onToggleCollapse?: () => void;
  collapsed?: boolean;
  /** Which side panel this handle controls. */
  panel: "list" | "intel";
  label?: string;
};

export function InboxPanelResizeHandle({
  onResize,
  onToggleCollapse,
  collapsed = false,
  panel,
  label = "Resize panel",
}: Props) {
  const draggingRef = useRef(false);

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.classList.remove("inbox-panel-resizing");
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-collapse-toggle]")) return;
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("inbox-panel-resizing");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      if (event.movementX !== 0) onResize(event.movementX);
    },
    [onResize]
  );

  const ExpandIcon = panel === "list" ? ChevronRight : ChevronLeft;
  const CollapseIcon = panel === "list" ? ChevronLeft : ChevronRight;
  const collapseLabel =
    panel === "list"
      ? collapsed
        ? "Expand conversations panel"
        : "Collapse conversations panel"
      : collapsed
        ? "Expand lead workspace panel"
        : "Collapse lead workspace panel";

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={collapsed ? collapseLabel : label}
      aria-valuenow={collapsed ? 0 : undefined}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={(event) => {
        event.preventDefault();
        onToggleCollapse?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onResize(panel === "list" ? -8 : 8);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onResize(panel === "list" ? 8 : -8);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleCollapse?.();
        }
      }}
      className={`inbox-panel-resize-handle hidden min-[1181px]:flex ${
        collapsed ? "inbox-panel-resize-handle--collapsed" : ""
      } ${panel === "list" ? "inbox-panel-resize-handle--list" : "inbox-panel-resize-handle--intel"}`}
    >
      {onToggleCollapse ? (
        <button
          type="button"
          data-collapse-toggle
          aria-label={collapseLabel}
          title={collapseLabel}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse();
          }}
          className="inbox-panel-resize-toggle"
        >
          {collapsed ? (
            <ExpandIcon size={14} strokeWidth={2} />
          ) : (
            <CollapseIcon size={13} strokeWidth={2.5} />
          )}
        </button>
      ) : null}
    </div>
  );
}
