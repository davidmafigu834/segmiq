import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesBoard } from "./SalesBoard";
import type { LeadWithClientResponseLimit } from "@/lib/leadStatus";

export default async function SalesLeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const supabase = createAdminClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("*, clients ( response_time_limit_hours )")
    .eq("assigned_to_id", session.userId)
    .order("score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (
    <SalesLayout breadcrumb="SALES / PIPELINE" pageTitle="My pipeline">
      <Suspense fallback={<div className="shimmer h-96 rounded-lg" />}>
        <SalesBoard initialLeads={(leads ?? []) as LeadWithClientResponseLimit[]} />
      </Suspense>
    </SalesLayout>
  );
}
