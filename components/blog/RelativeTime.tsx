"use client";

import { useEffect, useState } from "react";
import { fmtRelative, fmtDateShort } from "@/lib/blog-utils";

export default function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => fmtDateShort(iso));

  useEffect(() => {
    setLabel(fmtRelative(iso));
  }, [iso]);

  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}
