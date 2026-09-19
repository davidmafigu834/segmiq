"use client";

import { type ReactNode, type Ref, type UIEventHandler } from "react";
import { cn } from "@/lib/ui/cn";

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
  return (
    <div
      ref={viewportRef}
      className={cn(
        "social-inbox-scroll h-0 min-h-0 flex-1 overflow-y-scroll overscroll-contain",
        contentClassName,
        className
      )}
      onScroll={onScroll}
    >
      {children}
    </div>
  );
}
