import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { FollowUpReminderTester } from "@/components/agency/FollowUpReminderTester";
import { RecordFrame } from "@/components/platform/workbench";

export const dynamic = "force-dynamic";

export default async function FollowUpRemindersAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <AgencyLayout breadcrumb="Operations / Jobs" pageTitle="Jobs">
      <RecordFrame
        detail="Timed callbacks run every 30 minutes. Due, overdue, and prep reminders run once daily at 08:00 Harare."
        fact={{
          name: "Run a reminder only when you mean to send it.",
          detail: "A manual trigger sends WhatsApp messages. Preview first.",
          action: "Open WhatsApp",
          href: "/dashboard/whatsapp-templates",
        }}
      >
        <FollowUpReminderTester />
      </RecordFrame>
    </AgencyLayout>
  );
}
