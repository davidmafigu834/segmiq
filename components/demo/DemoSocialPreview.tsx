import { SalesLayout } from "@/components/layouts/SalesLayout";
import { SalesAppShell } from "@/components/sales/shell/SalesAppShell";
import type { loadSalesShellProps } from "@/lib/sales/sales-shell-props";

type Shell = Awaited<ReturnType<typeof loadSalesShellProps>>;

type Thread = {
  leadId: string;
  name: string;
  project: string | null;
  preview: string;
  messages: Array<{ id: string; direction: "customer" | "rep"; text: string; at: string }>;
};

export function DemoSocialThreadList({
  threads,
  inboxBase = "/sales/inbox?conversation=",
  empty = "This view has no simulated conversations yet.",
}: {
  threads: Thread[];
  inboxBase?: string;
  empty?: string;
}) {
  if (threads.length === 0) {
    return (
      <p className="rounded-sales-md border border-sales-border bg-sales-surface p-4 text-sm text-sales-text-muted">
        {empty}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {threads.map((thread) => (
        <article key={thread.leadId} className="rounded-sales-md border border-sales-border bg-sales-surface p-4">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-sales-text">{thread.name}</h2>
              {thread.project ? <p className="text-xs text-sales-text-muted">{thread.project}</p> : null}
            </div>
            <a className="text-xs font-medium underline" href={`${inboxBase}${thread.leadId}`}>
              Open in WhatsApp hub
            </a>
          </header>
          <ul className="space-y-2">
            {thread.messages.slice(-4).map((message) => (
              <li
                key={message.id}
                className={
                  message.direction === "rep"
                    ? "ml-8 rounded-sales-md bg-sales-neutral-100 px-3 py-2 text-sm text-sales-text"
                    : "mr-8 rounded-sales-md bg-sales-bg px-3 py-2 text-sm text-sales-text"
                }
              >
                {message.text}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export function DemoSocialPreview({
  shell,
  threads,
}: {
  shell: Shell;
  threads: Thread[];
}) {
  return (
    <SalesLayout breadcrumb="Sales / SOCIAL INBOX" pageTitle="Social Inbox" hideShellHeader hideShellSidebar contentFlush>
      <SalesAppShell
        {...shell}
        breadcrumb="Sales / Social Inbox"
        title="Social Inbox"
        description="Simulated social conversations from the demonstration book. Nothing is connected to Facebook or Instagram."
      >
        <div className="space-y-4 px-4 py-4 sm:px-6">
          <p className="text-sm text-sales-text-secondary">
            These threads reuse the fictional WhatsApp conversations so you can see how a social enquiry would sit beside a deal. No message is sent.
          </p>
          <DemoSocialThreadList threads={threads} />
        </div>
      </SalesAppShell>
    </SalesLayout>
  );
}
