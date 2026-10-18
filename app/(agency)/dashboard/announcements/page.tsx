import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { AnnouncementPublisher } from "@/components/important-messages/AnnouncementPublisher";

export const dynamic = "force-dynamic";

export default async function PlatformAnnouncementsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <AgencyLayout breadcrumb="Operations / Announcements" pageTitle="Important Messages">
      <AnnouncementPublisher />
    </AgencyLayout>
  );
}
