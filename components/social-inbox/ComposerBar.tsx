"use client";

import {
  ChevronDown,
  FileText,
  Globe2,
  Lock,
  Paperclip,
  Plus,
  Sparkles,
  StickyNote,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  TextArea,
  Tooltip,
} from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import type { ComposerMode } from "@/lib/social-inbox/inbox-ui";
import type { SocialInboxSession } from "./useSocialInboxSession";

export function ComposerBar({ session }: { session: SocialInboxSession }) {
  const selected = session.selected;
  if (!selected) return null;
  const isComment = selected.conversation.conversationKind === "comment";
  const mode = session.composerMode;
  const sendLabel =
    mode === "public_reply" ? "Reply publicly" : mode === "internal_note" ? "Add note" : "Send privately";

  const modes: { id: ComposerMode; label: string }[] = isComment
    ? [
        { id: "public_reply", label: "Public reply" },
        { id: "private_message", label: "Private message" },
        { id: "internal_note", label: "Internal note" },
      ]
    : [
        { id: "reply", label: "Reply" },
        { id: "internal_note", label: "Internal note" },
      ];

  return (
    <div
      className={cn(
        "shrink-0 border-t border-sales-border px-3 py-2.5",
        mode === "internal_note"
          ? "bg-[color-mix(in_srgb,var(--sales-warning)_8%,var(--sales-surface))]"
          : mode === "public_reply"
            ? "bg-sales-surface"
            : "bg-sales-surface"
      )}
    >
      {mode === "public_reply" ? (
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-sales-text-muted">
          <Globe2 size={12} /> Replying publicly · Everyone viewing this post may see your reply.
        </p>
      ) : mode === "private_message" || mode === "reply" ? (
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-sales-text-muted">
          <Lock size={12} /> Private message · Only {selected.conversation.displayName.split(" ")[0]} will receive this.
        </p>
      ) : (
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-sales-text-muted">
          <StickyNote size={12} /> Internal note · Only your team can see this.
        </p>
      )}
      <div className="flex items-start gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="mt-1 inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-[12px] text-sales-text-secondary hover:bg-sales-surface-hover">
            {modes.find((m) => m.id === mode)?.label ?? "Reply"}
            <ChevronDown size={12} />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44">
            {modes.map((m) => (
              <DropdownMenuItem key={m.id} onSelect={() => session.setComposerMode(m.id)}>
                {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <TextArea
          ref={session.composerRef}
          value={session.draft}
          onChange={(e) => {
            session.setDraft(e.target.value);
            if (session.draftedByAi) session.setDraftedByAi(false);
          }}
          placeholder="Write a message…"
          rows={2}
          className="min-h-[44px] max-h-40 flex-1 resize-none"
          aria-label="Message composer"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void session.sendMessage();
            }
          }}
        />
      </div>
      <div className="mt-2 flex items-center gap-1">
        <Tooltip label="Insert">
          <IconButton size="sm" aria-label="Insert" icon={<Plus size={14} />} onClick={() => session.setOverlay("product_picker")} />
        </Tooltip>
        <Tooltip label="Attach">
          <IconButton
            size="sm"
            aria-label="Attach file"
            icon={<Paperclip size={14} />}
            onClick={() => session.showFlash({ title: "Attachments are not connected in this preview" }, "info")}
          />
        </Tooltip>
        <Tooltip label="Add product">
          <IconButton
            size="sm"
            aria-label="Add product"
            icon={<FileText size={14} />}
            onClick={() => session.setOverlay("product_picker")}
          />
        </Tooltip>
        {session.draftedByAi ? (
          <span className="ml-2 text-[11px] text-sales-text-muted">Drafted by SegmiQ</span>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          {session.draftedByAi ? (
            <Button size="sm" variant="ghost" onClick={() => void session.draftWithAi()}>
              Shorter
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Sparkles size={13} />}
            loading={session.drafting}
            onClick={() => void session.draftWithAi()}
          >
            {session.drafting ? "Drafting…" : "Draft with AI"}
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!session.draft.trim() || !session.canReply}
            onClick={() => void session.sendMessage()}
          >
            {sendLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
