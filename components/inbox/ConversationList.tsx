"use client";

import type { InboxFilter, InboxConversation } from "@/lib/inbox/types";
import { ConversationRow } from "./ConversationRow";

type Props = {
  conversations: InboxConversation[];
  activeId: string | null;
  filter: InboxFilter;
  search: string;
  currentRepName: string;
  currentUserId: string;
  onSelect: (id: string) => void;
  onClaim: (leadId: string) => void;
  claimingId: string | null;
  open: boolean;
  canClaim: boolean;
};

function applyFilter(
  rows: InboxConversation[],
  filter: InboxFilter,
  search: string,
  currentUserId: string
): InboxConversation[] {
  const q = search.trim().toLowerCase();
  return rows.filter((l) => {
    if (filter === "unassigned" && l.assignedToId) return false;
    if (filter === "mine" && l.assignedToId !== currentUserId) return false;
    if (filter === "hot" && l.score < 70) return false;
    if (
      q &&
      !(
        (l.name ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q) ||
        (l.location ?? "").toLowerCase().includes(q)
      )
    ) {
      return false;
    }
    return true;
  });
}

export function ConversationList({
  conversations,
  activeId,
  filter,
  search,
  currentRepName,
  currentUserId,
  onSelect,
  onClaim,
  claimingId,
  open,
  canClaim,
}: Props) {
  const filtered = applyFilter(conversations, filter, search, currentUserId);

  return (
    <div
      id="convPanel"
      className={[
        "flex w-[360px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-tertiary)]",
        "max-[860px]:fixed max-[860px]:bottom-0 max-[860px]:left-0 max-[860px]:top-16 max-[860px]:z-40 max-[860px]:w-[300px] max-[860px]:shadow-[12px_0_30px_rgba(0,0,0,0.6)] max-[860px]:transition-transform max-[860px]:duration-200",
        open ? "max-[860px]:translate-x-0" : "max-[860px]:-translate-x-full",
      ].join(" ")}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Team Inbox
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">Sorted by score</span>
      </div>
      <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-4 py-2 text-[11px] text-[var(--text-tertiary)]">
        <span
          className="inline-block h-[10px] w-[10px] rounded-full"
          style={{ background: "var(--accent)" }}
        />
        Your leads
        <span
          className="ml-2 inline-block h-[10px] w-[10px] rounded-full"
          style={{ border: "1.5px dashed var(--text-tertiary)" }}
        />
        Unassigned — tap badge to claim
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="space-y-3 p-5 text-left text-xs leading-relaxed text-[var(--text-tertiary)]">
            {conversations.length === 0 ? (
              <>
                <p className="text-sm font-medium text-[var(--text-secondary)]">No WhatsApp conversations yet</p>
                <p>The inbox only shows chats created when a customer messages your company WhatsApp number.</p>
                <ol className="list-decimal space-y-1.5 pl-4">
                  <li>Apply DB migrations 056 + 057</li>
                  <li>Save Phone number ID on the client (Agency → Settings → WhatsApp)</li>
                  <li>Webhook on Meta → <code className="font-mono">messages</code> subscribed</li>
                  <li>Send a test WhatsApp to the business number (not from the API console alone)</li>
                </ol>
                <p className="text-[11px]">
                  On localhost, webhooks hit production — use segmiq.com webhook URL, not localhost.
                </p>
              </>
            ) : (
              <p className="text-center text-sm">No leads match this filter. Try <strong>All</strong> or{" "}
              <strong>Unassigned</strong>.</p>
            )}
          </div>
        ) : (
          filtered.map((c, i) => (
            <div key={c.id} className={`ag-fade-in ag-delay-${Math.min(i + 1, 5)}`}>
              <ConversationRow
                conversation={c}
                active={c.id === activeId}
                currentRepName={currentRepName}
                onSelect={() => onSelect(c.id)}
                onClaim={onClaim}
                claiming={claimingId === c.id}
                canClaim={canClaim}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
