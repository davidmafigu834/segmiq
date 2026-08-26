import type { AgentDisclosure, InventoryProviderKind, InventoryStockStatus } from "@/lib/commercial/types";

export type AvailabilityQuery = {
  clientId: string;
  productId: string;
  variantId?: string | null;
  locationId?: string | null;
};

export type AvailabilityResult = {
  productId: string;
  variantId: string | null;
  onHand: number;
  reserved: number;
  available: number;
  status: InventoryStockStatus;
  trackInventory: boolean;
  lastSyncedAt: string | null;
  stale: boolean;
  locations: Array<{
    locationId: string;
    name: string;
    onHand: number;
    reserved: number;
    available: number;
    reorderLevel: number | null;
  }>;
};

export interface InventoryProvider {
  kind: InventoryProviderKind;
  searchProducts?(query: string, clientId: string): Promise<unknown[]>;
  getProduct?(clientId: string, productId: string): Promise<unknown | null>;
  getAvailability(query: AvailabilityQuery): Promise<AvailabilityResult>;
  getLocationAvailability?(query: AvailabilityQuery): Promise<AvailabilityResult>;
  syncProducts?(): Promise<{ updated: number; failed: number }>;
  syncInventory?(): Promise<{ updated: number; failed: number }>;
  allowsMutations: boolean;
}

export type InventorySettings = {
  provider: InventoryProviderKind;
  allowNegativeStock: boolean;
  defaultLocationId: string | null;
  staleAfterMinutes: number;
  agentDisclosure: AgentDisclosure;
  warnInsufficientStock: boolean;
  blockInsufficientStock: boolean;
  lowStockNotifications: boolean;
  externalProviderName: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};
