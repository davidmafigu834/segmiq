"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "@/components/sales/ui";

/** Header search for Toolbox — syncs `tools` query param for SalesToolboxClient. */
export function ToolboxHeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get("tools") ?? "";

  return (
    <SearchInput
      value={value}
      onChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next.trim()) params.set("tools", next);
        else params.delete("tools");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
      placeholder="Search tools..."
      className="w-full sm:w-[260px]"
      id="toolbox-search"
    />
  );
}
