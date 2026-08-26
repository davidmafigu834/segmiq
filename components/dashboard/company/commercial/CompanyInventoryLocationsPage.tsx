"use client";

import { useEffect, useState } from "react";
import { CommercialModulePage } from "./CommercialModulePage";
import { Button, FieldLabel, Input, Select, useSalesToast } from "@/components/sales/ui";
import type { UserRole } from "@/types";

type Loc = { id: string; name: string; location_type: string; is_default: boolean; status: string };

export function CompanyInventoryLocationsPage({
  clientId,
  chrome,
}: {
  clientId: string;
  chrome: Parameters<typeof CommercialModulePage>[0]["chrome"] & { notificationRole: UserRole };
}) {
  const { toast } = useSalesToast();
  const [locations, setLocations] = useState<Loc[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("WAREHOUSE");

  async function reload() {
    const res = await fetch(`/api/clients/${clientId}/inventory`);
    const json = (await res.json()) as { locations?: Loc[] };
    setLocations(json.locations ?? []);
  }
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function create() {
    const res = await fetch(`/api/clients/${clientId}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, location_type: type, is_default: locations.length === 0 }),
    });
    if (!res.ok) {
      toast({ title: "Could not create location", tone: "error" });
      return;
    }
    setName("");
    await reload();
  }

  return (
    <CommercialModulePage chrome={chrome} breadcrumb="Company / Inventory / Locations" title="Locations" description="Warehouses, stores and branches where stock is held.">
      <div className="mt-4 flex max-w-xl flex-wrap gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Location name" />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="WAREHOUSE">Warehouse</option>
          <option value="STORE">Store</option>
          <option value="BRANCH">Branch</option>
          <option value="OTHER">Other</option>
        </Select>
        <Button size="md" onClick={() => void create()} disabled={!name.trim()}>
          Add location
        </Button>
      </div>
      <div className="mt-4 max-w-xl space-y-2">
        {locations.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-[8px] border border-sales-border px-3 py-2 text-[13px]">
            <span>
              {l.name}
              {l.is_default ? <span className="ml-2 text-sales-text-muted">Default</span> : null}
            </span>
            <span className="text-sales-text-muted">{l.location_type}</span>
          </div>
        ))}
      </div>
    </CommercialModulePage>
  );
}

export function CompanyInventoryMovementsPage({
  clientId,
  chrome,
}: {
  clientId: string;
  chrome: Parameters<typeof CommercialModulePage>[0]["chrome"] & { notificationRole: UserRole };
}) {
  const { toast } = useSalesToast();
  const [movements, setMovements] = useState<Array<Record<string, unknown>>>([]);
  const [adjust, setAdjust] = useState({ productId: "", locationId: "", delta: "", reason: "New delivery", note: "" });
  const [transfer, setTransfer] = useState({ productId: "", fromLocationId: "", toLocationId: "", quantity: "" });
  const [locations, setLocations] = useState<Loc[]>([]);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/inventory/movements`)
      .then((r) => r.json())
      .then((j: { movements?: Array<Record<string, unknown>> }) => setMovements(j.movements ?? []));
    fetch(`/api/clients/${clientId}/inventory`)
      .then((r) => r.json())
      .then((j: { locations?: Loc[] }) => setLocations(j.locations ?? []));
  }, [clientId]);

  async function submitAdjust() {
    const res = await fetch(`/api/clients/${clientId}/inventory/movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "adjust",
        productId: adjust.productId,
        locationId: adjust.locationId,
        delta: Number(adjust.delta),
        reason: adjust.reason,
        note: adjust.note,
      }),
    });
    const json = (await res.json()) as { error?: string; onHand?: number };
    if (!res.ok) {
      toast({ title: json.error || "Adjustment failed", tone: "error" });
      return;
    }
    toast({ title: `On hand is now ${json.onHand}`, tone: "success" });
  }

  async function submitTransfer() {
    const res = await fetch(`/api/clients/${clientId}/inventory/movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transfer",
        productId: transfer.productId,
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        quantity: Number(transfer.quantity),
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast({ title: json.error || "Transfer failed", tone: "error" });
      return;
    }
    toast({ title: "Transfer recorded", tone: "success" });
  }

  return (
    <CommercialModulePage chrome={chrome} breadcrumb="Company / Inventory / Movements" title="Stock movements" description="Every on-hand change is recorded.">
      <div className="mt-4 grid max-w-xl gap-3 rounded-[10px] border border-sales-border p-4">
        <h2 className="text-[14px] font-semibold">Adjust stock</h2>
        <div>
          <FieldLabel>Product ID</FieldLabel>
          <Input value={adjust.productId} onChange={(e) => setAdjust((a) => ({ ...a, productId: e.target.value }))} />
        </div>
        <div>
          <FieldLabel>Location</FieldLabel>
          <Select value={adjust.locationId} onChange={(e) => setAdjust((a) => ({ ...a, locationId: e.target.value }))}>
            <option value="">Select</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Adjustment</FieldLabel>
          <Input value={adjust.delta} onChange={(e) => setAdjust((a) => ({ ...a, delta: e.target.value }))} placeholder="+60" />
        </div>
        <div>
          <FieldLabel>Reason</FieldLabel>
          <Select value={adjust.reason} onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))}>
            <option>New delivery</option>
            <option>Physical stock count</option>
            <option>Damaged stock</option>
            <option>Returned stock</option>
            <option>Correction</option>
            <option>Other</option>
          </Select>
        </div>
        {adjust.reason === "Other" ? (
          <Input value={adjust.note} onChange={(e) => setAdjust((a) => ({ ...a, note: e.target.value }))} placeholder="Note required" />
        ) : null}
        <Button size="md" onClick={() => void submitAdjust()}>
          Confirm adjustment
        </Button>
      </div>
      <div className="mt-4 grid max-w-xl gap-3 rounded-[10px] border border-sales-border p-4">
        <h2 className="text-[14px] font-semibold">Transfer</h2>
        <Input value={transfer.productId} onChange={(e) => setTransfer((t) => ({ ...t, productId: e.target.value }))} placeholder="Product ID" />
        <Select value={transfer.fromLocationId} onChange={(e) => setTransfer((t) => ({ ...t, fromLocationId: e.target.value }))}>
          <option value="">From</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select value={transfer.toLocationId} onChange={(e) => setTransfer((t) => ({ ...t, toLocationId: e.target.value }))}>
          <option value="">To</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Input value={transfer.quantity} onChange={(e) => setTransfer((t) => ({ ...t, quantity: e.target.value }))} placeholder="Quantity" />
        <Button size="md" variant="secondary" onClick={() => void submitTransfer()}>
          Transfer stock
        </Button>
      </div>
      <div className="mt-6 overflow-x-auto text-[13px]">
        <table className="w-full min-w-[640px] text-left">
          <thead className="text-[11px] uppercase text-sales-text-muted">
            <tr>
              <th className="py-2">Time</th>
              <th>Movement</th>
              <th className="text-right">Qty</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={String(m.id)} className="border-t border-sales-border">
                <td className="py-2">{String(m.occurred_at ?? "").slice(0, 16)}</td>
                <td>{String(m.movement_type)}</td>
                <td className="text-right tabular-nums">{String(m.quantity)}</td>
                <td>{String(m.reason ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CommercialModulePage>
  );
}
