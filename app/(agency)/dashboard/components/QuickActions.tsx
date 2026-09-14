"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { ImportLeadsModal } from "@/components/leads/ImportLeadsModal";
import { Button } from "@/components/ui/Button";

export function QuickActions() {
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <div className="flex items-center justify-end pb-5">
        <Button variant="ghost" size="sm" onClick={() => setShowImport(true)}>
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
