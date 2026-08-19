import { SalesInboxPageView } from "../SalesInboxPageView";

export const dynamic = "force-dynamic";

export default function AwaitingReplyInboxPage() {
  return (
    <SalesInboxPageView
      breadcrumb="SALES / WHATSAPP SALES HUB"
      pageTitle="WhatsApp Sales Hub"
      initialFilter="awaiting_reply"
    />
  );
}
