"use client";

import { useMemo, useState, type ReactNode } from "react";
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
import { DEMO_CRM_CUSTOMERS, DEMO_PRODUCTS } from "@/lib/social-inbox/demo-data";
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
              onClick={() => {
                const id = selected?.conversation.conversationId ?? "new";
                session.setQuotations((q) => ({
                  ...q,
                  [id]: {
                    id: "Q-draft",
                    product: item.detectedProduct ?? "Package",
                    amount: "Draft",
                    status: "Draft",
                    sentAgo: "Just now",
                  },
                }));
                setOverlay(null);
                session.showFlash({
                  title: "Quotation draft created",
                  hrefLabel: "Open quotation",
                  href: `${session.seed.quotesBase}${encodeURIComponent(id)}`,
                });
                window.setTimeout(() => {
                  window.location.href = `${session.seed.quotesBase}${encodeURIComponent(id)}`;
                }, 400);
              }}
            >
              Continue to quotation
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-sales-text-secondary">
          We&apos;ll open the SegmiQ quotation flow with this conversation attached. Use Back in the browser to return here.
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
            <Button
              variant="primary"
              onClick={() => {
                session.patchConversation(item.conversationId, (row) => ({ ...row, crmState: "open_deal", primaryLabel: "Open deal" }));
                setOverlay(null);
                session.showFlash({ title: "Deal created", hrefLabel: "Open deal", href: session.seed.dealsBase });
              }}
            >
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
            detail="DMs + Comments"
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
        <p className="text-[14px] font-medium">{conn?.displayName ?? "SegmiQ Equipment"}</p>
        <p className="mt-2 text-[13px] text-sales-text-secondary">
          {provider === "facebook" ? "Messenger · Page comments · Advertisement comments" : "DMs · Comments"}
        </p>
        <p className="mt-3 text-[12px] text-sales-text-muted">
          Connection: {conn?.status === "connected" ? "Healthy" : conn?.status ?? "Unknown"}
        </p>
        <p className="text-[12px] text-sales-text-muted">Last sync: 2 mins ago</p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => session.reconnectChannel(provider)}>
            Reconnect
          </Button>
          <Button size="sm" variant="ghost" onClick={() => session.showFlash({ title: "Change page is managed in Meta" }, "info")}>
            Change page
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
        onConfirm={() => session.disconnectChannel(provider)}
      />
    );
  }
  if (overlay === "match_review") {
    return (
      <PremiumSheet
        size="md"
        title="Possible match"
        onClose={() => setOverlay(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOverlay(null)}>
              Not the same person
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                session.linkCustomer({
                  id: "crm-tendai",
                  name: "Tendai Moyo",
                  phone: "+263 77 214 8831",
                  email: "tendai.moyo@example.co.zw",
                  note: "Matched on name",
                })
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
            <p className="mt-1 font-medium">Tendai Moyo</p>
            <p className="text-[12px] text-sales-text-muted">Facebook</p>
          </div>
          <div className="rounded-[10px] border border-sales-border p-3">
            <p className="text-[11px] font-semibold uppercase text-sales-text-muted">CRM customer</p>
            <p className="mt-1 font-medium">Tendai Moyo</p>
            <p className="text-[12px] text-sales-text-muted">+263 77 214 8831</p>
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
        onConfirm={() => session.resolveConversation(true)}
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
          <div className="flex h-36 items-center justify-center bg-[var(--sales-ink)] text-sales-brand">
            CAT 320
          </div>
          <div className="p-3">
            <p className="font-medium">{item?.origin?.adName ?? item?.detectedProduct ?? "Social post"}</p>
            <p className="mt-1 text-[13px] text-sales-text-secondary">{item?.origin?.caption}</p>
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
  if (overlay === "setup") {
    const labels = ["Connecting Facebook", "Finding recent conversations", "Preparing sales signals", "You're ready."];
    return (
      <PremiumSheet size="sm" title="Setting up Social Inbox…" onClose={() => session.finishSetup()}>
        <ul className="space-y-2 text-[13px] text-sales-text-secondary">
          {labels.map((label, i) => (
            <li key={label} className={i <= session.setupStep ? "text-sales-text-primary" : "text-sales-text-muted"}>
              {i < session.setupStep ? "✓ " : i === session.setupStep ? "· " : "○ "}
              {label}
            </li>
          ))}
        </ul>
        {session.setupStep >= 3 ? (
          <div className="mt-4">
            <p className="text-[13px] text-sales-text-secondary">24 recent conversations found. 5 look like potential sales opportunities.</p>
            <Button className="mt-3" variant="primary" onClick={session.finishSetup}>
              Open Social Inbox
            </Button>
          </div>
        ) : null}
      </PremiumSheet>
    );
  }
  return null;
}

function ConvertLeadDrawer({ session }: { session: SocialInboxSession }) {
  const item = session.selected!.conversation;
  const [name, setName] = useState(item.displayName);
  const [company, setCompany] = useState("");
  const [product, setProduct] = useState(item.detectedProduct ?? "");

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
          <Button variant="primary" loading={session.convertBusy} onClick={() => void session.convertToLead()}>
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
          <FieldLabel htmlFor="si-co">Company</FieldLabel>
          <Input id="si-co" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <FieldLabel htmlFor="si-prod">Interested in</FieldLabel>
          <Input id="si-prod" value={product} onChange={(e) => setProduct(e.target.value)} />
        </div>
        <p className="text-[12px] text-sales-text-muted">
          Source Facebook · Campaign {item.origin?.campaignName ?? "Organic"} · Owner {item.assignedToName ?? "Unassigned"} · Sales
          intent {item.intentScore} Hot
        </p>
        <div>
          <FieldLabel htmlFor="si-sum">Conversation summary</FieldLabel>
          <TextArea id="si-sum" rows={3} defaultValue={session.selected?.intelligence.summary ?? ""} />
        </div>
      </div>
    </PremiumSheet>
  );
}

function LinkCustomerSheet({ session }: { session: SocialInboxSession }) {
  const [q, setQ] = useState("");
  const rows = useMemo(
    () => DEMO_CRM_CUSTOMERS.filter((c) => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase())),
    [q]
  );
  return (
    <PremiumSheet size="md" title="Link to existing customer" onClose={() => session.setOverlay(null)}>
      <SearchInput value={q} onChange={setQ} placeholder="Search customer, phone or email…" />
      <ul className="mt-3 divide-y divide-sales-border">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">{row.name}</p>
              <p className="text-[12px] text-sales-text-muted">
                {row.phone} · {row.note}
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={() => session.linkCustomer(row)}>
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
          <Button variant="primary" onClick={() => session.markNotSales(reason)}>
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
  const rows = DEMO_PRODUCTS.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <PremiumSheet size="sm" title="Add product" onClose={() => session.setOverlay(null)}>
      <SearchInput value={q} onChange={setQ} placeholder="Search products…" />
      <p className="mt-3 text-[11px] font-semibold uppercase text-sales-text-muted">Recent</p>
      <ul className="mt-1">
        {rows.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-[8px] px-2 py-2 text-left hover:bg-sales-surface-hover"
              onClick={() => session.insertProduct(`${p.name} — ${p.detail}`)}
            >
              <span>
                <span className="block text-[13px] font-medium">{p.name}</span>
                <span className="text-[12px] text-sales-text-muted">{p.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
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
                  session.assignTo(member.id, member.name);
                  session.setOverlay(null);
                }}
              >
                <span className="text-[13px] font-medium">{member.name}</span>
                <span className="text-[12px] text-sales-text-muted">
                  {member.name.startsWith("Tawanda") ? "3 open" : member.name.startsWith("Farai") ? "6 open" : "2 open"}
                </span>
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
            <Button size="sm" variant="secondary" onClick={() => session.setFollowUp(session.suggestedThursday)}>
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
