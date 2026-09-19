"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  type UIEventHandler,
} from "react";
import { cn } from "@/lib/ui/cn";

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else (ref as { current: T | null }).current = value;
}

export function InboxScrollArea({
  children,
  className,
  contentClassName,
  viewportRef,
  onScroll,
  showRail = true,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
  onScroll?: UIEventHandler<HTMLDivElement>;
  showRail?: boolean;
}) {
  const viewportId = useId();
  const localRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const metricsRef = useRef({ top: 0, height: 48, track: 0, canScroll: false });
  const [metrics, setMetrics] = useState(metricsRef.current);

  const setViewport = useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node;
      assignRef(viewportRef, node);
    },
    [viewportRef]
  );

  const sync = useCallback(() => {
    const el = localRef.current;
    if (!el) return;
    const track = el.clientHeight;
    const scrollHeight = el.scrollHeight;
    const canScroll = scrollHeight > track + 1;
    const height = canScroll ? Math.max(40, (track / scrollHeight) * track) : Math.min(track, 40);
    const maxTop = Math.max(0, track - height);
    const maxScroll = Math.max(1, scrollHeight - track);
    const top = canScroll ? (el.scrollTop / maxScroll) * maxTop : 0;
    const next = { top, height, track, canScroll };
    metricsRef.current = next;
    setMetrics((prev) =>
      prev.top === next.top && prev.height === next.height && prev.track === next.track && prev.canScroll === next.canScroll
        ? prev
        : next
    );
  }, []);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    const mo = new MutationObserver(sync);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", sync);
      dragCleanupRef.current?.();
    };
  }, [sync, children]);

  function scrollByThumbDelta(startScroll: number, deltaY: number, trackH: number, thumbH: number) {
    const el = localRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const travel = Math.max(1, trackH - thumbH);
    el.scrollTop = Math.min(maxScroll, Math.max(0, startScroll + (deltaY * maxScroll) / travel));
  }

  function jumpToRailY(clientY: number, railTop: number, trackH: number, thumbH: number) {
    const el = localRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const travel = Math.max(1, trackH - thumbH);
    const y = clientY - railTop - thumbH / 2;
    el.scrollTop = Math.min(maxScroll, Math.max(0, (y / travel) * maxScroll));
  }

  function onRailPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const el = localRef.current;
    if (!el || e.button !== 0) return;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    if (maxScroll <= 0) return;

    e.preventDefault();
    e.stopPropagation();

    const rail = e.currentTarget;
    const rect = rail.getBoundingClientRect();
    const thumbH = Math.max(metricsRef.current.height, 40);
    const onThumb = !!(e.target as HTMLElement).closest("[data-inbox-thumb]");
    if (!onThumb) jumpToRailY(e.clientY, rect.top, rect.height, thumbH);

    const startY = e.clientY;
    const startScroll = el.scrollTop;
    const pointerId = e.pointerId;

    try {
      rail.setPointerCapture(pointerId);
    } catch {
      /* window listeners still drive the drag */
    }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      scrollByThumbDelta(startScroll, ev.clientY - startY, rect.height, thumbH);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      dragCleanupRef.current?.();
    };

    window.addEventListener("pointermove", onMove, { capture: true, passive: false });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
    dragCleanupRef.current = () => {
      window.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
      if (rail.hasPointerCapture?.(pointerId)) rail.releasePointerCapture(pointerId);
      dragCleanupRef.current = null;
    };
  }

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 overflow-hidden", className)}>
      <div
        id={viewportId}
        ref={setViewport}
        className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-scroll overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          sync();
          onScroll?.(e);
        }}
      >
        <div className={contentClassName}>{children}</div>
      </div>
      {showRail ? (
        <div
          role="scrollbar"
          aria-controls={viewportId}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, Math.round(Math.max(0, metrics.track - metrics.height)))}
          aria-valuenow={Math.round(metrics.top)}
          aria-disabled={!metrics.canScroll}
          className={cn(
            "relative z-[2] w-4 shrink-0 touch-none select-none border-l border-sales-border bg-sales-surface",
            metrics.canScroll ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          )}
          onPointerDown={onRailPointerDown}
        >
          <div
            data-inbox-thumb
            className={cn(
              "absolute left-1/2 w-2.5 -translate-x-1/2 rounded-full bg-sales-text-muted hover:bg-sales-text-secondary",
              metrics.canScroll ? "opacity-100" : "opacity-40"
            )}
            style={{ top: metrics.top, height: Math.max(metrics.height, 40) }}
          />
        </div>
      ) : null}
    </div>
  );
}
