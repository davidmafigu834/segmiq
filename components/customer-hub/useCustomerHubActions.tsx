"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddToHubSheet } from "@/components/sales/AddToHubSheet";

export function useCustomerHubActions(
  clientId: string,
  assignmentMode: "direct" | "pool" | "round_robin"
) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);

  function handleSuccess() {
    router.refresh();
  }

  const sheets = (
    <>
      {addOpen && (
        <AddToHubSheet
          assignmentMode={assignmentMode}
          mode="manager"
          clientId={clientId}
          onClose={() => setAddOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
      {walkInOpen && (
        <AddToHubSheet
          assignmentMode={assignmentMode}
          mode="manager"
          clientId={clientId}
          defaultSource="Walk-in"
          hideSourceField
          variant="walk_in"
          onClose={() => setWalkInOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );

  return {
    sheets,
    openAdd: () => setAddOpen(true),
    openWalkIn: () => setWalkInOpen(true),
  };
}
