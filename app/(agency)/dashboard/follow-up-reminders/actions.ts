"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  executeFollowUpReminders,
  previewFollowUpReminders,
  type FollowUpPreviewResult,
  type FollowUpReminderResult,
} from "@/lib/follow-up-reminders";

async function requireAgencyAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN") {
    return null;
  }
  return session;
}

export async function loadFollowUpPreview(): Promise<
  { ok: true; preview: FollowUpPreviewResult } | { ok: false; error: string }
> {
  const session = await requireAgencyAdminSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  try {
    const preview = await previewFollowUpReminders();
    return { ok: true, preview };
  } catch (e) {
    console.error("[follow-up-reminders preview]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Preview failed" };
  }
}

export async function runFollowUpRemindersTest(input: {
  dryRun?: boolean;
  force?: boolean;
  leadId?: string;
}): Promise<{ ok: true; result: FollowUpReminderResult } | { ok: false; error: string }> {
  const session = await requireAgencyAdminSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  try {
    const result = await executeFollowUpReminders({
      dryRun: input.dryRun ?? false,
      force: input.force ?? false,
      leadId: input.leadId?.trim() || undefined,
    });
    return { ok: true, result };
  } catch (e) {
    console.error("[follow-up-reminders run]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Run failed" };
  }
}
