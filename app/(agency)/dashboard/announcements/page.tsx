import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { AnnouncementPublisher } from "@/components/important-messages/AnnouncementPublisher";
import { RecordFrame } from "@/components/platform/workbench";

export const dynamic = "force-dynamic";

export default async function PlatformAnnouncementsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <AgencyLayout breadcrumb="Operations / Announcements" pageTitle="Important Messages">
      <RecordFrame
        detail="A message reaches every organisation that can see the console."
        fact={{
          name: "Publish only the message you mean to send.",
          detail: "The publisher below is the record.",
          action: "Open organisations",
          href: "/dashboard/clients",
        }}
      >
        <AnnouncementPublisher />
      </RecordFrame>
    </AgencyLayout>
  );
}
