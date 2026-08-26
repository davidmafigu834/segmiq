"use client";

import { useState } from "react";
import { CommercialModulePage } from "./CommercialModulePage";
import { Button, FieldLabel, Select, useSalesToast } from "@/components/sales/ui";
import type { UserRole } from "@/types";

export function CompanyProductsImportPage({
  clientId,
  chrome,
}: {
  clientId: string;
  chrome: Parameters<typeof CommercialModulePage>[0]["chrome"] & { notificationRole: UserRole };
}) {
  const { toast } = useSalesToast();
  const [file, setFile] = useState<File | null>(null);
  const [duplicateMode, setDuplicateMode] = useState("SKIP");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("duplicateMode", duplicateMode);
      if (dryRun) form.set("dryRun", "1");
      const res = await fetch(`/api/clients/${clientId}/products/import`, { method: "POST", body: form });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        toast({ title: String(json.error || "Import failed"), tone: "error" });
        return;
      }
      setResult(json);
      if (!dryRun) toast({ title: "Import complete", tone: "success" });
    } finally {
      setBusy(false);
    }
  }

  const summary = (result?.summary ?? null) as Record<string, number> | null;

  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="Company / Products / Import"
      title="Import"
      description="Upload CSV, preview, then import. Matching SKUs are not overwritten unless you choose Update."
    >
      <div className="mt-4 max-w-xl space-y-4">
        <input type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div>
          <FieldLabel>Duplicates</FieldLabel>
          <Select value={duplicateMode} onChange={(e) => setDuplicateMode(e.target.value)}>
            <option value="SKIP">Skip existing SKUs</option>
            <option value="UPDATE">Update existing SKUs</option>
            <option value="CREATE">Create new (block duplicate SKU)</option>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" disabled={!file || busy} onClick={() => void run(true)}>
            Preview
          </Button>
          <Button size="md" disabled={!file || busy} onClick={() => void run(false)}>
            Import
          </Button>
        </div>
        {summary ? (
          <div className="rounded-[10px] border border-sales-border p-4 text-[13px]">
            <div>{summary.total ?? 0} rows detected</div>
            <div>{summary.ready ?? summary.created ?? 0} ready / created</div>
            <div>{summary.updates ?? summary.updated ?? 0} updates</div>
            <div>{summary.warnings ?? 0} warnings</div>
            <div>{summary.errors ?? summary.failed ?? 0} errors</div>
          </div>
        ) : null}
      </div>
    </CommercialModulePage>
  );
}
