"use client";

import { emitCourseEvent } from "@/lib/sales/training/course-events";
import { useGuidedCourse } from "../GuidedCourseProvider";
import { Button } from "@/components/sales/ui/Button";

const QUICK_REPLIES = [
  "Happy to help — our warranty covers panels for 10 years and workmanship for 2.",
  "I can walk you through the warranty on a quick call — when works for you?",
];

export function PracticeWhatsAppScenario() {
  const { practice, setPractice } = useGuidedCourse();

  return (
    <div className="overflow-hidden workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
      <div className="border-b border-sales-border px-4 py-3">
        <p className="text-[14px] font-semibold text-sales-text-primary">Tariro Moyo</p>
        <p className="text-[12px] text-sales-text-muted">Practice chat · not sent via WhatsApp</p>
      </div>
      <div className="space-y-2 p-4">
        {practice.whatsappMessages.map((m) => (
          <div
            key={m.id}
            className={
              m.from === "customer"
                ? "max-w-[85%] rounded-[12px] bg-sales-surface-subtle px-3 py-2 text-[13px] text-sales-text-primary"
                : "ml-auto max-w-[85%] rounded-[12px] bg-[rgba(212,255,79,0.25)] px-3 py-2 text-[13px] text-sales-text-primary"
            }
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="border-t border-sales-border p-3" data-course-target="practice-whatsapp-quick-reply">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-sales-text-muted">
          Quick replies
        </p>
        <div className="flex flex-col gap-2">
          {QUICK_REPLIES.map((text) => (
            <Button
              key={text}
              type="button"
              variant="secondary"
              size="sm"
              className="h-auto whitespace-normal py-2 text-left"
              onClick={() => {
                setPractice((p) => ({
                  ...p,
                  selectedQuickReply: text,
                  whatsappMessages: [
                    ...p.whatsappMessages,
                    { id: `y-${Date.now()}`, from: "you", text },
                  ],
                }));
                emitCourseEvent("PRACTICE_WHATSAPP_REPLY_SELECTED");
              }}
            >
              {text}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
