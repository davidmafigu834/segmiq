"use client";

import type { InboxScene } from "@/lib/social-inbox/inbox-ui";
import type { SocialInboxSession } from "./useSocialInboxSession";

const SCENES: { id: InboxScene; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "no_channels", label: "No channels" },
  { id: "empty", label: "Empty" },
  { id: "channel_error", label: "Channel error" },
  { id: "hot_opportunity", label: "Hot opportunity" },
  { id: "existing_customer", label: "Existing customer" },
  { id: "failed_send", label: "Failed send" },
  { id: "manager", label: "Manager" },
  { id: "loading", label: "Loading" },
];

export function DevStateSwitcher({ session }: { session: SocialInboxSession }) {
  return (
    <div className="pointer-events-auto fixed bottom-3 left-3 z-40 rounded-[8px] border border-sales-border bg-sales-surface/95 p-2 shadow-[var(--sales-btn-shadow-secondary)] backdrop-blur-sm">
      <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sales-text-muted">Dev states</p>
      <div className="flex max-w-[280px] flex-wrap gap-1">
        {SCENES.map((scene) => (
          <button
            key={scene.id}
            type="button"
            onClick={() => session.applyScene(scene.id)}
            className={`rounded-[6px] px-1.5 py-0.5 text-[10px] ${
              session.scene === scene.id
                ? "bg-[color-mix(in_srgb,var(--sales-brand)_24%,transparent)] font-medium text-sales-text-primary"
                : "text-sales-text-muted hover:bg-sales-surface-hover"
            }`}
          >
            {scene.label}
          </button>
        ))}
      </div>
    </div>
  );
}
