"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { CompanyDashboardHeader } from "../CompanyDashboardHeader";
import type { UserRole } from "@/types";

export function CompanyBillingHeader({
  unreadNotifications,
  notificationRole,
  userName,
  avatarUrl,
}: {
  unreadNotifications: number;
  notificationRole: UserRole;
  userName: string;
  avatarUrl?: string | null;
}) {
  return (
    <CompanyDashboardHeader
      unreadNotifications={unreadNotifications}
      notificationRole={notificationRole}
      userName={userName}
      avatarUrl={avatarUrl}
      canAddLead={false}
      breadcrumb="Company / Billing"
      title="Billing"
      description="Manage your subscription, payment methods and billing history."
      primaryAction={null}
      titleActions={
        <Link
          href="/client/settings/company"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 text-[13px] font-medium text-sales-text-secondary hover:text-sales-text-primary"
        >
          Need help?
          <span className="inline-flex items-center gap-1 text-sales-text-primary">
            Billing help center
            <ExternalLink size={13} strokeWidth={1.8} aria-hidden />
          </span>
        </Link>
      }
    />
  );
}
