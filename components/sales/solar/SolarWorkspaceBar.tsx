"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import type { UserRole } from "@/types";
import "@/components/real-estate/navigation/real-estate-sidebar.css";

const STARTS = [
  { label: "Lead", href: "/sales/leads" },
  { label: "Site visit", href: "/sales/work" },
  { label: "Project", href: "/sales/projects" },
  { label: "Quotation", href: "/sales/quotes" },
] as const;

export function SolarWorkspaceBar({
  name,
  unreadNotifications,
  notificationRole,
}: {
  name: string;
  unreadNotifications: number;
  notificationRole: UserRole;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const createId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-solar-create], [data-solar-create-trigger]")) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function go(href: string) {
    setOpen(false);
    if (href === "/sales/leads") {
      router.push("/sales/leads?add=1");
      return;
    }
    router.push(href);
  }

  return (
    <header className="re-top">
      <span className="re-top-btn re-top-property" aria-label={`Workspace, ${name}`}>
        <Building2 size={14} strokeWidth={2} aria-hidden />
        <span className="re-top-screen">{name}</span>
      </span>
      <span className="re-top-gap" />
      <button
        type="button"
        className="re-top-btn"
        data-solar-create-trigger="true"
        aria-expanded={open}
        aria-controls={createId}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus size={15} strokeWidth={2} aria-hidden />
        Create new
      </button>
      {open ? (
        <div id={createId} role="dialog" aria-label="Create" data-solar-create="true" className="re-top-pop re-top-pop-end">
          {STARTS.map((item) => (
            <button key={item.label} type="button" className="re-prop" onClick={() => go(item.href)}>
              <span className="re-prop-name">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      <NotificationBell initialUnread={unreadNotifications} role={notificationRole} />
    </header>
  );
}
