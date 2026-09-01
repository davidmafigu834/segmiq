import { format, isSameDay, parseISO, subDays } from "date-fns";
import type { ActivityDateGroup, ActivityTimelineItem } from "./types";

export function formatActivityGroupLabel(isoDate: string, now = new Date()): string {
  const d = parseISO(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  const datePart = format(d, "d MMM yyyy");
  if (isSameDay(d, now)) return `Today · ${datePart}`;
  if (isSameDay(d, subDays(now, 1))) return `Yesterday · ${datePart}`;
  return datePart;
}

export function groupActivitiesByDay(
  items: ActivityTimelineItem[],
  now = new Date()
): ActivityDateGroup[] {
  const map = new Map<string, ActivityTimelineItem[]>();

  for (const item of items) {
    const dayKey = format(parseISO(item.occurredAt), "yyyy-MM-dd");
    const bucket = map.get(dayKey) ?? [];
    bucket.push(item);
    map.set(dayKey, bucket);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([dayKey, groupItems]) => ({
      key: dayKey,
      label: formatActivityGroupLabel(`${dayKey}T12:00:00.000Z`, now),
      count: groupItems.length,
      items: groupItems,
    }));
}
