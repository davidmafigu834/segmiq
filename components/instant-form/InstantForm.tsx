"use client";

import { useMemo, useState } from "react";
import type {
  InstantFormCompletion,
  InstantFormConsent,
  InstantFormIntro,
  InstantFormPrivacy,
  InstantFormQuestion,
  InstantFormType,
} from "@/types";
import { answerKey, getVisibleQuestions } from "@/lib/instant-form-helpers";

export type InstantFormConfig = {
  formType: InstantFormType;
  intro: InstantFormIntro;
  questions: InstantFormQuestion[];
  consents: InstantFormConsent[];
  privacy: InstantFormPrivacy;
  completion: InstantFormCompletion;
};

type Props = {
  clientName: string;
  clientLogo?: string;
  formName: string;
  config: InstantFormConfig;
  onSubmit: (answers: Record<string, string>) => Promise<void>;
  preview?: boolean;
};

type Screen = "intro" | "questions" | "review" | "completion";

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function InstantForm({
  clientName,
  clientLogo,
  formName,
  config,
  onSubmit,
  preview = false,
}: Props) {
  const [screen, setScreen] = useState<Screen>("intro");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consentChecked, setConsentChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const visibleQuestions = useMemo(
    () => getVisibleQuestions(config.questions, answers),
    [config.questions, answers]
  );

  const initials = getInitials(clientName);

  function setAnswer(question: InstantFormQuestion, value: string) {
    setAnswers((prev) => ({ ...prev, [answerKey(question)]: value, [question.id]: value }));
  }

  function validateQuestions(): string | null {
    for (const q of visibleQuestions) {
      const val = (answers[answerKey(q)] ?? "").trim();
      if (q.is_required && !val) return `${q.label} is required.`;
    }
    for (const c of config.consents) {
      if (c.is_required && !consentChecked[c.id]) return "Please accept all required consents.";
    }
    return null;
  }

  async function handleSubmit() {
    const validationError = validateQuestions();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {};
      for (const q of visibleQuestions) {
        const key = answerKey(q);
        payload[key] = answers[key] ?? "";
      }
      if (!preview) {
        await onSubmit(payload);
      }
      setScreen("completion");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuestionsContinue() {
    const validationError = validateQuestions();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (config.formType === "higher_intent") {
      setScreen("review");
    } else {
      void handleSubmit();
    }
  }

  if (screen === "intro") {
    return (
      <IntroScreen
        clientName={clientName}
        clientLogo={clientLogo}
        initials={initials}
        intro={config.intro}
        formName={formName}
        onContinue={() => setScreen("questions")}
        preview={preview}
      />
    );
  }

  if (screen === "questions") {
    return (
      <QuestionsScreen
        clientName={clientName}
        clientLogo={clientLogo}
        initials={initials}
        questions={visibleQuestions}
        answers={answers}
        consents={config.consents}
        privacy={config.privacy}
        consentChecked={consentChecked}
        setConsentChecked={setConsentChecked}
        setAnswer={setAnswer}
        error={error}
        submitting={submitting}
        onBack={() => setScreen("intro")}
        onContinue={handleQuestionsContinue}
        preview={preview}
      />
    );
  }

  if (screen === "review") {
    return (
      <ReviewScreen
        clientName={clientName}
        clientLogo={clientLogo}
        initials={initials}
        questions={visibleQuestions}
        answers={answers}
        consents={config.consents}
        consentChecked={consentChecked}
        error={error}
        submitting={submitting}
        onBack={() => setScreen("questions")}
        onSubmit={() => void handleSubmit()}
        preview={preview}
      />
    );
  }

  return (
    <CompletionScreen
      clientName={clientName}
      clientLogo={clientLogo}
      initials={initials}
      completion={config.completion}
      preview={preview}
    />
  );
}

function Shell({
  clientName,
  clientLogo,
  initials,
  children,
  preview,
}: {
  clientName: string;
  clientLogo?: string;
  initials: string;
  children: React.ReactNode;
  preview?: boolean;
}) {
  return (
    <div
      style={{
        minHeight: preview ? "auto" : "100vh",
        background: "#F7F4EF",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--fw-font-body, system-ui)",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderBottom: "0.5px solid rgba(28,20,16,0.08)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {clientLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clientLogo}
            alt={clientName}
            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#1C1410",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#D4FF4F",
            }}
          >
            {initials}
          </div>
        )}
        <p style={{ fontSize: 14, fontWeight: 700, color: "#1C1410", margin: 0 }}>{clientName}</p>
      </div>
      <div style={{ flex: 1, padding: preview ? "20px 16px" : "24px 20px", maxWidth: 560, margin: "0 auto", width: "100%" }}>
        {children}
      </div>
      {!preview ? (
        <p
          style={{
            textAlign: "center",
            padding: "16px",
            fontSize: 11,
            color: "#B4A898",
            margin: 0,
          }}
        >
          Powered by Segmiq
        </p>
      ) : null}
    </div>
  );
}

