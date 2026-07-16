"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useRef } from "react";

type Props = {
  onResize: (deltaX: number) => void;
  onToggleCollapse?: () => void;
  collapsed?: boolean;
  label?: string;
};

export function CrmSidebarResizeHandle({
  onResize,
  onToggleCollapse,
  collapsed = false,
  label = "Resize sidebar",
}: Props) {
  const draggingRef = useRef(false);

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.classList.remove("crm-sidebar-resizing");
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-collapse-toggle]")) return;
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("crm-sidebar-resizing");
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

  const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={collapsed ? collapseLabel : label}
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
          onResize(-8);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onResize(8);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleCollapse?.();
        }
      }}
      className={`crm-sidebar-resize-handle ${collapsed ? "crm-sidebar-resize-handle--collapsed" : ""}`}
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
          className="crm-sidebar-resize-toggle"
        >
          {collapsed ? (
            <ChevronRight size={14} strokeWidth={2} />
          ) : (
            <ChevronLeft size={13} strokeWidth={2.5} />
          )}
        </button>
      ) : null}
    </div>
  );
}
