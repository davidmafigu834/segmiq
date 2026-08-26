import type { AgentDisclosure } from "@/lib/commercial/types";
import type { AvailabilityResult } from "@/lib/inventory/provider";

export function discloseAvailability(
  avail: AvailabilityResult,
  disclosure: AgentDisclosure
): Record<string, unknown> {
  if (disclosure === "HIDDEN") return {};
  if (!avail.trackInventory) return { availability: "not_tracked" };
  if (avail.stale) {
    return { availability: "unknown", note: "External inventory is stale; exact quantity is unavailable." };
  }
  if (disclosure === "GENERAL") {
    if (avail.status === "OUT_OF_STOCK") return { availability: "unavailable" };
    if (avail.status === "LOW_STOCK") return { availability: "limited" };
    return { availability: "in_stock" };
  }
  return {
    available: avail.available,
    status: avail.status,
    on_hand: avail.onHand,
  };
}
