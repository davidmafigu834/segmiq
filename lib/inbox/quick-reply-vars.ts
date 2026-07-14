export type QuickReplyContext = {
  customerName?: string | null;
  companyName?: string | null;
  salespersonName?: string | null;
  projectType?: string | null;
  location?: string | null;
};

const VAR_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function applyQuickReplyVariables(template: string, ctx: QuickReplyContext): string {
  const map: Record<string, string> = {
    customer_name: ctx.customerName?.trim() || "there",
    company_name: ctx.companyName?.trim() || "our team",
    salesperson_name: ctx.salespersonName?.trim() || "your sales representative",
    project_type: ctx.projectType?.trim() || "project",
    location: ctx.location?.trim() || "your area",
  };

  return template.replace(VAR_PATTERN, (_, key: string) => map[key.toLowerCase()] ?? "");
}

export const DEFAULT_QUICK_REPLIES: { title: string; body: string }[] = [
  {
    title: "Introduction",
    body:
      "Hello {{customer_name}}, thank you for contacting {{company_name}}. I'm {{salesperson_name}}, and I'll assist you with your {{project_type}} enquiry.",
  },
  {
    title: "Request electricity bill",
    body:
      "Could you please send a copy of your latest electricity bill? It helps us size your {{project_type}} accurately.",
  },
  {
    title: "Site visit offer",
    body:
      "I can arrange a free site visit in {{location}} — what day works best for you this week?",
  },
  {
    title: "Financing info",
    body:
      "We offer flexible payment options for {{project_type}} installations. Would you like me to share the financing details?",
  },
  {
    title: "Follow up on quote",
    body:
      "Hi {{customer_name}}, just checking in on the quotation we sent. Do you have any questions I can help with?",
  },
];
