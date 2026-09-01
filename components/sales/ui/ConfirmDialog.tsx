"use client";

import { type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button } from "./Button";
import { Alert } from "./Feedback";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = false,
  loading = false,
  error,
  icon,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  loading?: boolean;
  error?: string | null;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  if (!open) return null;

  function close() {
    if (loading) return;
    onOpenChange(false);
  }

  return (
    <PremiumSheet
      size="sm"
      title={title}
      description={description}
      dialogRole={destructive ? "alertdialog" : "dialog"}
      dismissOnBackdrop={!destructive && !loading}
      icon={
        icon ??
        (destructive ? (
          <TriangleAlert size={18} strokeWidth={1.8} className="text-sales-danger" aria-hidden />
        ) : undefined)
      }
      onClose={close}
      closeDisabled={loading}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={loading} onClick={close}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            loading={loading}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {error ? (
        <Alert tone="danger" title={error} compact className="mb-4" />
      ) : null}
      {children}
    </PremiumSheet>
  );
}
