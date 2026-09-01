"use client";

import { type ReactNode } from "react";
import { ChevronDown, Zap } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  salesMenuTriggerClass,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";

export type SalesHeaderQuickAction = {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
};

export function SalesHeaderQuickActions({
  items,
  className,
  courseTarget,
}: {
  items: SalesHeaderQuickAction[];
  className?: string;
  courseTarget?: string;
}) {
  if (!items.length) return null;

  return (
    <div className={cn("relative hidden shrink-0 layout:block", className)}>
      <DropdownMenu align="end">
        <DropdownMenuTrigger
          className={salesMenuTriggerClass({ variant: "primary", size: "sm" })}
          aria-label="Quick actions"
          data-course-target={courseTarget}
        >
          <Zap size={14} strokeWidth={1.8} aria-hidden />
          Quick actions
          <ChevronDown size={14} strokeWidth={1.8} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          {items.map((item) => (
            <DropdownMenuItem key={item.key} icon={item.icon} onSelect={item.onSelect}>
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
