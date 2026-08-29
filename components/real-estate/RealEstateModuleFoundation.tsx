import { EmptyState } from "@/components/ui";
import type { LucideIcon } from "lucide-react";

export function RealEstateModuleFoundation({
  emptyTitle,
  emptyDescription,
  icon,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  emptyTitle: string;
  emptyDescription: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="workspace-card rounded-[14px] border border-sales-border bg-sales-surface">
      <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
    </div>
  );
}
