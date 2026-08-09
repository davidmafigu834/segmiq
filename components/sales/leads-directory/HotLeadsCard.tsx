"use client";

import { Flame } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/sales/ui";
import { formatLeadName, formatLeadScore } from "@/lib/sales/leads-directory";
import type { LeadDirectoryRow } from "@/lib/sales/leads-directory";

export function HotLeadsCard({
  leads,
  loading,
  onOpen,
  onViewAll,
}: {
  leads: LeadDirectoryRow[];
  loading?: boolean;
  onOpen: (id: string) => void;
  onViewAll: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b-0 px-5 pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-[14px] font-semibold">
          <Flame size={16} strokeWidth={1.8} className="text-[#EF4444]" aria-hidden />
          Hot leads
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-1">
        {loading ? (
          <div className="space-y-3 px-5 pb-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              size="compact"
              title="No hot leads right now"
              description="High-intent leads will appear here as SegmiQ scores new enquiries."
            />
          </div>
        ) : (
          <ul className="divide-y divide-sales-border-subtle">
            {leads.map((lead) => (
              <li key={lead.id}>
                <button
                  type="button"
                  onClick={() => onOpen(lead.id)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-sales-surface-hover"
                >
                  <Avatar name={formatLeadName(lead.name)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-sales-text-primary">
                      {formatLeadName(lead.name)}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-sales-text-muted">
                      {[lead.company, lead.contextLine].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14px] font-semibold tabular-nums text-sales-text-primary">
                      {formatLeadScore(lead.score)}
                    </p>
                    <Badge tone="danger" appearance="soft" className="mt-0.5">
                      Hot
                    </Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {leads.length > 0 ? (
        <CardFooter className="border-t border-sales-border-subtle px-5 py-3">
          <Button variant="link" size="sm" className="h-auto p-0 text-[12px]" onClick={onViewAll}>
            View all hot leads
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
