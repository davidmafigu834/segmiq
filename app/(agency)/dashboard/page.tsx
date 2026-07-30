import { Suspense } from "react";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { DashboardHeaderAction } from "@/components/dashboard/DashboardHeaderAction";
import { DashboardMain } from "./DashboardMain";
import { DashboardSkeleton } from "./DashboardSkeleton";

export const revalidate = 30;

export default async function DashboardPage() {
  return (
    <AgencyLayout breadcrumb="PLATFORM" pageTitle="Overview" titleSize="hero" actions={<DashboardHeaderAction />}>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardMain />
      </Suspense>
    </AgencyLayout>
  );
}
