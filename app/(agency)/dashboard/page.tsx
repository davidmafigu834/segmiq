import { Suspense } from "react";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { DashboardMain } from "./DashboardMain";
import { DashboardSkeleton } from "./DashboardSkeleton";

export const revalidate = 30;

export default async function DashboardPage() {
  return (
    <AgencyLayout breadcrumb="AGENCY" pageTitle="Overview" titleSize="hero">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardMain />
      </Suspense>
    </AgencyLayout>
  );
}
