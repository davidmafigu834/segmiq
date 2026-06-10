"use client";

import { NewClientButton } from "@/components/dashboard/NewClientButton";

export function DashboardHeaderAction() {
  return <NewClientButton variant="secondary" className="!h-9 max-md:!hidden" label="New client" />;
}
