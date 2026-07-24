import { graphCall } from "@/lib/facebook/graph";

export type FbFormQuestionOption = {
  key: string;
  value: string;
};

export type FbFormQuestion = {
  key: string;
  label: string;
  type: string;
  options: FbFormQuestionOption[];
};

type MetaQuestion = {
  key?: string;
  label?: string;
  type?: string;
  options?: Array<{ key?: string; value?: string } | string>;
};

const CONTACT_FIELD_TYPES = new Set([
  "EMAIL",
  "PHONE",
  "PHONE_NUMBER",
  "FULL_NAME",
  "FIRST_NAME",
  "LAST_NAME",
]);

const CONTACT_KEY_RE =
  /^(email|e-mail|phone|phone_number|mobile|tel|full_name|first_name|last_name|name)$/i;

export function isContactFormQuestion(q: Pick<FbFormQuestion, "key" | "type" | "label">): boolean {
  if (CONTACT_FIELD_TYPES.has((q.type || "").toUpperCase())) return true;
  if (CONTACT_KEY_RE.test(q.key)) return true;
  const label = (q.label || "").toLowerCase();
  return (
    label === "email" ||
    label === "phone" ||
    label === "phone number" ||
    label === "full name" ||
    label === "first name" ||
    label === "last name"
  );
}

export function normalizeMetaFormQuestions(raw: MetaQuestion[] | null | undefined): FbFormQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: FbFormQuestion[] = [];
  for (const q of raw) {
    const key = typeof q.key === "string" ? q.key.trim() : "";
    if (!key) continue;
    const label = (typeof q.label === "string" && q.label.trim()) || key;
    const type = (typeof q.type === "string" && q.type.trim()) || "CUSTOM";
    const options: FbFormQuestionOption[] = [];
    if (Array.isArray(q.options)) {
      for (const opt of q.options) {
        if (typeof opt === "string") {
          const value = opt.trim();
          if (value) options.push({ key: value, value });
          continue;
        }
        const value =
          (typeof opt.value === "string" && opt.value.trim()) ||
          (typeof opt.key === "string" && opt.key.trim()) ||
          "";
        if (!value) continue;
        const optKey =
          (typeof opt.key === "string" && opt.key.trim()) || value;
        options.push({ key: optKey, value });
      }
    }
    out.push({ key, label, type, options });
  }
  return out;
}

export async function fetchFacebookFormQuestions(opts: {
  formId: string;
  accessToken: string;
  clientId?: string;
}): Promise<{ ok: true; questions: FbFormQuestion[]; formName?: string } | { ok: false; error: string; tokenExpired?: boolean }> {
  const fields = encodeURIComponent("id,name,questions");
  const result = await graphCall<{
    id?: string;
    name?: string;
    questions?: MetaQuestion[];
  }>(`/${opts.formId}?fields=${fields}`, opts.accessToken, {
    clientId: opts.clientId,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error.message || "Failed to fetch form questions",
      tokenExpired: result.tokenExpired,
    };
  }

  return {
    ok: true,
    questions: normalizeMetaFormQuestions(result.data?.questions),
    formName: result.data?.name,
  };
}

export function parseStoredFormQuestions(raw: unknown): FbFormQuestion[] {
  if (!Array.isArray(raw)) return [];
  return normalizeMetaFormQuestions(raw as MetaQuestion[]);
}
