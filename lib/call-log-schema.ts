import { z } from "zod";
import { CALL_RESULTS, REACH_OUTCOMES } from "@/lib/call-log-constants";

export const logCallBodySchema = z
  .object({
    reachOutcome: z.enum(REACH_OUTCOMES),
    result: z.enum(CALL_RESULTS).nullable().optional(),
    reason: z.string().max(500).nullable().optional(),
    callbackAt: z.string().nullable().optional(),
    assetsRequested: z.array(z.string()).nullable().optional(),
    notes: z.string().optional(),
    channel: z.enum(["call", "whatsapp"]).optional(),
    isConvertLaterPick: z.boolean().optional(),
    convertLaterNote: z.string().max(2000).nullable().optional(),
    dealValue: z.number().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reachOutcome === "reached") {
      if (
        data.result === "lost" ||
        data.result === "not_qualified" ||
        data.result === "follow_up"
      ) {
        if (!data.reason?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["reason"],
            message: "Please select a reason",
          });
        }
      }
      if (data.result === "follow_up") {
        if (!data.callbackAt?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["callbackAt"],
            message: "Please schedule a follow-up time",
          });
        }
      }
    }

    if (data.reachOutcome === "call_back") {
      if (!data.callbackAt?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["callbackAt"],
          message: "Please schedule a callback time",
        });
      }
    }

    if (data.callbackAt) {
      const cb = new Date(data.callbackAt);
      if (Number.isNaN(cb.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["callbackAt"],
          message: "Invalid callback time",
        });
      } else if (cb.getTime() < Date.now() - 60_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["callbackAt"],
          message: "Callback time cannot be in the past",
        });
      }
    }
  });

export type LogCallBody = z.infer<typeof logCallBodySchema>;
