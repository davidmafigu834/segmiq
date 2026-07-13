import { SalesInboxPageView } from "../SalesInboxPageView";

export const dynamic = "force-dynamic";

export default function SalesHotLeadsPage() {
  return (
    <SalesInboxPageView
      breadcrumb="SALES / WHATSAPP SALES HUB / HOT LEADS"
      pageTitle="Hot leads"
      initialFilter="hot"
    />
  );
}
