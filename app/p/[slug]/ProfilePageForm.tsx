"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

type FormFieldDef = {
  id: string;
  field_type: string;
  label: string;
  placeholder?: string | null;
  options?: string[] | null;
  is_required?: boolean | null;
  maps_to?: string | null;
  display_order?: number | null;
};

type FormStepDef = {
  id: string;
  step_number: number;
  title: string;
  form_fields?: FormFieldDef[];
};

const DEFAULT_STEPS: FormStepDef[] = [
  {
    id: "default-1",
    step_number: 1,
    title: "What can we help you with?",
    form_fields: [
      {
        id: "project_type",
        field_type: "select",
        label: "Type of project",
        is_required: false,
        maps_to: "project_type",
        options: ["Construction", "Solar", "Renovation", "Fencing", "Electrical", "Plumbing", "Landscaping", "Other"],
      },
      {
        id: "budget",
        field_type: "select",
        label: "Budget range",
        is_required: false,
        maps_to: "budget",
        options: ["Under $5,000", "$5,000 – $20,000", "$20,000 – $50,000", "$50,000 – $100,000", "Over $100,000"],
      },
    ],
  },
  {
    id: "default-2",
    step_number: 2,
    title: "Tell us about your project",
    form_fields: [
      {
        id: "notes",
        field_type: "textarea",
        label: "Project description",
        placeholder: "Describe what you need done...",
        is_required: false,
        maps_to: "notes",
      },
      {
        id: "timeline",
        field_type: "select",
        label: "Ideal timeline",
        is_required: false,
        maps_to: "timeline",
        options: ["As soon as possible", "Within 1 month", "1–3 months", "3–6 months", "Flexible"],
      },
    ],
  },
  {
    id: "default-3",
    step_number: 3,
    title: "How do we reach you?",
    form_fields: [
      { id: "name", field_type: "text", label: "Full name", placeholder: "Your full name", is_required: true, maps_to: "name" },
      { id: "phone", field_type: "phone", label: "Phone number", placeholder: "+1 555 000 0000", is_required: true, maps_to: "phone" },
      { id: "email", field_type: "email", label: "Email address", placeholder: "you@example.com", is_required: false, maps_to: "email" },
    ],
  },
];

