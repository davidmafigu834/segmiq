"use client";

import { ActivityTimeline } from "@/components/sales/activity/ActivityTimeline";

export function LeadTimeline({
  leadId,
  canCompose = true,
  canPin = true,
}: {
  leadId: string;
  canCompose?: boolean;
  canPin?: boolean;
}) {
  return <ActivityTimeline leadId={leadId} canCompose={canCompose} canPin={canPin} />;
}
