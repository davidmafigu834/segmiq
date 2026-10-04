import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { PortalSettingsForm, StaffIntelligenceForm } from "@/components/portal/PortalSettingsForm";
import { authOptions } from "@/lib/auth";
import { intelligenceFlags } from "@/lib/intelligence/audit";
import { getPortalSettings, portalUsage } from "@/lib/portal/service";

export const dynamic = "force-dynamic";

export default async function PortalSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session.clientId) redirect("/login");
  if (session.role !== "CLIENT_MANAGER" && session.role !== "SUPER_ADMIN") redirect("/client");
  const [settings, usage, intelligence] = await Promise.all([
    getPortalSettings(session.clientId),
    portalUsage(session.clientId),
    intelligenceFlags(session.clientId),
  ]);
  return (
    <ClientManagerLayout pageTitle="Customer portal" breadcrumbPage="SETTINGS" navClientId={session.clientId}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Customer portal</h1>
        <p className="mt-2 text-sm text-sales-text-secondary">Customers see only their own projects, payments, equipment, and documents you mark as visible.</p>
        <div className="mt-6 space-y-8">
          <PortalSettingsForm initial={settings} usage={usage} />
          <div>
            <h2 className="text-lg font-semibold">Staff intelligence</h2>
            <p className="mt-1 text-sm text-sales-text-secondary">Answers come from project, payment, and equipment records. Actions wait for approval.</p>
            <div className="mt-4">
              <StaffIntelligenceForm initial={{ operations: intelligence.operations, actions: intelligence.actions }} />
            </div>
          </div>
        </div>
      </div>
    </ClientManagerLayout>
  );
}
