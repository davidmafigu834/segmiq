"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { CreateClientModal } from "@/components/dashboard/CreateClientModal";
import { Button } from "@/components/ui/Button";

type Props = {
  variant?: "primary" | "secondary";
  label?: string;
  showIcon?: boolean;
  className?: string;
};

export function NewClientButton({
  variant = "primary",
  label = "New client",
  showIcon = true,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        {showIcon ? <Building2 className="h-4 w-4" /> : null}
        {label}
      </Button>
      <CreateClientModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
