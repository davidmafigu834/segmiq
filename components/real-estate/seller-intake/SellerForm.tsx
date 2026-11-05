"use client";

import { useEffect, useState } from "react";
import { SellerMandateExperience, SellerMandateStatus, stepForError, type SellerFormModel } from "@/components/real-estate/seller-intake/SellerMandateExperience";
import { SAVE_FAILURE, answersForSave, attentionSection, dateOrderError, submitErrors, visibleSections } from "@/lib/real-estate/seller-intake/client-form";

export function SellerForm({ token }: { token: string }) {
  const [form, setForm] = useState<SellerFormModel | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState("draft");
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch(`/api/public/seller-intakes/${token}`);
    const json = await response.json();
    if (!response.ok) {
      setError(json.error ?? "This form is not available.");
      setLoading(false);
      return;
    }
    const next = json.form as SellerFormModel;
    next.agencyName = next.agencyName?.trim() || "your agency";
    const nextAnswers = Object.fromEntries(next.fields.map((field) => [field.key, field.value ?? ""]));
    setForm(next);
    setAnswers(nextAnswers);
    setVersion(json.version ?? 0);
    setStatus(json.status ?? "draft");
    setStep(attentionSection(visibleSections(next.kind, nextAnswers, next.fields), next.fields, nextAnswers));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function persist(submit: boolean) {
    if (!form) return false;
    setSaveState("saving");
    setError(null);
    const response = await fetch(`/api/public/seller-intakes/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: answersForSave(answers, new Set(form.fields.map((field) => field.key))), version, submit }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSaveState("error");
      setError(typeof json.error === "string" && json.error !== "Not found" ? json.error : SAVE_FAILURE);
      return false;
    }
    setVersion(json.version ?? version);
    setStatus(json.status ?? status);
    setSaveState("saved");
    if (submit) await load();
    return true;
  }

  if (loading) return <SellerMandateStatus message="Loading the mandate form…" />;
  if (!form) return <SellerMandateStatus message={error ?? "This form is not available."} />;
  if (status === "submitted" || status === "accepted") {
    return (
      <SellerMandateStatus
        kind={form.kind}
        agencyName={form.agencyName}
        message="Your form has been sent for review"
        detail={`${form.agencyName} can now review your details and follow up about the next steps.`}
      />
    );
  }

  const sections = visibleSections(form.kind, answers, form.fields);
  return (
    <SellerMandateExperience
      form={form}
      answers={answers}
      step={Math.min(step, sections.length - 1)}
      saveState={saveState}
      error={error}
      fieldErrors={fieldErrors}
      onAnswer={(key, value) => {
        setAnswers((current) => ({ ...current, [key]: value }));
        setSaveState("idle");
        setFieldErrors((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }}
      onStep={(index) => {
        setStep(index);
        setFieldErrors({});
      }}
      onBack={() => setStep((current) => Math.max(0, current - 1))}
      onSave={() => void persist(false)}
      onContinue={() => {
        const message = dateOrderError(answers);
        if (message && sections[step] === "instructions") {
          setFieldErrors({ mandateEndDate: message });
          return;
        }
        void persist(false).then((saved) => {
          if (saved) setStep((current) => Math.min(current + 1, sections.length - 1));
        });
      }}
      onSubmit={() => {
        const errors = submitErrors(form.kind, answers);
        if (errors.length) {
          setFieldErrors(Object.fromEntries(errors.map((item) => [item.key, item.message])));
          setStep(stepForError(sections, errors[0].key));
          setError("Some details are still needed before this form can be sent.");
          return;
        }
        setFieldErrors({});
        void persist(true);
      }}
    />
  );
}
