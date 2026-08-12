"use client";

import type { ReactNode } from "react";
import { GuidedCourseProvider } from "./GuidedCourseProvider";

/** Mount guided learning once per sales chrome tree. */
export function GuidedCourseMount({
  children,
  isSolo = false,
}: {
  children: ReactNode;
  isSolo?: boolean;
}) {
  return (
    <GuidedCourseProvider isExistingUser={false} capabilities={{ whatsapp: true, goals: true, quotes: true }}>
      {/* isSolo reserved for future route rewriting in course steps */}
      <span className="hidden" data-sales-mode={isSolo ? "solo" : "team"} aria-hidden />
      {children}
    </GuidedCourseProvider>
  );
}
