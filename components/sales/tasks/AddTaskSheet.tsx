"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Search } from "lucide-react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button } from "@/components/sales/ui/Button";
import { FieldLabel, Input, Select } from "@/components/sales/ui/Input";
import { useSalesToast } from "@/components/sales/ui/Toast";
import { toDateKey } from "@/lib/sales/calendar/format";

type LeadOption = {
  id: string;
  name: string;
  phone: string | null;
  source: string | null;
  status: string | null;
  followUpDate: string | null;
};

export function AddTaskSheet({
  leads,
  onClose,
  onCreated,
}: {
  leads: LeadOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useSalesToast();
  const [query, setQuery] = useState("");
  const [leadId, setLeadId] = useState("");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads.slice(0, 10);
    return leads
      .filter((l) => {
        return (
          l.name.toLowerCase().includes(q) ||
          (l.phone || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [leads, query]);

  const selected = leads.find((l) => l.id === leadId) ?? null;

  const quickDates = useMemo(() => {
    const today = new Date();
    return [
      { label: "Today", value: toDateKey(today) },
      { label: "Tomorrow", value: toDateKey(addDays(today, 1)) },
      { label: "In 3 days", value: toDateKey(addDays(today, 3)) },
      { label: "Next week", value: toDateKey(addDays(today, 7)) },
    ];
  }, []);

  async function handleSave() {
    if (!leadId || !date) {
      setError("Choose a lead and due date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follow_up_date: date }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not create task");
        return;
      }
      toast({
        tone: "success",
        title: "Task created",
        description: `Follow-up scheduled for ${selected?.name ?? "lead"}${time ? ` · ${time}` : ""}.`,
      });
      onCreated();
      onClose();
    } catch {
      setError("Could not create task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PremiumSheet
      title="Add task"
      description="Schedule a follow-up and link it to a customer or deal."
      onClose={onClose}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="md" loading={saving} onClick={() => void handleSave()}>
            Create task
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Related lead</FieldLabel>
          <div className="relative mt-1.5">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sales-text-muted"
            />
            <Input
              className="pl-9"
              placeholder="Search lead or customer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="mt-2 max-h-44 overflow-y-auto rounded-sales-md border border-sales-border-subtle">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[13px] text-sales-text-muted">
                No matching leads
              </li>
            ) : (
              filtered.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setLeadId(l.id)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] hover:bg-sales-surface-hover ${
                      leadId === l.id ? "bg-[var(--sales-brand-soft-solid,#F3FCE3)]" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-sales-text-primary">
                        {l.name}
                      </span>
                      <span className="block truncate text-[12px] text-sales-text-muted">
                        {l.phone || "No phone"}
                        {l.followUpDate ? ` · due ${l.followUpDate}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <FieldLabel>Due date</FieldLabel>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {quickDates.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDate(d.value)}
                className={`rounded-sales-md border px-2.5 py-1.5 text-[12px] font-medium ${
                  date === d.value
                    ? "border-sales-brand-border bg-sales-brand-soft text-sales-text-primary"
                    : "border-sales-border text-sales-text-secondary"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <Input
            type="date"
            className="mt-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel>Due time</FieldLabel>
          <p className="mt-1 text-[12px] text-sales-text-muted">
            Timed callbacks are set when logging a call. Date scheduling uses the lead follow-up
            date.
          </p>
          <Select
            className="mt-1.5"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="Preferred time note"
          >
            {["09:00", "10:00", "11:00", "14:00", "16:00", "17:00"].map((t) => (
              <option key={t} value={t}>
                {format(new Date(`1970-01-01T${t}:00`), "h:mm a")}
              </option>
            ))}
          </Select>
        </div>

        {error ? <p className="text-[13px] text-sales-danger">{error}</p> : null}
      </div>
    </PremiumSheet>
  );
}
