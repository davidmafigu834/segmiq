"use client";

import { useState, useEffect, useRef } from "react";

export type ConversationalFormField = {
  id: string;
  field_type: "text" | "phone" | "email" | "select" | "multiselect" | "budget" | "textarea" | "yesno";
  label: string;
  placeholder?: string;
  options?: string[];
  is_required: boolean;
  maps_to?: string;
};

export type ConversationalFormStep = {
  id: string;
  title: string;
  fields: ConversationalFormField[];
};

type Props = {
  clientId: string;
  clientName: string;
  clientLogo?: string;
  formTitle: string;
  openingMessage: string;
  steps: ConversationalFormStep[];
  portfolioUrl?: string;
};

type Message = {
  id: string;
  kind: "system" | "user" | "input";
  text?: string;
  field?: ConversationalFormField;
};

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ConversationalForm({
  clientId,
  clientName,
  clientLogo,
  formTitle,
  openingMessage,
  steps,
  portfolioUrl,
}: Props) {
  const allFields = steps.flatMap((s) => s.fields);

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [currentInput, setCurrentInput] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [typingVisible, setTypingVisible] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingVisible]);

  useEffect(() => {
    if (currentFieldIndex >= 0) {
      const t = setTimeout(() => inputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
  }, [currentFieldIndex]);

  function addMessage(message: Message, delay = 0) {
    setTimeout(() => {
      setMessages((prev) => [...prev, message]);
    }, delay);
  }

  function showTypingThenMessage(text: string, baseDelay = 0) {
    setTimeout(() => setTypingVisible(true), baseDelay);
    setTimeout(() => {
      setTypingVisible(false);
      addMessage({ id: crypto.randomUUID(), kind: "system", text });
    }, baseDelay + 900);
  }

  function handleStart() {
    setStarted(true);
    showTypingThenMessage(openingMessage, 300);
    setTimeout(() => moveToField(0), 1600);
  }

  function moveToField(index: number) {
    if (index >= allFields.length) {
      void handleSubmit();
      return;
    }
    const field = allFields[index]!;
    setCurrentFieldIndex(index);
    showTypingThenMessage(field.label, 200);
    setTimeout(() => {
      addMessage({ id: crypto.randomUUID(), kind: "input", field });
    }, 1300);
  }

  function handleAnswer(field: ConversationalFormField, answer: string | string[]) {
    const displayAnswer = Array.isArray(answer) ? answer.join(", ") : answer;
    const key = field.maps_to ?? field.id;
    setAnswers((prev) => ({ ...prev, [key]: answer }));
    setMessages((prev) => prev.filter((m) => m.kind !== "input"));
    addMessage({ id: crypto.randomUUID(), kind: "user", text: displayAnswer });
    setCurrentInput("");
    setSelectedOptions([]);
    setTimeout(() => moveToField(currentFieldIndex + 1), 400);
  }

  function handleSkip(field: ConversationalFormField) {
    if (field.is_required) return;
    setMessages((prev) => prev.filter((m) => m.kind !== "input"));
    addMessage({ id: crypto.randomUUID(), kind: "user", text: "Skip" });
    setTimeout(() => moveToField(currentFieldIndex + 1), 400);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setTypingVisible(true);
    setSubmitError(false);
    try {
      const res = await fetch("/api/leads/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, formData: answers, source: "LANDING_PAGE" }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setTypingVisible(false);
      setSubmitted(true);
      const thankYou = `Thank you! We have everything we need. Our team will be in touch with you shortly.${
        portfolioUrl
          ? ` While you wait, you can browse our completed projects here: ${portfolioUrl}`
          : ""
      }`;
      addMessage({ id: crypto.randomUUID(), kind: "system", text: thankYou });
    } catch {
      setTypingVisible(false);
      addMessage({
        id: crypto.randomUUID(),
        kind: "system",
        text: "Something went wrong submitting your information. Please try again.",
      });
      setSubmitError(true);
      setSubmitting(false);
    }
  }

  const initials = getInitials(clientName);

  if (!started) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F7F4EF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
          fontFamily: "var(--fw-font-body, system-ui)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          {clientLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clientLogo}
              alt={clientName}
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                objectFit: "cover",
                marginBottom: 16,
                border: "2px solid rgba(28,20,16,0.1)",
              }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#1C1410",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                fontSize: 20,
                fontWeight: 700,
                color: "#D4FF4F",
                fontFamily: "var(--fw-font-body, system-ui)",
              }}
            >
              {initials}
            </div>
          )}
          <p
            style={{
              fontFamily: "var(--fw-font-body, system-ui)",
              fontSize: 13,
              fontWeight: 700,
              color: "#8C7B6B",
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {clientName}
          </p>
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 480,
            background: "#FFFFFF",
            borderRadius: 24,
            border: "0.5px solid rgba(28,20,16,0.08)",
            padding: "36px 32px",
            textAlign: "center",
            boxShadow: "0 4px 24px rgba(28,20,16,0.06)",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--fw-font-display, Georgia, serif)",
              fontSize: "clamp(22px, 4vw, 30px)",
              color: "#1C1410",
              margin: "0 0 16px",
              lineHeight: 1.2,
              letterSpacing: "-0.2px",
            }}
          >
            {formTitle}
          </h1>
          <p
            style={{
              fontFamily: "var(--fw-font-body, system-ui)",
              fontSize: 15,
              color: "#8C7B6B",
              lineHeight: 1.7,
              margin: "0 0 32px",
            }}
          >
            We have a few questions to make sure our team knows exactly what you are looking for
            before we reach out.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 28,
              color: "#8C7B6B",
            }}
          >
            <i className="ti ti-clock" style={{ fontSize: 14 }} />
            <span style={{ fontFamily: "var(--fw-font-body, system-ui)", fontSize: 13 }}>
              Takes about {Math.max(1, Math.ceil(allFields.length * 0.5))} minute
              {Math.ceil(allFields.length * 0.5) !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={handleStart}
            style={{
              width: "100%",
              height: 52,
              background: "#1C1410",
              color: "#D4FF4F",
              border: "none",
              borderRadius: 14,
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "var(--fw-font-body, system-ui)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "opacity 0.15s ease",
            }}
          >
            Let&apos;s get started
            <i className="ti ti-arrow-right" style={{ fontSize: 16 }} />
          </button>
        </div>

        <p
          style={{
            marginTop: 24,
            fontFamily: "var(--fw-font-body, system-ui)",
            fontSize: 11,
            color: "#B4A898",
          }}
        >
          Powered by Leadstaq
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F7F4EF",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--fw-font-body, system-ui)",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
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
        <div>
          <p
            style={{
              fontFamily: "var(--fw-font-body, system-ui)",
              fontSize: 14,
              fontWeight: 700,
              color: "#1C1410",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {clientName}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <div
              style={{ width: 6, height: 6, borderRadius: "50%", background: "#2E7D5E" }}
            />
            <p
              style={{
                fontFamily: "var(--fw-font-body, system-ui)",
                fontSize: 11,
                color: "#8C7B6B",
                margin: 0,
              }}
            >
              Online
            </p>
          </div>
        </div>

        {!submitted && allFields.length > 0 && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <p
              style={{
                fontFamily: "var(--fw-font-body, system-ui)",
                fontSize: 11,
                color: "#8C7B6B",
                margin: "0 0 4px",
              }}
            >
              {Math.max(0, currentFieldIndex)} of {allFields.length}
            </p>
            <div
              style={{
                width: 80,
                height: 3,
                background: "rgba(28,20,16,0.08)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: 3,
                  background: "#1C1410",
                  borderRadius: 2,
                  width: `${Math.round(
                    (Math.max(0, currentFieldIndex) / allFields.length) * 100
                  )}%`,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 140,
        }}
      >
        {messages.map((msg) => {
          if (msg.kind === "system") {
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  maxWidth: "80%",
                  alignSelf: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#1C1410",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#D4FF4F",
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div
                  style={{
                    background: "#FFFFFF",
                    border: "0.5px solid rgba(28,20,16,0.08)",
                    borderRadius: "18px 18px 18px 4px",
                    padding: "12px 16px",
                    fontSize: 15,
                    color: "#1C1410",
                    lineHeight: 1.6,
                    boxShadow: "0 1px 4px rgba(28,20,16,0.04)",
                  }}
                >
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.kind === "user") {
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: "flex-end",
                  background: "#1C1410",
                  color: "#FFFFFF",
                  borderRadius: "18px 18px 4px 18px",
                  padding: "12px 16px",
                  fontSize: 15,
                  maxWidth: "75%",
                  lineHeight: 1.5,
                }}
              >
                {msg.text}
              </div>
            );
          }

          if (msg.kind === "input" && msg.field) {
            return (
              <InputBubble
                key={msg.id}
                field={msg.field}
                currentInput={currentInput}
                setCurrentInput={setCurrentInput}
                selectedOptions={selectedOptions}
                setSelectedOptions={setSelectedOptions}
                onAnswer={handleAnswer}
                onSkip={handleSkip}
                inputRef={inputRef}
              />
            );
          }

          return null;
        })}

        {typingVisible && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#1C1410",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                color: "#D4FF4F",
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div
              style={{
                background: "#FFFFFF",
                border: "0.5px solid rgba(28,20,16,0.08)",
                borderRadius: "18px 18px 18px 4px",
                padding: "14px 18px",
                display: "flex",
                gap: 5,
                alignItems: "center",
              }}
            >
              {([0, 1, 2] as const).map((i) => (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#B4A898",
                    animation: "typing-dot 1.2s infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {submitError && (
          <button
            onClick={() => { setSubmitError(false); void handleSubmit(); }}
            style={{
              alignSelf: "flex-end",
              background: "none",
              border: "0.5px solid rgba(28,20,16,0.2)",
              borderRadius: 22,
              padding: "8px 18px",
              fontSize: 13,
              color: "#1C1410",
              cursor: "pointer",
              fontFamily: "var(--fw-font-body, system-ui)",
            }}
          >
            Try again →
          </button>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function InputBubble({
  field,
  currentInput,
  setCurrentInput,
  selectedOptions,
  setSelectedOptions,
  onAnswer,
  onSkip,
  inputRef,
}: {
  field: ConversationalFormField;
  currentInput: string;
  setCurrentInput: (v: string) => void;
  selectedOptions: string[];
  setSelectedOptions: (v: string[]) => void;
  onAnswer: (field: ConversationalFormField, answer: string | string[]) => void;
  onSkip: (field: ConversationalFormField) => void;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
}) {
  function handleSubmitText() {
    const val = currentInput.trim();
    if (!val && field.is_required) return;
    if (!val) {
      onSkip(field);
      return;
    }
    onAnswer(field, val);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitText();
    }
  }

  function toggleOption(opt: string) {
    setSelectedOptions(
      selectedOptions.includes(opt)
        ? selectedOptions.filter((o) => o !== opt)
        : [...selectedOptions, opt]
    );
  }

  const inputBase: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    background: "#F7F4EF",
    border: "0.5px solid rgba(28,20,16,0.15)",
    borderRadius: 14,
    fontSize: 15,
    color: "#1C1410",
    outline: "none",
    fontFamily: "var(--fw-font-body, system-ui)",
    boxSizing: "border-box",
  };

  const isChoiceField =
    field.field_type === "select" ||
    field.field_type === "multiselect" ||
    field.field_type === "yesno";

  const isTextField =
    field.field_type === "text" ||
    field.field_type === "phone" ||
    field.field_type === "email" ||
    field.field_type === "budget" ||
    field.field_type === "textarea";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#FFFFFF",
        borderTop: "0.5px solid rgba(28,20,16,0.08)",
        padding: "16px 20px",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
        zIndex: 20,
      }}
    >
      {isChoiceField && (
        <div style={{ marginBottom: field.field_type === "multiselect" ? 0 : 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: field.field_type === "multiselect" ? 12 : 0,
            }}
          >
            {(field.field_type === "yesno"
              ? ["Yes", "No"]
              : field.options ?? []
            ).map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  if (field.field_type === "multiselect") {
                    toggleOption(opt);
                  } else {
                    onAnswer(field, opt);
                  }
                }}
                style={{
                  height: 44,
                  padding: "0 18px",
                  background: selectedOptions.includes(opt) ? "#1C1410" : "#F7F4EF",
                  color: selectedOptions.includes(opt) ? "#D4FF4F" : "#1C1410",
                  border: "0.5px solid rgba(28,20,16,0.12)",
                  borderRadius: 22,
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "var(--fw-font-body, system-ui)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {opt}
              </button>
            ))}
          </div>
          {field.field_type === "multiselect" && selectedOptions.length > 0 && (
            <button
              onClick={() => onAnswer(field, selectedOptions)}
              style={{
                width: "100%",
                height: 48,
                background: "#1C1410",
                color: "#D4FF4F",
                border: "none",
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "var(--fw-font-body, system-ui)",
                cursor: "pointer",
              }}
            >
              Confirm selection →
            </button>
          )}
        </div>
      )}

      {isTextField && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          {field.field_type === "textarea" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={field.placeholder ?? "Type your answer…"}
              rows={3}
              style={{ ...inputBase, resize: "none", lineHeight: 1.5 }}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={
                field.field_type === "email"
                  ? "email"
                  : field.field_type === "phone"
                  ? "tel"
                  : "text"
              }
              inputMode={
                field.field_type === "phone" || field.field_type === "budget"
                  ? "numeric"
                  : undefined
              }
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={field.placeholder ?? "Type your answer…"}
              style={inputBase}
            />
          )}
          <button
            onClick={handleSubmitText}
            disabled={!currentInput.trim() && field.is_required}
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background:
                !currentInput.trim() && field.is_required ? "#EDE9E3" : "#1C1410",
              border: "none",
              cursor:
                !currentInput.trim() && field.is_required ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}
          >
            <i
              className="ti ti-arrow-up"
              style={{
                fontSize: 18,
                color:
                  !currentInput.trim() && field.is_required ? "#B4A898" : "#D4FF4F",
              }}
            />
          </button>
        </div>
      )}

      {!field.is_required && (
        <button
          onClick={() => onSkip(field)}
          style={{
            background: "none",
            border: "none",
            fontSize: 12,
            color: "#B4A898",
            cursor: "pointer",
            marginTop: 10,
            fontFamily: "var(--fw-font-body, system-ui)",
            padding: 0,
          }}
        >
          Skip this question
        </button>
      )}
    </div>
  );
}
