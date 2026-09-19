"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SiFacebook, SiInstagram } from "react-icons/si";
import {
  Button,
  ConfirmDialog,
  FieldLabel,
  Input,
  PremiumSheet,
  SearchInput,
  TextArea,
} from "@/components/sales/ui";
import { formatRelativeTime } from "@/lib/social-inbox/display";
import type { SocialInboxSession } from "./useSocialInboxSession";

export function InboxOverlays({ session }: { session: SocialInboxSession }) {
  const { overlay, setOverlay, selected } = session;
  const item = selected?.conversation;

  if (overlay === "convert_lead" && item) {
    return <ConvertLeadDrawer session={session} />;
  }
  if (overlay === "link_customer") {
    return <LinkCustomerSheet session={session} />;
  }
  if (overlay === "create_quote" && item) {
    const leadId = selected?.intelligence.crm.leadId;
    return (
      <PremiumSheet
        size="md"
        title="Create quotation"
        description={`For ${item.displayName}${item.detectedProduct ? ` · ${item.detectedProduct}` : ""}`}
        onClose={() => setOverlay(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOverlay(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!leadId}
              onClick={() => {
                if (!leadId) return;
                setOverlay(null);
                window.location.href = `${session.seed.quotesBase}${encodeURIComponent(leadId)}`;
              }}
            >
              Continue to quotation
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-sales-text-secondary">
          {leadId
            ? "We'll open the quotation flow with this conversation attached."
            : "Convert this conversation to a lead first, then create a quotation."}
        </p>
      </PremiumSheet>
    );
  }
  if (overlay === "create_deal" && item) {
    return (
      <PremiumSheet
        size="sm"
        title="Create deal"
        description={`Start a deal for ${item.displayName}`}
        onClose={() => setOverlay(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOverlay(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={session.dealBusy} onClick={() => void session.createDeal()}>
              Create deal
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-sales-text-secondary">
          {item.detectedProduct ?? "Social opportunity"} · {item.displayName}
        </p>
      </PremiumSheet>
    );
  }
  if (overlay === "connect_channels") {
    return (
      <PremiumSheet
        size="md"
        title="Connect social channels"
        description="You'll manage account permissions through Meta."
        onClose={() => setOverlay(null)}
        footer={
          <Button variant="secondary" onClick={() => setOverlay(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          <ChannelConnectRow
            name="Facebook"
            detail="Messenger + Page comments"
            icon={<SiFacebook size={18} className="text-[#1877F2]" />}
            onConnect={() => session.connectChannels()}
          />
          <ChannelConnectRow
            name="Instagram"
            detail="DMs + Comments, via the same Facebook Page"
            icon={<SiInstagram size={18} className="text-[#E1306C]" />}
            onConnect={() => session.connectChannels()}
          />
        </div>
      </PremiumSheet>
    );
  }
  if (overlay === "manage_facebook" || overlay === "manage_instagram") {
    const provider = overlay === "manage_facebook" ? "facebook" : "instagram";
    const conn = session.connections.find((c) => c.provider === provider);
    return (
      <PremiumSheet
        size="md"
        title={provider === "facebook" ? "Facebook" : "Instagram"}
        description="Connected page"
        onClose={() => setOverlay(null)}
        footer={
          <div className="flex w-full justify-between">
            <Button variant="danger" onClick={() => setOverlay(provider === "facebook" ? "disconnect_facebook" : "disconnect_instagram")}>
              Disconnect
            </Button>
            <Button variant="secondary" onClick={() => setOverlay(null)}>
              Done
            </Button>
          </div>
        }
      >
        <p className="text-[14px] font-medium">{conn?.displayName ?? (provider === "facebook" ? "Facebook Page" : "Instagram")}</p>
        <p className="mt-2 text-[13px] text-sales-text-secondary">
          {provider === "facebook" ? "Messenger · Page comments · Advertisement comments" : "DMs · Comments"}
        </p>
        <p className="mt-3 text-[12px] text-sales-text-muted">
          Connection: {conn?.status === "connected" ? "Healthy" : conn?.status ?? "Unknown"}
        </p>
        {conn?.lastSyncAt ? (
          <p className="text-[12px] text-sales-text-muted">Last sync: {formatRelativeTime(conn.lastSyncAt)}</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => session.reconnectChannel()}>
            Reconnect
          </Button>
        </div>
      </PremiumSheet>
    );
  }
  if (overlay === "disconnect_facebook" || overlay === "disconnect_instagram") {
    const provider = overlay === "disconnect_facebook" ? "facebook" : "instagram";
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && setOverlay(null)}
        title={`Disconnect ${provider === "facebook" ? "Facebook" : "Instagram"}?`}
        description="New messages and comments will stop appearing in Social Inbox. Existing SegmiQ conversations will remain available."
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => void session.disconnectChannel(provider)}
      />
    );
  }
  if (overlay === "match_review") {
    const match = selected?.intelligence.crm.match;
    return (
      <PremiumSheet
        size="md"
        title="Possible match"
        onClose={() => setOverlay(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => void session.rejectMatch()}>
              Not the same person
            </Button>
            <Button
              variant="primary"
              disabled={!match?.contactId}
              onClick={() =>
                match?.contactId
                  ? void session.linkCustomer({
                      id: match.contactId,
                      name: match.name,
                      phone: "",
                      email: "",
                      note: match.reason,
                    })
                  : undefined
              }
            >
              Link profiles
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[10px] border border-sales-border p-3">
            <p className="text-[11px] font-semibold uppercase text-sales-text-muted">Social profile</p>
            <p className="mt-1 font-medium">{item?.displayName}</p>
            <p className="text-[12px] text-sales-text-muted">{item?.username ? `@${item.username}` : "Facebook"}</p>
          </div>
          <div className="rounded-[10px] border border-sales-border p-3">
            <p className="text-[11px] font-semibold uppercase text-sales-text-muted">CRM customer</p>
            <p className="mt-1 font-medium">{match?.name ?? "No match yet"}</p>
            <p className="text-[12px] text-sales-text-muted">{match?.reason ?? "Search from Link customer if this isn't right."}</p>
          </div>
        </div>
      </PremiumSheet>
    );
  }
  if (overlay === "not_sales") {
    return <NotSalesSheet session={session} />;
  }
  if (overlay === "resolve_confirm") {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && setOverlay(null)}
        title="This opportunity is still open."
        description="Resolve conversation anyway?"
        confirmLabel="Resolve"
        onConfirm={() => void session.resolveConversation(true)}
      />
    );
  }
  if (overlay === "product_picker") {
    return <ProductPicker session={session} />;
  }
  if (overlay === "post_preview") {
    return (
      <PremiumSheet size="md" title="Original post" onClose={() => setOverlay(null)}>
        <div className="overflow-hidden rounded-[10px] border border-sales-border">
          <div className="p-3">
            <p className="font-medium">{item?.origin?.adName ?? item?.detectedProduct ?? "Social post"}</p>
            {item?.origin?.caption ? (
              <p className="mt-1 text-[13px] text-sales-text-secondary">{item.origin.caption}</p>
            ) : (
              <p className="mt-1 text-[13px] text-sales-text-muted">No caption stored for this post yet.</p>
            )}
            {item?.origin?.permalink ? (
              <a
                href={item.origin.permalink}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-[12px] font-medium text-sales-text-primary"
              >
                Open on Facebook
              </a>
            ) : null}
          </div>
        </div>
      </PremiumSheet>
    );
  }
  if (overlay === "what_should_i_do") {
    return <AssignOrAdviseSheet session={session} />;
  }
  if (overlay === "tour") {
    return <TourSheet session={session} />;
  }
  return null;
}

function ConvertLeadDrawer({ session }: { session: SocialInboxSession }) {
  const item = session.selected!.conversation;
  const [name, setName] = useState(item.displayName);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState(session.selected?.intelligence.summary ?? "");

  return (
    <PremiumSheet
      size="md"
      title="Convert to lead"
      description="We'll bring the useful conversation context with them."
      onClose={() => session.setOverlay(null)}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => session.setOverlay(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={session.convertBusy}
            onClick={() => void session.convertToLead({ name, phone, notes })}
          >
            {session.convertBusy ? "Converting…" : "Convert to lead"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <FieldLabel htmlFor="si-name">Name</FieldLabel>
          <Input id="si-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="si-phone">Phone</FieldLabel>
          <Input id="si-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
        </div>
        <p className="text-[12px] text-sales-text-muted">
          Source Facebook · Campaign {item.origin?.campaignName ?? "Organic"} · Owner {item.assignedToName ?? "Unassigned"} · Sales
          intent {item.intentScore}
        </p>
        <div>
          <FieldLabel htmlFor="si-sum">Conversation summary</FieldLabel>
          <TextArea id="si-sum" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
    </PremiumSheet>
  );
}

function LinkCustomerSheet({ session }: { session: SocialInboxSession }) {
  const [q, setQ] = useState(session.selected?.conversation.displayName ?? "");
  const [rows, setRows] = useState<Array<{ id: string; name: string; phone?: string | null; email?: string | null; note?: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ limit: "12" });
      if (q.trim()) params.set("q", q.trim());
      void fetch(`/api/contacts/list?${params.toString()}`, { signal: controller.signal })
        .then(async (res) => {
          const data = (await res.json()) as { contacts?: Array<{ id: string; name: string; phone?: string | null; email?: string | null }> };
          setRows(
            (data.contacts ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              email: c.email,
              note: [c.phone, c.email].filter(Boolean).join(" · "),
            }))
          );
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [q]);

  return (
    <PremiumSheet size="md" title="Link to existing customer" onClose={() => session.setOverlay(null)}>
      <SearchInput value={q} onChange={setQ} placeholder="Search customer, phone or email…" />
      <ul className="mt-3 divide-y divide-sales-border">
        {loading && rows.length === 0 ? (
          <li className="py-3 text-[13px] text-sales-text-muted">Searching…</li>
        ) : null}
        {!loading && rows.length === 0 ? (
          <li className="py-3 text-[13px] text-sales-text-muted">No matching customers.</li>
        ) : null}
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{row.name}</p>
              <p className="text-[12px] text-sales-text-muted">{row.note || "No contact details"}</p>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                void session.linkCustomer({
                  id: row.id,
                  name: row.name,
                  phone: row.phone ?? "",
                  email: row.email ?? "",
                  note: row.note ?? "",
                })
              }
            >
              Link
            </Button>
          </li>
        ))}
      </ul>
    </PremiumSheet>
  );
}

function NotSalesSheet({ session }: { session: SocialInboxSession }) {
  const [reason, setReason] = useState("General engagement");
  return (
    <PremiumSheet
      size="sm"
      title="Not a sales opportunity"
      onClose={() => session.setOverlay(null)}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => session.setOverlay(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void session.markNotSales(reason)}>
            Mark not sales
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-1">
        {["General engagement", "Support request", "Spam", "Job enquiry", "Existing conversation", "Other"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`rounded-[8px] px-3 py-2 text-left text-[13px] ${reason === r ? "bg-sales-surface-hover font-medium" : "hover:bg-sales-bg"}`}
          >
            {r}
          </button>
        ))}
      </div>
    </PremiumSheet>
  );
}

