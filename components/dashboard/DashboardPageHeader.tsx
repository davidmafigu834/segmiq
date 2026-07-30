"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

export function DashboardPageHeader() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const line1 = format(now, "EEE d MMM").toUpperCase();
  const time = format(now, "HH:mm");

  return (
    <header className="mb-8 flex flex-col gap-4 min-[720px]:flex-row min-[720px]:items-end min-[720px]:justify-between">
      <div>
        <p
          className="font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-ink-tertiary"
          style={{ letterSpacing: "0.08em" }}
        >
          PLATFORM / DASHBOARD
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-display text-ink-primary min-[720px]:text-[40px]">
          Overview
        </h1>
      </div>
      <div className="font-mono text-xs font-normal text-ink-tertiary shrink-0 tabular-nums">
        {line1} · {time}
      </div>
    </header>
  );
}
