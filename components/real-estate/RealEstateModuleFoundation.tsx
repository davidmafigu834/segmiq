import { EmptyState, PageHeader } from "@/components/ui";
import type { LucideIcon } from "lucide-react";

export function RealEstateModuleFoundation({
  eyebrow,
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
  icon,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="min-w-0 w-full max-w-full pb-16">
      <PageHeader className="mb-8" eyebrow={eyebrow} title={title} description={subtitle} />
      <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
        <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
      </div>
    </div>
  );
}
