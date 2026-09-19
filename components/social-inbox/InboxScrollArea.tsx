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
    <div className={cn("relative h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden", className)}>
      <div
        ref={viewportRef}
        className="social-inbox-scroll absolute inset-0 overflow-x-hidden overflow-y-scroll overscroll-contain"
        onScroll={onScroll}
      >
        <div className={contentClassName}>{children}</div>
      </div>
    </div>
  );
}
