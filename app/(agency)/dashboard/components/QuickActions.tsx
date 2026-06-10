"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Upload } from "lucide-react";
import { ImportLeadsModal } from "@/components/leads/ImportLeadsModal";
import { Button } from "@/components/ui/Button";
import { NewClientButton } from "@/components/dashboard/NewClientButton";

export function QuickActions() {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 pb-6">
        <Button onClick={() => router.push("/dashboard/leads")}>
          <UserPlus className="h-4 w-4" />
          New lead
        </Button>
        <NewClientButton variant="secondary" />
        <Button variant="secondary" onClick={() => setShowImport(true)}>
          <Upload className="h-4 w-4" />
          Import leads
        </Button>
      </div>

      {showImport ? (
        <ImportLeadsModal
          onClose={() => setShowImport(false)}
          onSuccess={() => setShowImport(false)}
        />
      ) : null}
    </>
  );
}
