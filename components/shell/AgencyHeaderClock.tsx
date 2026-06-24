"use client";

import { useEffect, useState } from "react";

function formatHeaderDate(d: Date) {
  const wk = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const day = d.getDate();
  const mon = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const hm = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${wk} ${day} ${mon} · ${hm}`;
}

export function AgencyHeaderClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    function tick() {
      setNow(new Date());
    }
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="hidden shrink-0 whitespace-nowrap font-mono text-[14px] font-medium text-ink-tertiary md:inline">
      {now ? formatHeaderDate(now) : "\u00a0"}
    </span>
  );
}