function ProductPicker({ session }: { session: SocialInboxSession }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Array<{ id: string; name: string; detail: string }>>([]);
  const detected = session.selected?.conversation.detectedProduct;

  useEffect(() => {
    if (!session.seed.clientId) return;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "12", status: "ACTIVE" });
      if (q.trim()) params.set("q", q.trim());
      void fetch(`/api/clients/${session.seed.clientId}/products?${params.toString()}`, { signal: controller.signal })
        .then(async (res) => {
          const data = (await res.json()) as { items?: Array<{ id: string; name: string; sku?: string | null; brand?: string | null }> };
          setRows(
            (data.items ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              detail: [p.brand, p.sku].filter(Boolean).join(" · "),
            }))
          );
        })
        .catch(() => setRows([]));
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [q, session.seed.clientId]);

  return (
    <PremiumSheet size="sm" title="Add product" onClose={() => session.setOverlay(null)}>
      <SearchInput value={q} onChange={setQ} placeholder="Search products…" />
      {detected ? (
        <button
          type="button"
          className="mt-3 w-full rounded-[8px] px-2 py-2 text-left hover:bg-sales-surface-hover"
          onClick={() => session.insertProduct(detected)}
        >
          <span className="block text-[11px] font-semibold uppercase text-sales-text-muted">From this conversation</span>
          <span className="block text-[13px] font-medium">{detected}</span>
        </button>
      ) : null}
      <p className="mt-3 text-[11px] font-semibold uppercase text-sales-text-muted">Catalog</p>
      <ul className="mt-1">
        {rows.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-[8px] px-2 py-2 text-left hover:bg-sales-surface-hover"
              onClick={() => session.insertProduct(p.detail ? `${p.name} — ${p.detail}` : p.name)}
            >
              <span>
                <span className="block text-[13px] font-medium">{p.name}</span>
                {p.detail ? <span className="text-[12px] text-sales-text-muted">{p.detail}</span> : null}
              </span>
            </button>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="px-2 py-2 text-[12px] text-sales-text-muted">No catalog matches. Type a name and it can still be inserted below.</li>
        ) : null}
      </ul>
      {q.trim() ? (
        <Button className="mt-2" size="sm" variant="secondary" onClick={() => session.insertProduct(q.trim())}>
          Insert “{q.trim()}”
        </Button>
      ) : null}
    </PremiumSheet>
  );
}

