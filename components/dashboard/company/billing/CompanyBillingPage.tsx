"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { CompanyWorkspaceShell } from "@/components/dashboard/company/CompanyWorkspaceShell";
import { CompanyBillingHeader } from "./CompanyBillingHeader";
import { BillingCurrentPlan } from "./BillingCurrentPlan";
import { BillingUsageOverview } from "./BillingUsageOverview";
import { BillingInvoiceTable } from "./BillingInvoiceTable";
import { BillingRail } from "./BillingRail";
import { InvoiceDetailDrawer } from "./InvoiceDetailDrawer";
import { ManageSubscriptionModal } from "./ManageSubscriptionModal";
import { PaymentInstructionsModal } from "./PaymentInstructionsModal";
import { BillingInformationModal } from "./BillingInformationModal";
import { Alert, Button, useSalesToast } from "@/components/sales/ui";
import { formatDate } from "@/lib/billing/format";
import type { CompanyBillingInvoice, CompanyBillingPageData } from "@/lib/billing/company-billing-types";
import type { UserRole } from "@/types";

export function CompanyBillingPage({
  data,
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
  companyName,
  companyLogoUrl,
  whatsappBadge = 0,
}: {
  data: CompanyBillingPageData;
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
  companyName?: string;
  companyLogoUrl?: string | null;
  whatsappBadge?: number;
}) {
  const router = useRouter();
  const { toast } = useSalesToast();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CompanyBillingInvoice | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [companyLabel, setCompanyLabel] = useState(data.companyName);

  const pastDue =
    data.subscription?.status === "past_due" ||
    data.subscription?.status === "suspended" ||
    data.invoices.some((i) => i.status === "overdue");

  const latestUnpaid = useMemo(
    () => data.invoices.find((i) => i.status === "overdue") ?? data.invoices.find((i) => i.status === "sent"),
    [data.invoices]
  );

  function retry() {
    router.refresh();
  }

  function downloadInvoice(invoice: CompanyBillingInvoice, kind: "invoice" | "receipt" = "invoice") {
    if (kind === "invoice" && !invoice.pdfUrl) {
      toast({ title: "Invoice PDF is not available yet.", tone: "warning" });
      return;
    }
    if (kind === "receipt" && !invoice.receiptPdfUrl) {
      toast({ title: "Receipt is not available.", tone: "warning" });
      return;
    }
    window.location.href = `/api/billing/company/invoices/${invoice.id}/pdf${kind === "receipt" ? "?kind=receipt" : ""}`;
  }

  return (
    <CompanyWorkspaceShell
      companyName={companyName}
      companyLogoUrl={companyLogoUrl}
      userName={userName}
      avatarUrl={avatarUrl}
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      whatsappBadge={whatsappBadge}
    >
      <div className="flex min-w-0 flex-col gap-4 overflow-x-hidden">
        <CompanyBillingHeader
          unreadNotifications={unreadNotifications}
          notificationRole={notificationRole}
          userName={userName}
          avatarUrl={avatarUrl}
        />

        {pastDue ? (
          <Alert
            tone="danger"
            icon={<AlertTriangle size={16} />}
            title={data.subscription?.status === "suspended" ? "Account paused for billing" : "Payment past due"}
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={() => setPayOpen(true)}>
                  Update payment method
                </Button>
                {latestUnpaid ? (
                  <Button variant="secondary" size="sm" onClick={() => setSelected(latestUnpaid)}>
                    View invoice
                  </Button>
                ) : null}
              </div>
            }
          >
            {data.subscription?.status === "suspended"
              ? "Workspace access is paused until the outstanding invoice is settled."
              : data.subscription?.graceEndsAt
                ? `Your latest subscription invoice is unpaid. Access continues until ${formatDate(data.subscription.graceEndsAt)} if payment stays unresolved.`
                : "Your latest subscription invoice is unpaid. Submit proof of payment or contact support."}
          </Alert>
        ) : null}

        <div className="grid min-w-0 grid-cols-1 gap-4 layout:grid-cols-[minmax(0,1fr)_minmax(350px,390px)]">
          <div className="contents layout:col-start-1 layout:flex layout:flex-col layout:gap-4">
            <div className="order-2 md:order-1 layout:order-none">
              <BillingCurrentPlan
                subscription={data.subscription}
                loadError={data.errors.subscription}
                onRetry={retry}
                onManage={() => setManageOpen(true)}
              />
            </div>
            <div className="order-3 layout:order-none">
              <BillingUsageOverview
                metrics={data.usage}
                loadError={data.errors.usage}
                onRetry={retry}
                onUpgrade={() => setManageOpen(true)}
              />
            </div>
            <div className="order-5 layout:order-none">
              <BillingInvoiceTable
                invoices={data.invoices}
                page={page}
                onPageChange={setPage}
                onOpen={setSelected}
                onDownload={(invoice) => downloadInvoice(invoice)}
                loadError={data.errors.invoices}
                onRetry={retry}
              />
            </div>
          </div>
          <div className="contents layout:col-start-2 layout:flex layout:flex-col layout:gap-4">
            <BillingRail
              data={data}
              onUpdatePayment={() => setPayOpen(true)}
              onBillingInfo={() => setInfoOpen(true)}
              onHistoryInvoices={() => {
                document.getElementById("billing-invoices")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              onRetryPayment={retry}
            />
          </div>
        </div>
      </div>

      {selected ? (
        <InvoiceDetailDrawer
          invoice={selected}
          companyName={companyLabel}
          billingEmail={data.billingEmail}
          onClose={() => setSelected(null)}
          onDownload={() => downloadInvoice(selected)}
          onReceipt={() => downloadInvoice(selected, "receipt")}
        />
      ) : null}

      {manageOpen ? (
        <ManageSubscriptionModal subscription={data.subscription} onClose={() => setManageOpen(false)} />
      ) : null}
      {payOpen ? (
        <PaymentInstructionsModal settings={data.paymentSettings} onClose={() => setPayOpen(false)} />
      ) : null}
      {infoOpen ? (
        <BillingInformationModal
          clientId={data.clientId}
          companyName={companyLabel}
          billingEmail={data.billingEmail}
          onClose={() => setInfoOpen(false)}
          onSaved={setCompanyLabel}
        />
      ) : null}
    </CompanyWorkspaceShell>
  );
}
