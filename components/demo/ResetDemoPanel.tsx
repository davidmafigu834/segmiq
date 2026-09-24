"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/sales/ui/ConfirmDialog";
import { useSalesToast } from "@/components/sales/ui/Toast";

type DemoStatus = {
  demo: boolean;
  name: string | null;
  canReset: boolean;
};

export function ResetDemoPanel() {
  const { toast } = useSalesToast();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: DemoStatus | null) => {
        if (!cancelled) setStatus(body);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.demo || !status.canReset) return null;

  const name = status.name ?? "this demo";

  async function reset() {
    setLoading(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (!res.ok) {
        toast({ tone: "error", title: "Demo could not be restored" });
        return;
      }
      toast({ tone: "success", title: "Demo workspace restored." });
      setOpen(false);
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[12px] border border-sales-border bg-sales-surface p-4">
      <h2 className="text-sm font-semibold text-sales-text-primary">Demo workspace</h2>
      <p className="mt-1 text-sm text-sales-text-secondary">
        Restore {name} to the canonical demonstration dataset. Changes made during this session are discarded.
      </p>
      <button
        type="button"
        className="mt-3 rounded-lg border border-sales-border px-3 py-2 text-sm font-medium text-sales-text-primary"
        onClick={() => setOpen(true)}
      >
        Reset Demo
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Reset ${name} demo?`}
        description="All changes made during this demo session will be discarded."
        confirmLabel="Reset Demo"
        cancelLabel="Cancel"
        destructive
        loading={loading}
        onConfirm={reset}
      />
    </section>
  );
}