function IntroScreen({
  clientName,
  clientLogo,
  initials,
  intro,
  formName,
  onContinue,
  preview,
}: {
  clientName: string;
  clientLogo?: string;
  initials: string;
  intro: InstantFormIntro;
  formName: string;
  onContinue: () => void;
  preview?: boolean;
}) {
  const headline = intro.headline || formName;
  const bodyLines =
    intro.layout === "list" && intro.body
      ? intro.body.split("\n").filter(Boolean)
      : null;

  return (
    <Shell clientName={clientName} clientLogo={clientLogo} initials={initials} preview={preview}>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          border: "0.5px solid rgba(28,20,16,0.08)",
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(28,20,16,0.06)",
        }}
      >
        {intro.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={intro.image_url}
            alt=""
            style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
          />
        ) : null}
        <div style={{ padding: "28px 24px" }}>
          <h1
            style={{
              fontFamily: "var(--fw-font-display, Georgia, serif)",
              fontSize: 26,
              color: "#1C1410",
              margin: "0 0 14px",
              lineHeight: 1.2,
            }}
          >
            {headline}
          </h1>
          {bodyLines ? (
            <ul style={{ margin: "0 0 24px", paddingLeft: 20, color: "#8C7B6B", lineHeight: 1.7 }}>
              {bodyLines.map((line) => (
                <li key={line} style={{ marginBottom: 6, fontSize: 15 }}>
                  {line}
                </li>
              ))}
            </ul>
          ) : intro.body ? (
            <p style={{ fontSize: 15, color: "#8C7B6B", lineHeight: 1.7, margin: "0 0 24px" }}>
              {intro.body}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onContinue}
            style={{
              width: "100%",
              height: 50,
              background: "#1877F2",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {intro.button_text || "Continue"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function QuestionsScreen({
  clientName,
  clientLogo,
  initials,
  questions,
  answers,
  consents,
  privacy,
  consentChecked,
  setConsentChecked,
  setAnswer,
  error,
  submitting,
  onBack,
  onContinue,
  preview,
}: {
  clientName: string;
  clientLogo?: string;
  initials: string;
  questions: InstantFormQuestion[];
  answers: Record<string, string>;
  consents: InstantFormConsent[];
  privacy: InstantFormPrivacy;
  consentChecked: Record<string, boolean>;
  setConsentChecked: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setAnswer: (q: InstantFormQuestion, value: string) => void;
  error: string | null;
  submitting: boolean;
  onBack: () => void;
  onContinue: () => void;
  preview?: boolean;
}) {
  return (
    <Shell clientName={clientName} clientLogo={clientLogo} initials={initials} preview={preview}>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          border: "0.5px solid rgba(28,20,16,0.08)",
          padding: "24px 20px",
          boxShadow: "0 4px 24px rgba(28,20,16,0.06)",
        }}
      >
        {questions.map((q) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[answerKey(q)] ?? ""}
            onChange={(v) => setAnswer(q, v)}
          />
        ))}

        {(privacy.policy_url || privacy.disclaimer || consents.length > 0) && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: "0.5px solid rgba(28,20,16,0.08)",
            }}
          >
            {privacy.disclaimer ? (
              <p style={{ fontSize: 12, color: "#8C7B6B", lineHeight: 1.6, margin: "0 0 12px" }}>
                {privacy.disclaimer}
                {privacy.policy_url ? (
                  <>
                    {" "}
                    <a
                      href={privacy.policy_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#1877F2" }}
                    >
                      {privacy.link_text || "Privacy Policy"}
                    </a>
                  </>
                ) : null}
              </p>
            ) : privacy.policy_url ? (
              <p style={{ fontSize: 12, color: "#8C7B6B", margin: "0 0 12px" }}>
                <a
                  href={privacy.policy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#1877F2" }}
                >
                  {privacy.link_text || "Privacy Policy"}
                </a>
              </p>
            ) : null}
            {consents.map((c) => (
              <label
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  marginBottom: 10,
                  fontSize: 13,
                  color: "#1C1410",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!consentChecked[c.id]}
                  onChange={(e) =>
                    setConsentChecked((prev) => ({ ...prev, [c.id]: e.target.checked }))
                  }
                  style={{ marginTop: 3 }}
                />
                <span>
                  {c.label}
                  {c.is_required ? <span style={{ color: "#C0392B" }}> *</span> : null}
                </span>
              </label>
            ))}
          </div>
        )}

        {error ? (
          <p style={{ color: "#C0392B", fontSize: 13, margin: "12px 0 0" }}>{error}</p>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              flex: 1,
              height: 48,
              background: "#EDE9E3",
              color: "#1C1410",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={submitting}
            style={{
              flex: 2,
              height: 48,
              background: "#1877F2",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Submitting…" : "Continue"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: InstantFormQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    background: "#F7F4EF",
    border: "0.5px solid rgba(28,20,16,0.15)",
    borderRadius: 8,
    fontSize: 15,
    color: "#1C1410",
    outline: "none",
    boxSizing: "border-box",
    marginTop: 6,
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 14, fontWeight: 600, color: "#1C1410" }}>
        {question.label}
        {question.is_required ? <span style={{ color: "#C0392B" }}> *</span> : null}
      </label>
      {question.field_type === "multiple_choice" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {(question.options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                background: value === opt ? "#E7F3FF" : "#F7F4EF",
                border: value === opt ? "1.5px solid #1877F2" : "0.5px solid rgba(28,20,16,0.15)",
                borderRadius: 8,
                fontSize: 14,
                color: "#1C1410",
                cursor: "pointer",
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <input
          type={
            question.field_type === "email"
              ? "email"
              : question.field_type === "phone"
                ? "tel"
                : "text"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          style={inputStyle}
        />
      )}
    </div>
  );
}

function ReviewScreen({
  clientName,
  clientLogo,
  initials,
  questions,
  answers,
  consents,
  consentChecked,
  error,
  submitting,
  onBack,
  onSubmit,
  preview,
}: {
  clientName: string;
  clientLogo?: string;
  initials: string;
  questions: InstantFormQuestion[];
  answers: Record<string, string>;
  consents: InstantFormConsent[];
  consentChecked: Record<string, boolean>;
  error: string | null;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
  preview?: boolean;
}) {
  return (
    <Shell clientName={clientName} clientLogo={clientLogo} initials={initials} preview={preview}>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          border: "0.5px solid rgba(28,20,16,0.08)",
          padding: "24px 20px",
          boxShadow: "0 4px 24px rgba(28,20,16,0.06)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--fw-font-display, Georgia, serif)",
            fontSize: 22,
            color: "#1C1410",
            margin: "0 0 8px",
          }}
        >
          Review your answers
        </h2>
        <p style={{ fontSize: 14, color: "#8C7B6B", margin: "0 0 20px" }}>
          Please confirm your information before submitting.
        </p>
        {questions.map((q) => (
          <div
            key={q.id}
            style={{
              padding: "12px 0",
              borderBottom: "0.5px solid rgba(28,20,16,0.08)",
            }}
          >
            <p style={{ fontSize: 12, color: "#8C7B6B", margin: "0 0 4px" }}>{q.label}</p>
            <p style={{ fontSize: 15, color: "#1C1410", margin: 0, fontWeight: 500 }}>
              {answers[answerKey(q)] || "—"}
            </p>
          </div>
        ))}
        {consents.filter((c) => consentChecked[c.id]).length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 12, color: "#8C7B6B", margin: "0 0 8px" }}>Consents</p>
            {consents
              .filter((c) => consentChecked[c.id])
              .map((c) => (
                <p key={c.id} style={{ fontSize: 13, color: "#1C1410", margin: "0 0 4px" }}>
                  ✓ {c.label}
                </p>
              ))}
          </div>
        ) : null}
        {error ? (
          <p style={{ color: "#C0392B", fontSize: 13, margin: "12px 0 0" }}>{error}</p>
        ) : null}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              flex: 1,
              height: 48,
              background: "#EDE9E3",
              color: "#1C1410",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            style={{
              flex: 2,
              height: 48,
              background: "#1877F2",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function CompletionScreen({
  clientName,
  clientLogo,
  initials,
  completion,
  preview,
}: {
  clientName: string;
  clientLogo?: string;
  initials: string;
  completion: InstantFormCompletion;
  preview?: boolean;
}) {
  const ctaHref =
    completion.cta_type === "call"
      ? completion.cta_link
        ? `tel:${completion.cta_link.replace(/\s/g, "")}`
        : undefined
      : completion.cta_link;

  return (
    <Shell clientName={clientName} clientLogo={clientLogo} initials={initials} preview={preview}>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          border: "0.5px solid rgba(28,20,16,0.08)",
          padding: "32px 24px",
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(28,20,16,0.06)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#E8F5E9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 28,
          }}
        >
          ✓
        </div>
        <h2
          style={{
            fontFamily: "var(--fw-font-display, Georgia, serif)",
            fontSize: 24,
            color: "#1C1410",
            margin: "0 0 12px",
          }}
        >
          {completion.headline || "Thank you!"}
        </h2>
        {completion.body ? (
          <p style={{ fontSize: 15, color: "#8C7B6B", lineHeight: 1.7, margin: "0 0 24px" }}>
            {completion.body}
          </p>
        ) : null}
        {completion.cta_type && completion.cta_type !== "none" && ctaHref ? (
          <a
            href={ctaHref}
            target={completion.cta_type === "call" ? undefined : "_blank"}
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 48,
              padding: "0 24px",
              background: "#1877F2",
              color: "#FFFFFF",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {completion.cta_text || "Continue"}
          </a>
        ) : null}
      </div>
    </Shell>
  );
}
