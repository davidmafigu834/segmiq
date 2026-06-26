import { Bell } from "lucide-react";
import { AvatarInitials } from "./crm";
import { useAppHeader } from "../context/AppHeaderContext";

export function HeaderActions() {
  const ctx = useAppHeader();
  if (!ctx?.showActions) return null;

  const { userName, unreadCount, onOpenNotifications, onOpenProfile } = ctx;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onOpenNotifications}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary touch-manipulation active:bg-bg-tertiary"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <Bell size={20} strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-0.5 font-mono text-[10px] font-bold leading-none text-accent-ink ring-2 ring-bg-primary"
            aria-hidden
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onOpenProfile}
        className="touch-manipulation"
        aria-label="Profile and settings"
      >
        <AvatarInitials name={userName} size="sm" heat="warm" />
      </button>
    </div>
  );
}
