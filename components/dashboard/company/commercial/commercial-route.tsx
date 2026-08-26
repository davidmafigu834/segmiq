import { ClientManagerLayout } from "@/components/layouts/ClientManagerLayout";
import { loadCompanyCommercialChrome } from "@/lib/commercial/page-chrome";
import type { ReactNode } from "react";

export async function CommercialRoute({
  searchParams,
  breadcrumbPage,
  pageTitle,
  children,
}: {
  searchParams: { clientId?: string };
  breadcrumbPage: string;
  pageTitle: string;
  children: (chrome: Awaited<ReturnType<typeof loadCompanyCommercialChrome>>) => ReactNode;
}) {
  const chrome = await loadCompanyCommercialChrome(searchParams);
  return (
    <ClientManagerLayout
      breadcrumbPage={breadcrumbPage}
      pageTitle={pageTitle}
      hideShellHeader
      hideShellSidebar
      navClientId={chrome.clientId}
    >
      {children(chrome)}
    </ClientManagerLayout>
  );
}
