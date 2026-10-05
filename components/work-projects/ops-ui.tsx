/* Hallmark · macrostructure: Workbench · tone: operational · anchor hue: lime
 * pre-emit critique: P5 H5 E4 S5 R4 V4
 * App pages share SegmiQ tokens. Accent stays on the current step and the primary action.
 */

import Link from "next/link";

export type Milestone = { label: string; state: "done" | "current" | "upcoming" };

export function DeliveryMilestones({ steps }: { steps: Milestone[] }) {
  return (
    <ol className="flex gap-4 overflow-x-auto pb-1">
      {steps.map((step) => (
        <li key={step.label} className="flex min-w-[5.5rem] shrink-0 items-center gap-2 text-[13px]">
          <span
            aria-hidden
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
              step.state === "done"
                ? "bg-sales-text-primary text-white"
                : step.state === "current"
                  ? "bg-segmiq-lime text-sales-text-primary"
                  : "border border-sales-border text-sales-text-muted"
            }`}
          >
            {step.state === "done" ? "✓" : step.state === "current" ? "●" : ""}
          </span>
          <span className={step.state === "upcoming" ? "text-sales-text-muted" : "font-medium text-sales-text-primary"}>
            {step.label}
            <span className="sr-only">{step.state === "done" ? ", done" : step.state === "current" ? ", current" : ", not started"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SectionSwitch({
  sections,
  current,
  onChange,
}: {
  sections: readonly string[];
  current: string;
  onChange: (section: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-sales-border">
      {sections.map((section) => {
        const selected = section === current;
        return (
          <button
            key={section}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange(section)}
            className={`min-h-11 border-b-2 px-0.5 text-[14px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sales-text-primary ${
              selected ? "border-segmiq-lime text-sales-text-primary" : "border-transparent text-sales-text-secondary"
            }`}
          >
            {section}
          </button>
        );
      })}
    </div>
  );
}

export function ReadinessList({ rows }: { rows: Array<{ label: string; value: string; ok: boolean | null }> }) {
  return (
    <ul className="divide-y divide-sales-border-subtle">
      {rows.map((row) => (
        <li key={row.label} className="flex items-baseline justify-between gap-4 py-2 text-[14px]">
          <span className="text-sales-text-secondary">{row.label}</span>
          <span className="text-right font-medium text-sales-text-primary">
            <span aria-hidden className="mr-2">{row.ok == null ? "○" : row.ok ? "✓" : "!"}</span>
            {row.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
