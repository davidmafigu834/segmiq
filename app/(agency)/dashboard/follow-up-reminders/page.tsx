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
    <AgencyLayout breadcrumb="Operations / Jobs" pageTitle="Jobs">
      <div className="mb-6">
        <p className="max-w-2xl text-[13px] text-[var(--text-secondary)]">
          Preview and manually trigger WhatsApp follow-up reminders. Timed callbacks run every 30 minutes;
          due, overdue, and prep reminders run once daily at 08:00 Harare.
        </p>
      </div>
      <FollowUpReminderTester />
    </AgencyLayout>
  );
}
