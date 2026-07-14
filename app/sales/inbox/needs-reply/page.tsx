import { SalesInboxPageView } from "../SalesInboxPageView";

export const dynamic = "force-dynamic";

export default function AwaitingReplyInboxPage() {
  return (
    <SalesInboxPageView
      breadcrumb="SALES / WHATSAPP SALES HUB / NEEDS REPLY"
      pageTitle="Needs reply"
      initialFilter="awaiting_reply"
      fullPage
    />
  );
}
