import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesBoard } from "./SalesBoard";
import type { LeadWithClientResponseLimit } from "@/lib/leadStatus";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function SalesLeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  const supabase = createAdminClient();
  const first = await supabase
    .from("leads")
    .select("*, clients ( response_time_limit_hours )")
    .eq("assigned_to_id", session.userId)
    .or("is_archived.is.null,is_archived.eq.false")
    .order("created_at", { ascending: false });

  let leads = first.data;
  if (first.error && String(first.error.message || "").includes("column leads.is_archived does not exist")) {
    const retry = await supabase
      .from("leads")
      .select("*, clients ( response_time_limit_hours )")
      .eq("assigned_to_id", session.userId)
      .order("created_at", { ascending: false });
    leads = retry.data ?? [];
  }

  return (
    <SalesLayout breadcrumb="SALES / PIPELINE" pageTitle="My pipeline">
      <Suspense fallback={<div className="shimmer h-96 rounded-xl" />}>
        <SalesBoard initialLeads={(leads ?? []) as LeadWithClientResponseLimit[]} />
      </Suspense>
    </SalesLayout>
  );
}
