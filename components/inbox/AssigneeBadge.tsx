"use client";

import { Plus } from "lucide-react";
import { assigneeBadgeColor, initials } from "@/lib/inbox/assignee-colors";

type Props = {
  assigneeName: string | null;
  currentRepName: string;
  onClaim?: () => void;
  claiming?: boolean;
};

export function AssigneeBadge({ assigneeName, currentRepName, onClaim, claiming }: Props) {
  if (assigneeName) {
    return (
      <div
        className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-bold"
        style={{
          background: assigneeBadgeColor(assigneeName, currentRepName),
          color: "var(--accent-foreground)",
          border: "2px solid var(--bg-tertiary)",
        }}
        title={`Assigned to ${assigneeName}`}
      >
        {initials(assigneeName)}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={claiming || !onClaim}
      onClick={(e) => {
        e.stopPropagation();
        onClaim?.();
      }}
      className={`absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--bg-tertiary)] disabled:opacity-50 ${
        onClaim ? "cursor-pointer" : "cursor-default"
      }`}
      style={{ border: "1.5px dashed var(--text-tertiary)" }}
      title={onClaim ? "Unassigned — tap to claim" : "Unassigned"}
    >
      <Plus size={10} className="text-[var(--text-tertiary)]" />
    </button>
  );
}
