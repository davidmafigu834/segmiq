"use client";

import {
  useCallback,
  useEffect,
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
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  viewportRef?: Ref<HTMLDivElement>;
  onScroll?: UIEventHandler<HTMLDivElement>;
}) {
  const localRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef({ top: 0, height: 48, track: 0, canScroll: false });
  const dragRef = useRef<{ pointerId: number; startY: number; startTop: number } | null>(null);
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
    const height = canScroll ? Math.max(36, (track / scrollHeight) * track) : Math.max(track, 0);
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
    };
  }, [sync, children]);

  function clampedThumbTop(nextTop: number) {
    const { height, track } = metricsRef.current;
    const maxTop = Math.max(0, track - height);
    return Math.min(maxTop, Math.max(0, nextTop));
  }

  function scrollToThumbTop(nextTop: number) {
    const el = localRef.current;
    if (!el) return 0;
    const clamped = clampedThumbTop(nextTop);
    const { height, track } = metricsRef.current;
    const maxTop = Math.max(0, track - height);
    const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
    el.scrollTop = maxTop > 0 ? (clamped / maxTop) * maxScroll : 0;
    return clamped;
  }

  function onRailPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const onThumb = !!(e.target as HTMLElement).closest("[data-inbox-thumb]");
    const startTop = onThumb
      ? metricsRef.current.top
      : scrollToThumbTop(e.clientY - rect.top - metricsRef.current.height / 2);
    dragRef.current = { pointerId: e.pointerId, startY: e.clientY, startTop };
  }

  function onRailPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    scrollToThumbTop(drag.startTop + (e.clientY - drag.startY));
  }

  function onRailPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }

  return (
    <div className={cn("relative h-0 min-h-0 min-w-0 flex-1 overflow-hidden", className)}>
      <div
        ref={setViewport}
        className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain pr-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          sync();
          onScroll?.(e);
        }}
      >
        <div className={contentClassName}>{children}</div>
      </div>
      <div
        role="scrollbar"
        aria-orientation="vertical"
        aria-valuenow={Math.round(metrics.top)}
        aria-disabled={!metrics.canScroll}
        className="absolute inset-y-0 right-0 z-[2] w-4 touch-none select-none border-l border-sales-border bg-[color-mix(in_srgb,var(--sales-text-primary)_10%,var(--sales-surface))]"
        onPointerDown={onRailPointerDown}
        onPointerMove={onRailPointerMove}
        onPointerUp={onRailPointerUp}
        onPointerCancel={onRailPointerUp}
      >
        <div
          data-inbox-thumb
          className="absolute inset-x-[3px] rounded-full bg-[color-mix(in_srgb,var(--sales-text-primary)_42%,transparent)] hover:bg-[color-mix(in_srgb,var(--sales-text-primary)_58%,transparent)] active:bg-[color-mix(in_srgb,var(--sales-text-primary)_68%,transparent)]"
          style={{ top: metrics.top, height: Math.max(metrics.height, 36), cursor: metrics.canScroll ? "grab" : "default" }}
        />
      </div>
    </div>
  );
}
