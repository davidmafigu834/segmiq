"use client";

import { NewClientButton } from "@/components/dashboard/NewClientButton";

/** Renders in AppShell header on the Clients page (desktop + mobile). */
export function ClientsPageHeaderAction() {
  return <NewClientButton className="!h-9" />;
}
