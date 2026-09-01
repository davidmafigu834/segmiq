"use client";

import Link from "next/link";
import { CommercialModulePage } from "@/components/dashboard/company/commercial/CommercialModulePage";
import { CommercialModulePage } from "@/components/dashboard/company/commercial/CommercialModulePage";
import { DocumentsUploadZone } from "./DocumentsUploadZone";
import type { UserRole } from "@/types";

export function CompanyDocumentsUploadPage({
  clientId,
  chrome,
}: {
  clientId: string;
  chrome: {
    companyName: string;
    companyLogoUrl?: string | null;
    userName: string;
    avatarUrl?: string | null;
    unreadNotifications: number;
    notificationRole: UserRole;
    whatsappBadge?: number;
  };
}) {
  return (
    <CommercialModulePage
      chrome={chrome}
      breadcrumb="COMPANY / DOCUMENTS / UPLOAD"
      title="Upload documents"
      description="SegmiQ will classify, organize and understand supported documents automatically."
      titleActions={
        <Link href="/client/documents" className="text-[13px] font-medium text-sales-brand-fg hover:underline">
          ← Documents
        </Link>
      }
    >
      <div className="workspace-card max-w-2xl rounded-[14px] border border-sales-border bg-sales-surface p-5">
        <DocumentsUploadZone clientId={clientId} />
      </div>
    </CommercialModulePage>
  );
}
