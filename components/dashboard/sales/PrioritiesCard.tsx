"use client";

import Link from "next/link";
import { Phone } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { openWhatsAppAndLog } from "@/lib/whatsapp-opener";
import type { SalesPriorityTask } from "./types";
import { CardShell } from "./KpiCard";

export function PriorityRow({
  task,
  repName,
  onLog,
}: {
  task: SalesPriorityTask;
  repName: string;
  onLog: (leadId: string, channel?: "call" | "whatsapp") => void;
}) {
  const subtitle = task.industry || "";

  return (
    <li className="grid min-h-[56px] grid-cols-1 gap-2 border-b border-[#E5E7EB] px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1.35fr)_110px_minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2F4F7] text-[11px] font-semibold text-[#667085]"
          aria-hidden
        >
          {task.initials}
        </div>
        <div className="min-w-0">
          <Link
            href={task.href}
            title={task.name}
            className="block truncate text-[13px] font-semibold text-[#101828] transition-colors hover:text-[#4D7C0F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF4F]"
          >
            {task.name}
          </Link>
          {subtitle ? (
            <p className="truncate text-[12px] text-[#667085]" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className="pl-12 sm:pl-0">
        <span
          className={`inline-flex max-w-full truncate rounded-[7px] px-2 py-0.5 text-[11px] font-medium ${
            task.overdue ? "bg-[#FEF2F2] text-[#EF4444]" : "bg-[#F2F4F7] text-[#667085]"
          }`}
          title={task.dueLabel}
        >
          {task.dueLabel}
        </span>
      </div>

      <div className="min-w-0 pl-12 sm:pl-0">
        <p className="truncate text-[13px] font-medium text-[#101828]">{task.taskLabel}</p>
        <p className="truncate text-[12px] text-[#98A2B3]">{task.taskDetail}</p>
      </div>

      <div className="flex items-center gap-1.5 pl-12 sm:justify-end sm:pl-0">
        <button
          type="button"
          className="sd-icon-btn !h-10 !w-10 !min-h-10 !min-w-10"
          aria-label={`Message ${task.name} on WhatsApp`}
          title="Message on WhatsApp"
          disabled={!task.phone}
          onClick={() => {
            if (!task.phone) return;
            void openWhatsAppAndLog({
              leadId: task.leadId,
              clientId: task.clientId,
              leadName: task.name,
              leadPhone: task.phone,
              repName,
              formData: task.formData,
              tier: "neutral",
            });
            onLog(task.leadId, "whatsapp");
          }}
        >
          <SiWhatsapp size={16} color="#25D366" aria-hidden />
        </button>
        {task.phone ? (
          <a
            href={`tel:${task.phone}`}
            className="sd-icon-btn !h-10 !w-10 !min-h-10 !min-w-10"
            aria-label={`Call ${task.name}`}
            title="Call customer"
            onClick={() => onLog(task.leadId, "call")}
          >
            <Phone size={16} strokeWidth={1.8} aria-hidden />
          </a>
        ) : (
          <button
            type="button"
            className="sd-icon-btn !h-10 !w-10 !min-h-10 !min-w-10"
            disabled
            aria-label="No phone number"
          >
            <Phone size={16} strokeWidth={1.8} aria-hidden />
          </button>
        )}
        <button
          type="button"
          className="inline-flex h-10 min-w-[44px] items-center justify-center rounded-[9px] border border-[#E4E7EC] bg-white px-3 text-[12px] font-medium text-[#101828] transition-colors duration-150 hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF4F]"
          onClick={() => onLog(task.leadId, "call")}
        >
          Log
        </button>
      </div>
    </li>
  );
}

export function PrioritiesCard({
  tasks,
  totalCount,
  repName,
  onLog,
}: {
  tasks: SalesPriorityTask[];
  totalCount: number;
  repName: string;
  onLog: (leadId: string, channel?: "call" | "whatsapp") => void;
}) {
  return (
    <CardShell
      title="Today’s priorities"
      action={
        <div className="flex items-center gap-3">
          <span className="inline-flex min-w-[22px] items-center justify-center rounded-[7px] bg-[#F2F4F7] px-1.5 py-0.5 text-[11px] font-semibold text-[#667085] tabular-nums">
            {totalCount}
          </span>
          <Link
            href="/sales/call-now"
            className="text-[12px] font-medium text-[#667085] transition-colors hover:text-[#101828]"
          >
            View call queue
          </Link>
        </div>
      }
    >
      {tasks.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-[14px] font-medium text-[#101828]">You’re clear for now</p>
          <p className="mt-1 text-[13px] text-[#667085]">
            No follow-ups or call-now leads need attention.
          </p>
        </div>
      ) : (
        <ul>
          {tasks.map((task) => (
            <PriorityRow key={task.id} task={task} repName={repName} onLog={onLog} />
          ))}
        </ul>
      )}
    </CardShell>
  );
}
