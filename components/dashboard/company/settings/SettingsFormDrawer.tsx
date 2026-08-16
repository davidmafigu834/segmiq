"use client";

import type { ReactNode } from "react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button } from "@/components/sales/ui";

export function SettingsFormDrawer({
  title,
  description,
  onClose,
  onSave,
  saving,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  children: ReactNode;
}) {
  return (
    <PremiumSheet
      title={title}
      description={description}
      onClose={onClose}
      maxWidthClass="max-w-[560px]"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="md" loading={saving} onClick={onSave}>
            Save changes
          </Button>
        </div>
      }
    >
      <div className="space-y-4">{children}</div>
    </PremiumSheet>
  );
}
