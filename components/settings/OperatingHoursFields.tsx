"use client";

import { Checkbox, FieldHint, FieldLabel, Input } from "@/components/sales/ui";
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
      <div>
        <FieldLabel>Working days</FieldLabel>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
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
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="work-start">Work starts</FieldLabel>
          <Input
            id="work-start"
            type="time"
            value={workStartTime}
            onChange={(e) => onStartChange(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="work-end">Work ends</FieldLabel>
          <Input
            id="work-end"
            type="time"
            value={workEndTime}
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
      </div>
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}
