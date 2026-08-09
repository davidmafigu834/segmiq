"use client";

import Link from "next/link";
import { CalendarClock, FileText, Phone } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Badge, Button } from "@/components/sales/ui";
import {
  dueDateTone,
  formatTaskDueDate,
  formatTaskPriority,
  formatTaskStatus,
} from "@/lib/sales/tasks/format";
import type { SalesTaskItem } from "@/lib/sales/tasks/types";

function TypeIcon({ type }: { type: SalesTaskItem["type"] }) {
  if (type === "whatsapp") return <SiWhatsapp size={16} color="#25D366" aria-hidden />;
  if (type === "call") return <Phone size={16} strokeWidth={1.8} className="text-[#14B8A6]" />;
  if (type === "quote_review")
    return <FileText size={16} strokeWidth={1.8} className="text-sales-warning" />;
  return <CalendarClock size={16} strokeWidth={1.8} className="text-sales-success" />;
}

function typeTint(type: SalesTaskItem["type"]) {
  if (type === "whatsapp") return "bg-[#ECFDF3]";
  if (type === "call") return "bg-[#F0FDFA]";
  if (type === "quote_review") return "bg-[#FFFAEB]";
  return "bg-[#ECFDF3]";
}

function statusTone(status: SalesTaskItem["status"]) {
  if (status === "overdue") return "danger" as const;
  if (status === "completed") return "success" as const;
  return "warning" as const;
}

function priorityDot(priority: SalesTaskItem["priority"]) {
  if (priority === "high") return "bg-sales-danger";
  if (priority === "medium") return "bg-sales-warning";
  return "bg-sales-success";
}

export function TaskDetailDrawer({
  task,
  onClose,
  onComplete,
  onReschedule,
}: {
  task: SalesTaskItem;
  onClose: () => void;
  onComplete: (task: SalesTaskItem) => void;
  onReschedule: (task: SalesTaskItem) => void;
}) {
  const dueTone = dueDateTone(task);
  const dueClass =
    dueTone === "danger"
      ? "text-sales-danger"
      : dueTone === "warning"
        ? "text-[#B54708]"
        : "text-sales-text-secondary";

  return (
    <PremiumSheet
      title={task.title}
      description={task.relatedName}
      onClose={onClose}
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {!task.completed ? (
            <>
              <Button variant="secondary" size="md" onClick={() => onReschedule(task)}>
                Reschedule
              </Button>
              <Button variant="primary" size="md" onClick={() => onComplete(task)}>
                Mark complete
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="md" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-sales-md ${typeTint(task.type)}`}
          >
            <TypeIcon type={task.type} />
          </span>
          <Badge tone={statusTone(task.status)} appearance="soft">
            {formatTaskStatus(task.status)}
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-sales-text-secondary">
            <span className={`h-1.5 w-1.5 rounded-full ${priorityDot(task.priority)}`} />
            {formatTaskPriority(task.priority)}
          </span>
        </div>

        <dl className="space-y-3 text-[13px]">
          <div className="flex justify-between gap-3 border-b border-sales-border-subtle pb-3">
            <dt className="text-sales-text-muted">Due date</dt>
            <dd className={`font-medium tabular-nums ${dueClass}`}>
              {formatTaskDueDate(task.dueAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-sales-border-subtle pb-3">
            <dt className="text-sales-text-muted">Type</dt>
            <dd className="font-medium">{task.typeLabel}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-sales-border-subtle pb-3">
            <dt className="text-sales-text-muted">Related to</dt>
            <dd className="text-right font-medium">
              <Link href={task.leadHref} className="text-sales-brand-fg hover:underline">
                {task.relatedName}
              </Link>
              {task.relatedSecondary ? (
                <p className="mt-0.5 text-[12px] font-normal text-sales-text-muted">
                  {task.relatedSecondary}
                </p>
              ) : null}
            </dd>
          </div>
          {task.createdByName ? (
            <div className="flex justify-between gap-3 border-b border-sales-border-subtle pb-3">
              <dt className="text-sales-text-muted">Scheduled by</dt>
              <dd className="font-medium">{task.createdByName}</dd>
            </div>
          ) : null}
          {task.phone ? (
            <div className="flex justify-between gap-3">
              <dt className="text-sales-text-muted">Phone</dt>
              <dd className="font-mono tabular-nums">{task.phone}</dd>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-wrap gap-2">
          <Link
            href={task.leadHref}
            className="inline-flex h-9 items-center rounded-sales-md border border-sales-border bg-white px-3 text-[13px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
          >
            Open lead
          </Link>
          {task.whatsappHref ? (
            <Link
              href={task.whatsappHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-sales-md border border-sales-border bg-white px-3 text-[13px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
            >
              <SiWhatsapp size={14} /> Message on WhatsApp
            </Link>
          ) : null}
          {task.phone ? (
            <a
              href={`tel:${task.phone}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-sales-md border border-sales-border bg-white px-3 text-[13px] font-medium text-sales-text-primary hover:bg-sales-surface-hover"
            >
              <Phone size={14} strokeWidth={1.8} /> Call
            </a>
          ) : null}
        </div>

        <p className="rounded-sales-md border border-sales-border-subtle bg-sales-surface-subtle px-3 py-2.5 text-[12px] text-sales-text-secondary">
          Tasks are scheduled follow-ups on your assigned leads. Completing a task clears the
          follow-up date.
        </p>
      </div>
    </PremiumSheet>
  );
}
