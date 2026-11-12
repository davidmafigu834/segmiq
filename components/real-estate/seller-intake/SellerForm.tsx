"use client";

import { useState, useEffect, type ReactNode } from "react";
import { SellerMandateStatus, type SellerFormModel } from "@/components/real-estate/seller-intake/SellerMandateExperience";
import { SalesMandateForm } from "@/components/real-estate/seller-intake/SalesMandateForm";
import { OpenMandatePdf, SoleMandatePdf } from "@/components/real-estate/seller-intake/MandatePaper";
import { emptyMarks, openPaper, paperBrand, signedOnToday, solePaper, type MandateMarks } from "@/components/real-estate/seller-intake/mandate-paper-data";
import { SAVE_FAILURE, answersForSave, submitErrors } from "@/lib/real-estate/seller-intake/client-form";

export function SellerForm({ token }: { token: string }) {
  const [form, setForm] = useState<SellerFormModel | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState("draft");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [marks, setMarks] = useState<MandateMarks>(emptyMarks);
  const [pdf, setPdf] = useState(false);

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
    setLoading(false);
    return next;
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

  if (loading) return <Shell><SellerMandateStatus message="Loading the mandate form…" /></Shell>;
  if (!form) return <Shell><SellerMandateStatus message={error ?? "This form is not available."} /></Shell>;
  if (status === "submitted" || status === "accepted") {
    const brand = paperBrand({ name: form.agencyName, phone: form.phone, signedOn: signedOnToday() });
    return (
      <Shell>
        {pdf ? (
          <div className="mx-auto max-w-[760px] space-y-4">
            <button type="button" onClick={() => setPdf(false)} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-sales-border bg-sales-surface px-4 text-[14px] font-semibold">Back to the file</button>
            {form.kind === "sole" ? <SoleMandatePdf data={solePaper(answers, marks)} brand={brand} /> : <OpenMandatePdf data={openPaper(answers, marks)} brand={brand} />}
          </div>
        ) : (
          <div className="mx-auto max-w-[720px]">
            <p className="text-[13px] font-medium text-sales-text-muted">Seller finished</p>
            <h1 className="mt-2 font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">{form.kind === "sole" ? "The sole mandate is signed" : "The open mandate is signed"}</h1>
            <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-sales-text-secondary">{form.agencyName} can generate the PDF from these answers and give it to the seller.</p>
            <button type="button" onClick={() => setPdf(true)} className="mt-5 inline-flex h-11 items-center justify-center rounded-[10px] bg-sales-brand px-4 text-[14px] font-semibold text-sales-brand-text">Generate PDF</button>
          </div>
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <SalesMandateForm
        form={form}
        answers={answers}
        error={error}
        fieldErrors={fieldErrors}
        saveState={saveState}
        marks={marks}
        onMarks={(patch) => setMarks((current) => ({ ...current, ...patch }))}
        onAnswer={(key, value) => {
          setAnswers((current) => ({ ...current, [key]: value }));
          setSaveState("idle");
          setFieldErrors((current) => {
            const next = { ...current };
            delete next[key];
            return next;
          });
        }}
        onSave={() => persist(false)}
        onSubmit={() => {
          const errors = submitErrors(form.kind, answers);
          if (errors.length) {
            setFieldErrors(Object.fromEntries(errors.map((item) => [item.key, item.message])));
            setError(errors[0]?.message ?? "Some details are still needed before this form can be sent.");
            return;
          }
          setFieldErrors({});
          void persist(true);
        }}
      />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="sales-dashboard-premium h-dvh overflow-y-auto overscroll-y-contain bg-sales-bg px-4 py-6 text-sales-text-primary" data-re-workspace="true" data-re-form="dark">
      {children}
    </div>
  );
}
