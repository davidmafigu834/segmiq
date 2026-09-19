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

const MIN_THUMB = 36;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else (ref as { current: T | null }).current = value;
}

/**
 * Scrollport with a rail that is always visible and can be dragged. Windows hides
 * native overlay scrollbars, so the panes draw their own instead of relying on them.
 */
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
  const localRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<(() => void) | null>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, scrollable: false });

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
    const maxScroll = el.scrollHeight - track;
    if (maxScroll <= 1 || track <= 0) {
      setThumb((prev) => (prev.scrollable || prev.height ? { top: 0, height: 0, scrollable: false } : prev));
      return;
    }
    const height = Math.max(MIN_THUMB, (track / el.scrollHeight) * track);
    const top = (el.scrollTop / maxScroll) * (track - height);
    setThumb((prev) =>
      prev.top === top && prev.height === height && prev.scrollable ? prev : { top, height, scrollable: true }
    );
  }, []);

  useEffect(() => {
    const el = localRef.current;
    if (!el) return;
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    const mutations = new MutationObserver(sync);
    mutations.observe(el, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", sync);
      dragRef.current?.();
    };
  }, [sync, children]);

  /** Position the thumb's top edge, in track pixels, and scroll to match. */
  function scrollToThumbTop(top: number, trackHeight: number, thumbHeight: number) {
    const el = localRef.current;
    if (!el) return;
    const travel = trackHeight - thumbHeight;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (travel <= 0 || maxScroll <= 0) return;
    el.scrollTop = (Math.min(travel, Math.max(0, top)) / travel) * maxScroll;
  }

  function onRailPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const el = localRef.current;
    if (!el || event.button !== 0 || el.scrollHeight - el.clientHeight <= 0) return;

    event.preventDefault();
    const rail = event.currentTarget;
    const rect = rail.getBoundingClientRect();
    const thumbHeight = Math.max(MIN_THUMB, (rect.height / el.scrollHeight) * rect.height);
    const grabbedThumb = (event.target as HTMLElement).closest("[data-inbox-thumb]") !== null;

    // Clicking the track jumps so the thumb centres on the pointer.
    let grabOffset = thumbHeight / 2;
    if (grabbedThumb) {
      grabOffset = event.clientY - (event.target as HTMLElement).getBoundingClientRect().top;
    } else {
      scrollToThumbTop(event.clientY - rect.top - grabOffset, rect.height, thumbHeight);
    }

    const pointerId = event.pointerId;
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      scrollToThumbTop(moveEvent.clientY - rect.top - grabOffset, rect.height, thumbHeight);
    };
    const onRelease = (upEvent: PointerEvent) => {
      if (upEvent.pointerId === pointerId) dragRef.current?.();
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    document.body.style.userSelect = "none";
    dragRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      document.body.style.userSelect = "";
      dragRef.current = null;
    };
  }

  return (
    <div className={cn("flex h-0 min-h-0 min-w-0 flex-1 overflow-hidden", className)}>
      <div
        ref={setViewport}
        className={cn("social-inbox-scroll min-h-0 min-w-0 flex-1", contentClassName)}
        onScroll={(event) => {
          sync();
          onScroll?.(event);
        }}
      >
        {children}
      </div>
      <div
        className="relative w-3 shrink-0 touch-none border-l border-sales-border bg-sales-surface-subtle"
        onPointerDown={onRailPointerDown}
      >
        {thumb.scrollable ? (
          <div
            data-inbox-thumb
            role="scrollbar"
            aria-orientation="vertical"
            className="absolute inset-x-[2px] cursor-grab rounded-full bg-sales-text-muted transition-colors hover:bg-sales-text-secondary active:cursor-grabbing active:bg-sales-text-primary"
            style={{ top: thumb.top, height: thumb.height }}
          />
        ) : null}
      </div>
    </div>
  );
}
