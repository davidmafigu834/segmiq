import { logAiAction, logAiUsage } from "@/lib/intelligence/audit";
import { appendMessage, openConversation } from "@/lib/intelligence/conversations";
import { portalToolAllowed } from "@/lib/intelligence/registry";
import {
  documentContentAnswer,
  installationDateAnswer,
  looksLikePromptInjection,
  moneyLabel,
  portalPaymentAnswer,
  refuseInjection,
  warrantyExpiryAnswer,
} from "@/lib/intelligence/rules";
import { getPortalProject, listPortalAssets, listPortalDocuments, listPortalSupport, type PortalSettings } from "@/lib/portal/service";

type Identity = {
  clientId: string;
  contactId: string;
  settings: PortalSettings;
};

export async function answerPortalQuestion(identity: Identity, question: string, projectId?: string | null) {
  await logAiUsage({ clientId: identity.clientId, userId: null, feature: "portal_ask", model: "deterministic" });
  const conversationId = await openConversation({
    clientId: identity.clientId,
    userId: null,
    contactId: identity.contactId,
    audience: "PORTAL",
    contextType: "project",
    contextId: projectId,
  }).catch(() => null);
  if (looksLikePromptInjection(question)) {
    await logAiAction({
      clientId: identity.clientId,
      userId: null,
      toolName: "portal_refuse",
      riskLevel: "READ",
      argumentsSummary: { blocked: true },
      resultSummary: "Refused instruction override.",
      approvalRequired: false,
      status: "COMPLETED",
    });
    await appendMessage({ conversationId, clientId: identity.clientId, role: "user", content: question }).catch(() => undefined);
    await appendMessage({ conversationId, clientId: identity.clientId, role: "assistant", content: refuseInjection() }).catch(() => undefined);
    return { answer: refuseInjection(), citations: [] as string[] };
  }
  if (!projectId) return { answer: "Open a project first, then ask about that project.", citations: [] as string[] };
  const project = await getPortalProject(identity.clientId, identity.contactId, projectId, identity.settings);
  if (!project) return { answer: "I can only see projects on your portal.", citations: [] as string[] };
  const financials = project.financials && "paid" in project.financials ? project.financials : null;
  const text = question.trim();
  let tool = "get_my_project";
  let answer = `${project.title} is at ${project.stage}. ${project.nextStep}`;
  if (/\b(paid|payment)\b/i.test(text) && !/\b(owe|balance|outstanding)\b/i.test(text)) {
    tool = "get_my_payment_summary";
    answer = financials ? portalPaymentAnswer(financials.paid ?? 0, (financials.awaitingReview ?? []).reduce((sum, row) => sum + row.amount, 0), financials.currency || "USD") : "Payment amounts are not shown on this portal.";
  } else if (/\b(owe|outstanding|balance)\b/i.test(text)) {
    tool = "get_my_payment_summary";
    answer = financials && financials.outstanding != null
      ? `${moneyLabel(financials.outstanding, financials.currency || "USD")} outstanding.`
      : "I don't have an outstanding balance on your portal.";
  } else if (/\b(when|installation)\b/i.test(text)) {
    tool = "get_my_installation";
    answer = project.installation.scheduleLabel
      ? `Your installation is scheduled for ${project.installation.scheduleLabel}.`
      : installationDateAnswer(null);
  } else if (/\b(commission)/i.test(text)) {
    tool = "get_my_installation";
    answer = project.commissioning
      ? `Yes. Your system was commissioned${project.commissioning.at ? ` on ${new Date(project.commissioning.at as string).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}. Your project is currently at ${project.stage}.`
      : "Commissioning has not yet been recorded as complete.";
  } else if (/\b(serial|inverter|installed|system|warranty)\b/i.test(text)) {
    const assets = await listPortalAssets(identity.clientId, identity.contactId, identity.settings);
    tool = "get_my_assets";
    if (/\bwarranty\b/i.test(text)) {
      tool = "get_my_warranties";
      const warranty = assets.flatMap((asset) => asset.warranties.map((item) => `${asset.name}: ${item.expiresAt ? warrantyExpiryAnswer(item.expiresAt) : item.label}`));
      const docs = await listPortalDocuments(identity.clientId, identity.contactId);
      const warrantyDocs = docs.filter((doc) => /warrant/i.test(`${doc.title} ${doc.category}`));
      answer = warranty.length ? warranty.join("\n") : "The warranty expiry date isn't recorded.";
      if (/\bdocument\b/i.test(text)) {
        tool = "get_my_documents";
        const titles = warrantyDocs.map((doc) => doc.title).join(", ");
        answer = warrantyDocs.length
          ? documentContentAnswer(`Warranty documents shared with you: ${titles}.`)
          : "No warranty document has been shared on your portal.";
      }
    } else if (/\bserial\b/i.test(text)) {
      const withSerial = assets.filter((asset) => asset.serialNumber);
      answer = withSerial.length ? withSerial.map((asset) => `${asset.name}: ${asset.serialNumber}`).join("\n") : "Serial numbers are not shown on this portal.";
    } else {
      answer = assets.length ? assets.map((asset) => asset.name).join(", ") : "Installed equipment has not been recorded on your portal yet.";
    }
  } else if (/\bsupport\b/i.test(text)) {
    tool = "get_my_support_cases";
    const cases = await listPortalSupport(identity.clientId, identity.contactId);
    answer = cases.length ? cases.map((item) => `${item.status}: ${item.message}`).join("\n") : "You have no support requests on this portal.";
  }
  if (!portalToolAllowed(tool)) return { answer: refuseInjection(), citations: [] as string[] };
  await appendMessage({ conversationId, clientId: identity.clientId, role: "assistant", content: answer }).catch(() => undefined);
  return { answer, citations: ["Your project", "Your payments", "Your installed equipment"] };
}