function AssignOrAdviseSheet({ session }: { session: SocialInboxSession }) {
  const item = session.selected?.conversation;
  const unassigned = item && !item.assignedToId;
  return (
    <PremiumSheet
      size="sm"
      title={unassigned ? "Assign conversation" : "Recommended next step"}
      onClose={() => session.setOverlay(null)}
    >
      {unassigned ? (
        <ul className="space-y-1">
          {session.team.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left hover:bg-sales-surface-hover"
                onClick={() => {
                  void session.assignTo(member.id, member.name);
                  session.setOverlay(null);
                }}
              >
                <span className="text-[13px] font-medium">{member.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="text-[14px] font-semibold">{session.selected?.intelligence.nextAction.label}</p>
          <p className="mt-2 text-[13px] text-sales-text-secondary">
            {session.selected?.intelligence.nextAction.followUpReason ?? session.selected?.intelligence.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" onClick={() => void session.draftWithAi()}>
              Draft follow-up
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void session.setFollowUp(session.suggestedThursday)}>
              Schedule later
            </Button>
          </div>
        </>
      )}
    </PremiumSheet>
  );
}

function TourSheet({ session }: { session: SocialInboxSession }) {
  const steps = [
    { title: "For You", body: "SegmiQ prioritises conversations that deserve your attention." },
    { title: "Sales Context", body: "See buying intent, customer history and deals without leaving the conversation." },
    { title: "Turn conversations into revenue", body: "Create leads, deals, quotations and follow-ups directly from here." },
  ];
  const step = steps[session.tourStep] ?? steps[0]!;
  return (
    <PremiumSheet
      size="sm"
      title={step.title}
      onClose={session.finishTour}
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" onClick={session.finishTour}>
            Skip
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (session.tourStep >= 2) session.finishTour();
              else session.setTourStep((n) => n + 1);
            }}
          >
            {session.tourStep >= 2 ? "Finish" : "Next"}
          </Button>
        </div>
      }
    >
      <p className="text-[13px] text-sales-text-secondary">{step.body}</p>
      <p className="mt-3 text-[11px] text-sales-text-muted">{session.tourStep + 1} / 3</p>
    </PremiumSheet>
  );
}

function ChannelConnectRow({
  name,
  detail,
  icon,
  onConnect,
}: {
  name: string;
  detail: string;
  icon: ReactNode;
  onConnect: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-sales-border px-3 py-3">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{name}</p>
        <p className="text-[12px] text-sales-text-muted">{detail}</p>
      </div>
      <Button size="sm" variant="primary" onClick={onConnect}>
        Connect
      </Button>
    </div>
  );
}
