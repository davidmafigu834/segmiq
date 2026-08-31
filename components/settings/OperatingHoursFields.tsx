"use client";

import { Checkbox, Field, Input } from "@/components/sales/ui";
import { WEEKDAY_OPTIONS } from "@/lib/sales/intelligence/operating-hours";

export function OperatingHoursFields({
  workingDays,
  workStartTime,
  workEndTime,
  onWorkingDaysChange,
  onStartChange,
  onEndChange,
  hint,
}: {
  workingDays: number[];
  workStartTime: string;
  workEndTime: string;
  onWorkingDaysChange: (days: number[]) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  hint?: string;
}) {
  function toggleDay(day: number, checked: boolean) {
    const next = checked
      ? [...new Set([...workingDays, day])]
      : workingDays.filter((d) => d !== day);
    onWorkingDaysChange(next);
  }

  return (
    <div className="space-y-4">
      <Field label="Working days">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {WEEKDAY_OPTIONS.map((day) => (
            <Checkbox
              key={day.value}
              id={`work-day-${day.value}`}
              label={day.short}
              checked={workingDays.includes(day.value)}
              onCheckedChange={(checked) => toggleDay(day.value, checked)}
            />
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Work starts" htmlFor="work-start">
          <Input
            id="work-start"
            type="time"
            value={workStartTime}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </Field>
        <Field label="Work ends" htmlFor="work-end">
          <Input
            id="work-end"
            type="time"
            value={workEndTime}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </Field>
      </div>
      {hint ? <p className="text-[12px] text-sales-text-muted">{hint}</p> : null}
    </div>
  );
}
