import { DemoCompanyFrame, DemoRecordList, type DemoRecord } from "@/components/demo/DemoCompanyFrame";
import { DemoSocialThreadList } from "@/components/demo/DemoSocialPreview";
import { buildDemoReports, buildDemoSocialThreads } from "@/lib/demo/adapters/experience";
import { loadDemoDatasetForClient } from "@/lib/demo/provider";
import { formatDealCurrency } from "@/lib/sales/format";

type PageKind = "products" | "inventory" | "packages" | "documents" | "reports" | "agent" | "social";

const COPY: Record<PageKind, { breadcrumb: string; pageTitle: string; title: string; description: string }> = {
  products: {
    breadcrumb: "PRODUCTS",
    pageTitle: "Products",
    title: "Products",
    description: "Fictional catalogue for this demonstration. Prices are examples, and nothing here is a live product record.",
  },
  inventory: {
    breadcrumb: "INVENTORY",
    pageTitle: "Inventory",
    title: "Inventory",
    description: "Fictional stock for the demonstration catalogue. Nothing is reserved or dispatched.",
  },
  packages: {
    breadcrumb: "PACKAGES",
    pageTitle: "Packages",
    title: "Packages",
    description: "Fictional groups from the demonstration catalogue. These are not live packages.",
  },
  documents: {
    breadcrumb: "DOCUMENTS",
    pageTitle: "Documents",
    title: "Documents",
    description: "Fictional quotations from this demonstration. Opening one does not send a document.",
  },
  reports: {
    breadcrumb: "REPORTS",
    pageTitle: "Reports",
    title: "Reports",
    description: "Figures are calculated from the fictional demonstration book. Nothing is exported to a live workspace.",
  },
  agent: {
    breadcrumb: "AGENT",
    pageTitle: "SegmiQ Agent",
    title: "SegmiQ Agent",
    description: "Simulated suggestions from the demonstration book. The agent does not message anyone or change a live workspace.",
  },
  social: {
    breadcrumb: "SOCIAL INBOX",
    pageTitle: "Social Inbox",
    title: "Social Inbox",
    description: "Simulated social conversations from the same fictional WhatsApp book. Nothing is connected to Facebook or Instagram.",
  },
};

function money(amount: number, currency: string): string {
  return formatDealCurrency(amount, { currency });
}

export async function DemoManagerPage({
  clientId,
  userId,
  role,
  userName,
  page,
}: {
  clientId: string;
  userId: string;
  role: string;
  userName: string;
  page: PageKind;
}) {
  const dataset = await loadDemoDatasetForClient(clientId);
  const copy = COPY[page];
  if (!dataset) {
    return (
      <DemoCompanyFrame userName={userName} breadcrumbPage={copy.breadcrumb} pageTitle={copy.pageTitle} title={copy.title} description="This demonstration could not be loaded.">
        <DemoRecordList rows={[]} empty="Open the guest link again." />
      </DemoCompanyFrame>
    );
  }

  let body = null;
  if (page === "social") {
    body = (
      <DemoSocialThreadList
        threads={buildDemoSocialThreads(dataset, userId, role)}
        inboxBase="/client/inbox?conversation="
        empty="This company view has no simulated conversations yet."
      />
    );
  } else if (page === "reports") {
    const report = buildDemoReports(dataset, userId, role);
    const rows: DemoRecord[] = [
      { id: "leads", title: "Leads", detail: `${report.kpis.leadsCreated.value} fictional leads in this view.` },
      { id: "won", title: "Deals won", detail: `${report.kpis.dealsWon.value} won. ${money(report.kpis.dealsWon.wonValue, report.meta.currency)}.` },
      { id: "pipeline", title: "Open pipeline", detail: money(report.kpis.pipelineValue.value, report.meta.currency), href: "/client/leads/pipeline" },
      ...report.funnel.map((stage) => ({
        id: stage.id,
        title: stage.label,
        detail: `${stage.count} deals`,
        href: "/client/leads/pipeline",
      })),
    ];
    body = (
      <>
        <p className="text-sm text-sales-text-secondary">{report.insight}</p>
        <DemoRecordList rows={rows} empty="No report figures in this demonstration." />
      </>
    );
  } else if (page === "documents") {
    const rows: DemoRecord[] = dataset.quotations.map((quote) => ({
      id: quote.id,
      title: quote.quote_number ? `Quotation ${quote.quote_number}` : "Quotation",
      detail: `${quote.status} · ${money(Number(quote.total) || 0, quote.currency || "USD")}. Fictional document.`,
      href: "/client/quotations",
    }));
    body = <DemoRecordList rows={rows} empty="No fictional documents in this demonstration." />;
  } else if (page === "packages") {
    const groups = new Map<string, number>();
    for (const product of dataset.products) groups.set(product.category || "Catalogue", (groups.get(product.category || "Catalogue") ?? 0) + 1);
    const rows: DemoRecord[] = [...groups.entries()].map(([name, count]) => ({
      id: name,
      title: name,
      detail: `${count} fictional catalogue item${count === 1 ? "" : "s"}. Not a live package.`,
      href: "/client/products",
    }));
    body = <DemoRecordList rows={rows} empty="No fictional packages in this demonstration." />;
  } else if (page === "agent") {
    const rows: DemoRecord[] = dataset.followUps.slice(0, 8).map((row) => {
      const lead = dataset.leads.find((item) => item.id === row.leadId);
      return {
        id: row.id,
        title: row.label,
        detail: `${lead?.name ?? "Customer"}. Simulated suggestion. Nothing is sent.`,
        href: "/client/leads/pipeline",
      };
    });
    body = <DemoRecordList rows={rows} empty="No simulated agent suggestions in this demonstration." />;
  } else {
    const rows: DemoRecord[] = dataset.products.map((product) => ({
      id: product.id,
      title: product.name,
      detail:
        page === "inventory"
          ? `${product.stock} ${product.unit} in the fictional book. ${product.sku}.`
          : `${money(product.selling_price, product.currency)} · ${product.brand || product.category}. Example price only.`,
    }));
    body = <DemoRecordList rows={rows} empty="No fictional catalogue items in this demonstration." />;
  }

  return (
    <DemoCompanyFrame userName={userName} breadcrumbPage={copy.breadcrumb} pageTitle={copy.pageTitle} title={copy.title} description={copy.description}>
      {body}
    </DemoCompanyFrame>
  );
}
