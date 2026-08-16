"use client";

import { PremiumSheet } from "@/components/sales/PremiumSheet";
import { Button } from "@/components/sales/ui";
import { HowToPay, type PaymentSettings } from "@/components/billing/HowToPay";

export function PaymentInstructionsModal({
  settings,
  onClose,
}: {
  settings: PaymentSettings;
  onClose: () => void;
}) {
  return (
    <PremiumSheet
      title="Update payment method"
      description="SegmiQ bills by invoice. Use these details for bank transfer or mobile money. Card details are never collected in SegmiQ."
      onClose={onClose}
      size="md"
      footer={
        <Button variant="primary" size="md" onClick={onClose}>
          Done
        </Button>
      }
    >
      <HowToPay settings={settings} variant="sales" />
    </PremiumSheet>
  );
}
