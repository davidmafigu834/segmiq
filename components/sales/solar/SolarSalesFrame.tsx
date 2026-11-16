import type { ReactNode } from "react";
import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

type Shell = Awaited<ReturnType<typeof loadSalesShellProps>>;

export function SolarSalesFrame({
  shell,
  title,
  breadcrumb,
  children,
}: {
  shell: Shell;
  title: string;
  breadcrumb: string;
  children: ReactNode;
}) {
  return (
    <SalesLayout breadcrumb={breadcrumb} pageTitle={title} hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell
        {...shell}
        breadcrumb={breadcrumb}
        title={title}
        showDefaultHeader={false}
        searchPlaceholder="Search leads, customers, quotes..."
      >
        {children}
      </SalesAppShell>
    </SalesLayout>
  );
}
