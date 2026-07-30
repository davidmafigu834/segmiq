import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { FollowUpReminderTester } from "@/components/agency/FollowUpReminderTester";

export const dynamic = "force-dynamic";

export default async function FollowUpRemindersAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <AgencyLayout breadcrumb="PLATFORM / FOLLOW-UP REMINDERS" pageTitle="Follow-up reminders">
      <div className="ag-fade-in mb-8">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--text-tertiary)]">
          PLATFORM / FOLLOW-UP REMINDERS
        </p>
        <h1 className="mt-1 font-display text-[28px] leading-none tracking-display text-[var(--text-primary)] md:text-[40px]">
          Follow-up reminder test
        </h1>
        <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
          Preview and manually trigger WhatsApp follow-up reminders for salespeople. Timed callback reminders
          run every 30 minutes; due, overdue, and prep reminders run once daily at 08:00 Harare (06:00 UTC).
        </p>
      </div>
      <FollowUpReminderTester />
    </AgencyLayout>
  );
}
