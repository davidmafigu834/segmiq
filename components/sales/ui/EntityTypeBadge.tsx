import {
  BadgeCheck,
  FileText,
  FolderKanban,
  Handshake,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Badge, type BadgeTone } from "./Badge";

export type EntityType = "LEAD" | "CUSTOMER" | "DEAL" | "QUOTATION" | "PROJECT";

const ENTITY_MAP: Record<
  EntityType,
  { label: string; icon: LucideIcon; tone: BadgeTone }
> = {
  LEAD: { label: "Lead", icon: UserRound, tone: "success" },
  CUSTOMER: { label: "Customer", icon: BadgeCheck, tone: "info" },
  DEAL: { label: "Deal", icon: Handshake, tone: "warning" },
  QUOTATION: { label: "Quotation", icon: FileText, tone: "purple" },
  PROJECT: { label: "Project", icon: FolderKanban, tone: "info" },
};

export function EntityTypeBadge({
  type,
  className,
  showIcon = true,
}: {
  type: EntityType;
  className?: string;
  showIcon?: boolean;
}) {
  const config = ENTITY_MAP[type];
  const Icon = config.icon;

  return (
    <Badge
      tone={config.tone}
      appearance="soft"
      size="sm"
      className={cn("gap-1 !px-1.5 !py-0.5 !text-[10px]", className)}
    >
      {showIcon ? <Icon size={11} strokeWidth={1.8} aria-hidden /> : null}
      {config.label}
    </Badge>
  );
}
