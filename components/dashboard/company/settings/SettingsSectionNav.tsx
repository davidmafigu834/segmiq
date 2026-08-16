"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Briefcase,
  Building2,
  Crown,
  Download,
  GitBranch,
  Globe,
  Lock,
  Palette,
  Plug,
  Shield,
  SlidersHorizontal,
  Sun,
  User,
  Users,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { cn } from "@/lib/ui/cn";
import type { SettingsSection } from "@/lib/settings/company-settings-config";

const ICONS: Record<string, LucideIcon> = {
  building: Building2,
  palette: Palette,
  briefcase: Briefcase,
  globe: Globe,
  crown: Crown,
  sliders: SlidersHorizontal,
  user: User,
  lock: Lock,
  sun: Sun,
  users: Users,
  bell: Bell,
  plug: Plug,
  git: GitBranch,
  download: Download,
  shield: Shield,
};

export function SettingsSectionNav({
  sections,
  active,
  onSelect,
}: {
  sections: SettingsSection[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Settings sections" className="flex min-w-0 flex-col gap-0.5">
      {sections.map((section) => {
        const selected = section.id === active;
        const Icon = ICONS[section.icon];
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={cn(
              "relative flex h-11 items-center gap-2.5 rounded-[8px] px-3 text-left text-[13px] font-medium transition-colors",
              selected
                ? "bg-sales-brand-soft text-sales-text-primary"
                : "text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
            )}
          >
            {selected ? (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sales-brand" aria-hidden />
            ) : null}
            {section.icon === "whatsapp" ? (
              <SiWhatsapp size={15} className="shrink-0" aria-hidden />
            ) : Icon ? (
              <Icon size={15} strokeWidth={1.8} className="shrink-0" aria-hidden />
            ) : null}
            <span className="truncate">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
