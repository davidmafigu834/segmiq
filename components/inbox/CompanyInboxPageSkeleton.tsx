"use client";

import { CompanyPageSkeletonShell } from "@/components/dashboard/company/skeletons/CompanySkeletonPrimitives";
import { InboxSkeleton } from "./InboxSkeleton";

export function CompanyInboxPageSkeleton() {
  return (
    <CompanyPageSkeletonShell
      label="Loading WhatsApp Sales Hub"
      immersive
      preferCollapsedSidebar
    >
      <InboxSkeleton />
    </CompanyPageSkeletonShell>
  );
}
