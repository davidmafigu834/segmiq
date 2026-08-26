import type { InventoryStockStatus } from "@/lib/commercial/types";

export function availableQty(onHand: number, reserved: number): number {
  return (Number(onHand) || 0) - (Number(reserved) || 0);
}

export function stockStatus(opts: {
  trackInventory: boolean;
  available: number;
  reorderLevel?: number | null;
}): InventoryStockStatus {
  if (!opts.trackInventory) return "NOT_TRACKED";
  if (opts.available <= 0) return "OUT_OF_STOCK";
  if (opts.reorderLevel != null && Number.isFinite(opts.reorderLevel) && opts.available <= opts.reorderLevel) {
    return "LOW_STOCK";
  }
  return "IN_STOCK";
}

export function crossedLowStock(prevAvailable: number, nextAvailable: number, reorderLevel: number | null | undefined): boolean {
  if (reorderLevel == null || !Number.isFinite(reorderLevel)) return false;
  return prevAvailable > reorderLevel && nextAvailable <= reorderLevel;
}

export function crossedOutOfStock(prevAvailable: number, nextAvailable: number): boolean {
  return prevAvailable > 0 && nextAvailable <= 0;
}

export function canTransfer(available: number, qty: number, allowNegative: boolean): boolean {
  if (qty <= 0) return false;
  if (allowNegative) return true;
  return available + 1e-9 >= qty;
}