export function ProfilePageForm({
  clientId,
  ctaText,
  formSteps,
}: {
  clientId: string;
  accentColor: string;
  ctaText: string;
  formSteps: FormStepDef[];
}) {
  const steps = formSteps.length > 0 ? formSteps : DEFAULT_STEPS;
  const totalSteps = steps.length;

  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitName, setSubmitName] = useState("");

  const step = steps[currentStep]!;
  const fields = [...(step.form_fields ?? [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.is_required && !values[f.id]?.trim()) {
        newErrors[f.id] = `${f.label} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleNext() {
    if (!validate()) return;
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      await handleSubmit();
    }
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const formData: Record<string, unknown> = { ...values };
      const res = await fetch("/api/public/submit-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, formData }),
      });
      if (res.ok) {
        setSubmitName(values["name"] ?? "");
        setSubmitted(true);
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 20px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#D4FF4F", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1C1410" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 style={{ fontFamily: "var(--fw-font-display), Georgia, serif", fontSize: 24, color: "#1C1410", margin: "0 0 8px", lineHeight: 1.2 }}>
          Thanks{submitName ? `, ${submitName}` : ""}!
        </h3>
        <p style={{ fontFamily: "var(--fw-font-body), system-ui, sans-serif", fontSize: 15, color: "#8C7B6B", margin: 0 }}>
          We&apos;ll be in touch shortly.
        </p>
      </div>
    );
  }

  const isLast = currentStep === totalSteps - 1;

  return (
    <div>
      <style>{`.fw-field:focus { border-color: rgba(28,20,16,0.35) !important; }`}</style>

      {/* Progress bar */}
      <div style={{ height: 3, background: "rgba(28,20,16,0.08)", borderRadius: 2, marginBottom: 28 }}>
        <div style={{ height: 3, background: "#1C1410", borderRadius: 2, transition: "width 0.3s ease", width: `${(currentStep / totalSteps) * 100}%` }} />
      </div>

      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8C7B6B", margin: "0 0 6px", fontFamily: "var(--fw-font-body), system-ui, sans-serif" }}>
        Step {currentStep + 1} of {totalSteps}
      </p>
      <h3 style={{ fontFamily: "var(--fw-font-display), Georgia, serif", fontSize: 20, color: "#1C1410", margin: "0 0 20px", lineHeight: 1.2 }}>
        {step.title}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {fields.map((field) => (
          <div key={field.id}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#4A3828", margin: "0 0 6px", fontFamily: "var(--fw-font-body), system-ui, sans-serif" }}>
              {field.label}
              {field.is_required && <span style={{ marginLeft: 4, color: "#B85C4A" }}>*</span>}
            </label>
            {field.field_type === "select" ? (
              <div style={{ position: "relative" }}>
                <select
                  value={values[field.id] ?? ""}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [field.id]: e.target.value }));
                    setErrors((er) => ({ ...er, [field.id]: "" }));
                  }}
                  className="fw-field"
                  style={{ width: "100%", height: 48, padding: "0 40px 0 14px", background: "#F7F4EF", border: "0.5px solid rgba(28,20,16,0.12)", borderRadius: 12, fontSize: 14, color: "#1C1410", fontFamily: "var(--fw-font-body), system-ui, sans-serif", outline: "none", boxSizing: "border-box", appearance: "none", cursor: "pointer" }}
                >
                  <option value="">Select an option…</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <svg style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            ) : field.field_type === "textarea" ? (
              <textarea
                rows={4}
                placeholder={field.placeholder ?? ""}
                value={values[field.id] ?? ""}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [field.id]: e.target.value }));
                  setErrors((er) => ({ ...er, [field.id]: "" }));
                }}
                className="fw-field"
                style={{ width: "100%", padding: "12px 14px", background: "#F7F4EF", border: "0.5px solid rgba(28,20,16,0.12)", borderRadius: 12, fontSize: 14, color: "#1C1410", fontFamily: "var(--fw-font-body), system-ui, sans-serif", outline: "none", boxSizing: "border-box", resize: "none", display: "block" }}
              />
            ) : (
              <input
                type={field.field_type === "phone" ? "tel" : field.field_type === "email" ? "email" : "text"}
                placeholder={field.placeholder ?? ""}
                value={values[field.id] ?? ""}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [field.id]: e.target.value }));
                  setErrors((er) => ({ ...er, [field.id]: "" }));
                }}
                className="fw-field"
                style={{ width: "100%", height: 48, padding: "0 14px", background: "#F7F4EF", border: "0.5px solid rgba(28,20,16,0.12)", borderRadius: 12, fontSize: 14, color: "#1C1410", fontFamily: "var(--fw-font-body), system-ui, sans-serif", outline: "none", boxSizing: "border-box" }}
              />
            )}
            {errors[field.id] && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#B85C4A", fontFamily: "var(--fw-font-body), system-ui, sans-serif" }}>{errors[field.id]}</p>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
        {currentStep > 0 && (
          <button
            type="button"
            onClick={() => setCurrentStep((s) => s - 1)}
            style={{ height: 50, padding: "0 20px", background: "none", color: "#8C7B6B", border: "0.5px solid rgba(28,20,16,0.12)", borderRadius: 14, fontSize: 14, fontWeight: 600, fontFamily: "var(--fw-font-body), system-ui, sans-serif", cursor: "pointer" }}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          style={{ flex: isLast ? 1 : undefined, marginLeft: isLast ? undefined : "auto", height: isLast ? 52 : 50, padding: "0 28px", background: isLast ? "#D4FF4F" : "#1C1410", color: isLast ? "#1C1410" : "#D4FF4F", border: "none", borderRadius: 14, fontSize: isLast ? 15 : 14, fontWeight: 700, fontFamily: "var(--fw-font-body), system-ui, sans-serif", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLast ? (
            ctaText
          ) : (
            <>Next <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}
