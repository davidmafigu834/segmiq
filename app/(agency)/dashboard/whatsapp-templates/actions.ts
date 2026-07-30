"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizePhoneForWhatsApp } from "@/lib/whatsapp-opener";
import {
  sendTemplateTest,
  type MetaTemplateSendComponent,
} from "@/lib/messaging/meta-whatsapp-templates";

export type DialCodeOption = "263" | "260" | "27" | "254";

export type SendTemplateTestInput = {
  to: string;
  dialCode: DialCodeOption;
  templateName: string;
  language: string;
  status: string;
  bodyParams: string[];
  headerImageUrl?: string;
  headerDocumentUrl?: string;
  buttonUrlSuffix?: string;
};

export type SendTemplateTestResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

async function requireAgencyAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "SUPER_ADMIN") {
    return null;
  }
  return session;
}

function buildComponents(input: SendTemplateTestInput): MetaTemplateSendComponent[] {
  const components: MetaTemplateSendComponent[] = [];

  if (input.headerImageUrl?.trim()) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: input.headerImageUrl.trim() } }],
    });
  } else if (input.headerDocumentUrl?.trim()) {
    components.push({
      type: "header",
      parameters: [{ type: "document", document: { link: input.headerDocumentUrl.trim() } }],
    });
  }

  if (input.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: input.bodyParams.map((text) => ({ type: "text", text: text || " " })),
    });
  }

  if (input.buttonUrlSuffix?.trim()) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: input.buttonUrlSuffix.trim() }],
    });
  }

  return components;
}

export async function sendWhatsAppTemplateTest(
  input: SendTemplateTestInput
): Promise<SendTemplateTestResult> {
  const session = await requireAgencyAdminSession();
  if (!session) {
    return { ok: false, error: "Unauthorized" };
  }

  if (input.status !== "APPROVED") {
    return { ok: false, error: "Only APPROVED templates can be sent" };
  }

  const raw = input.to.trim();
  if (!raw) {
    return { ok: false, error: "Recipient phone number is required" };
  }

  const digits = normalizePhoneForWhatsApp(raw, input.dialCode);
  if (!digits) {
    return {
      ok: false,
      error: "Invalid phone number for the selected country dial code",
    };
  }

  const components = buildComponents(input);
  return sendTemplateTest({
    to: digits,
    name: input.templateName,
    language: input.language,
    components,
  });
}
