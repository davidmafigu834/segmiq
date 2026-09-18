"use client";

import { format } from "date-fns";
import {
  CircleCheck,
  CircleX,
  Clock3,
  Eye,
  FileText,
  Send,
} from "lucide-react";
import {
  ActivityRow,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@/components/sales/ui";
import type { QuoteActivityItem } from "@/lib/sales/quotes";

function activityIcon(type: QuoteActivityItem["type"]) {
  const props = { size: 14, strokeWidth: 1.8 as const };
  switch (type) {
    case "accepted":
      return <CircleCheck {...props} className="text-sales-success-fg" />;
    case "declined":
      return <CircleX {...props} className="text-sales-danger" />;
    case "viewed":
      return <Eye {...props} className="text-sales-text-secondary" />;
    case "sent":
      return <Send {...props} className="text-sales-text-secondary" />;
    case "expired":
      return <Clock3 {...props} className="text-sales-warning-fg" />;
    default:
      return <FileText {...props} className="text-sales-text-muted" />;
  }
}

function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${format(d, "d MMM, yyyy")} · ${format(d, "h:mm a")}`;
}

export function QuoteActivityCard({
  items,
  loading,
  onOpen,
}: {
  items: QuoteActivityItem[];
  loading?: boolean;
  onOpen: (item: QuoteActivityItem) => void;
}) {
  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="border-b-0 px-5 pb-2 pt-4">
        <CardTitle className="text-[14px] font-semibold">Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-1">
        {loading ? (
          <div className="space-y-3 px-5 pb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-sales-sm" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              size="compact"
              title="No quote activity yet"
              description="Sends, views and responses will show up here."
            />
          </div>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" className="block w-full text-left" onClick={() => onOpen(item)}>
                  <ActivityRow
                    icon={activityIcon(item.type)}
                    title={item.title}
                    detail={item.detail}
                    timeLabel={formatActivityTime(item.at)}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {items.length > 0 ? (
        <CardFooter className="border-t border-sales-border-subtle px-5 py-3">
          <p className="text-[12px] text-sales-text-muted">Latest quotation events</p>
        </CardFooter>
      ) : null}
    </Card>
  );
}
