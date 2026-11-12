"use client";

/* Hallmark · genre: modern-minimal · macrostructure: Workbench · design-system: design.md · designed-as-app */

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/sales/ui/Button";
import { RePageHeader, ReSection } from "@/components/real-estate/ui";
import { acqFieldClass, acqLabelClass } from "@/components/real-estate/acquisition/acquisition-ui";
import { reEmbeddedShell, reSalesShell } from "@/components/real-estate/ui/workspace-shell";
import { suggestedUploads } from "@/lib/real-estate/due-diligence/rules";
import { mandateDraftSchema, type MandateDraft } from "@/lib/real-estate/due-diligence/schema";
import { DOCUMENT_LABEL, TENURE_LABEL, type DocumentType, type TenureType } from "@/lib/real-estate/due-diligence/types";

type Slot = { key: string; type: DocumentType; file: File | null };

const defaults: MandateDraft = {
  seller: {
    fullName: "",
    idNumber: "",
    phone: "",
    email: "",
    maritalStatus: "single",
    sellerKind: "individual",
    companyName: "",
    actingCapacity: "owner",
    representativeName: "",
  },
  property: {
    address: "",
    standNumber: "",
    suburb: "",
    city: "",
    propertyType: "residential",
    tenureType: "title_deed",
    askingPriceUsd: null,
    localAuthority: "",
  },
};

function slotsFor(tenure: TenureType): Slot[] {
  return suggestedUploads(tenure).map((type) => ({ key: `${tenure}-${type}`, type, file: null }));
}

export function MandateForm({ clientId, basePath, framed = false }: { clientId: string; basePath: string; framed?: boolean }) {
  const router = useRouter();
  const form = useForm<MandateDraft>({ resolver: zodResolver(mandateDraftSchema), defaultValues: defaults });
  const tenure = form.watch("property.tenureType");
  const sellerKind = form.watch("seller.sellerKind");
  const acting = form.watch("seller.actingCapacity");
  const [slots, setSlots] = useState<Slot[]>(() => slotsFor("title_deed"));
  const [priceText, setPriceText] = useState("");
  const [priceError, setPriceError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [openedId, setOpenedId] = useState<string | null>(null);

  useEffect(() => {
    setSlots((current) => (current.some((slot) => slot.file) ? current : slotsFor(tenure)));
  }, [tenure]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError("");
    setPriceError("");
    const trimmed = priceText.trim();
    if (trimmed && !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      setPriceError("Enter the asking price in US dollars, or leave it blank.");
      return;
    }
    const draft: MandateDraft = {
      ...values,
      property: { ...values.property, askingPriceUsd: trimmed ? Number(trimmed) : null },
    };
    const chosen = slots.filter((slot) => slot.file);
    setBusy(true);
    setProgress("Saving the mandate");
    const created = await fetch(`/api/clients/${clientId}/due-diligence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const createdBody = await created.json().catch(() => null);
    if (created.status === 404) {
      setBusy(false);
      setError("Due diligence is switched off on this deployment.");
      return;
    }
    if (!created.ok || !createdBody?.mandate?.id) {
      setBusy(false);
      setError(createdBody?.error ?? "Could not open the mandate.");
      return;
    }
    const mandateId = String(createdBody.mandate.id);
    setOpenedId(mandateId);
    for (let index = 0; index < chosen.length; index += 1) {
      const slot = chosen[index];
      setProgress(`Uploading ${DOCUMENT_LABEL[slot.type]} (${index + 1} of ${chosen.length})`);
      const body = new FormData();
      body.set("documentType", slot.type);
      body.set("file", slot.file as File);
      const uploaded = await fetch(`/api/clients/${clientId}/due-diligence/${mandateId}/documents`, { method: "POST", body });
      const uploadedBody = await uploaded.json().catch(() => null);
      if (!uploaded.ok) {
        setBusy(false);
        setProgress("");
        setError(uploadedBody?.error ?? "A document could not be uploaded. Open the mandate to add it and run the check.");
        return;
      }
    }
    setProgress(chosen.length > 0 ? "Reading documents and running the checks" : "Running the checks");
    const run = await fetch(`/api/clients/${clientId}/due-diligence/${mandateId}/run`, { method: "POST" });
    if (!run.ok) {
      const runBody = await run.json().catch(() => null);
      setBusy(false);
      setProgress("");
      setError(runBody?.error ?? "The mandate is saved. The check did not finish. Open it and run the check again.");
      return;
    }
    router.push(`${basePath}/${mandateId}`);
  });

  return (
    <form onSubmit={onSubmit} className={framed ? reEmbeddedShell : reSalesShell} noValidate>
      <RePageHeader
        title="New mandate"
        description="Record the seller and the property, then attach the documents for this tenure."
        actions={<Link href={basePath} className="text-[13px] font-medium text-sales-text-secondary underline-offset-2 hover:underline">Back to mandates</Link>}
      />
      {error ? (
        <p role="alert" className="rounded-[var(--re-radius-card,12px)] border border-sales-danger/30 bg-sales-danger-soft px-3 py-2 text-[13px] text-sales-text-primary">
          {error}{" "}
          {openedId ? <Link href={`${basePath}/${openedId}`} className="font-semibold underline-offset-2 hover:underline">Open the mandate</Link> : null}
        </p>
      ) : null}
      <ReSection id="seller" title="Seller">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" error={form.formState.errors.seller?.fullName?.message}>
            <input className={acqFieldClass} autoComplete="name" {...form.register("seller.fullName")} />
          </Field>
          <Field label="National ID number" error={form.formState.errors.seller?.idNumber?.message}>
            <input className={acqFieldClass} autoComplete="off" {...form.register("seller.idNumber")} />
          </Field>
          <Field label="Phone" error={form.formState.errors.seller?.phone?.message}>
            <input className={acqFieldClass} autoComplete="tel" inputMode="tel" {...form.register("seller.phone")} />
          </Field>
          <Field label="Email" error={form.formState.errors.seller?.email?.message}>
            <input className={acqFieldClass} autoComplete="email" inputMode="email" {...form.register("seller.email")} />
          </Field>
          <Field label="Marital status" error={form.formState.errors.seller?.maritalStatus?.message}>
            <select className={acqFieldClass} {...form.register("seller.maritalStatus")}>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Seller" error={form.formState.errors.seller?.sellerKind?.message}>
            <select className={acqFieldClass} {...form.register("seller.sellerKind")}>
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </Field>
          {sellerKind === "company" ? (
            <Field label="Company name" error={form.formState.errors.seller?.companyName?.message}>
              <input className={acqFieldClass} {...form.register("seller.companyName")} />
            </Field>
          ) : null}
          <Field label="Signing as" error={form.formState.errors.seller?.actingCapacity?.message}>
            <select className={acqFieldClass} {...form.register("seller.actingCapacity")}>
              <option value="owner">Owner</option>
              <option value="representative">Representative</option>
            </select>
          </Field>
          {acting === "representative" ? (
            <Field label="Representative name" error={form.formState.errors.seller?.representativeName?.message}>
              <input className={acqFieldClass} {...form.register("seller.representativeName")} />
            </Field>
          ) : null}
        </div>
      </ReSection>
      <ReSection id="property" title="Property" description={TENURE_LABEL[tenure]}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Address" error={form.formState.errors.property?.address?.message} className="sm:col-span-2">
            <input className={acqFieldClass} {...form.register("property.address")} />
          </Field>
          <Field label="Stand number" error={form.formState.errors.property?.standNumber?.message}>
            <input className={acqFieldClass} {...form.register("property.standNumber")} />
          </Field>
          <Field label="Suburb" error={form.formState.errors.property?.suburb?.message}>
            <input className={acqFieldClass} {...form.register("property.suburb")} />
          </Field>
          <Field label="City" error={form.formState.errors.property?.city?.message}>
            <input className={acqFieldClass} {...form.register("property.city")} />
          </Field>
          <Field label="Property type" error={form.formState.errors.property?.propertyType?.message}>
            <select className={acqFieldClass} {...form.register("property.propertyType")}>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="land">Land</option>
              <option value="sectional">Sectional title</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Tenure" error={form.formState.errors.property?.tenureType?.message}>
            <select className={acqFieldClass} {...form.register("property.tenureType")}>
              <option value="title_deed">Title deed</option>
              <option value="council_cession">Local authority cession</option>
              <option value="developer_cession">Developer cession</option>
            </select>
          </Field>
          <Field label="Local authority" error={form.formState.errors.property?.localAuthority?.message}>
            <input className={acqFieldClass} placeholder="City of Harare" {...form.register("property.localAuthority")} />
          </Field>
          <Field label="Asking price (USD)" error={priceError}>
            <input className={acqFieldClass} inputMode="decimal" value={priceText} onChange={(event) => setPriceText(event.target.value)} />
          </Field>
        </div>
      </ReSection>
      <ReSection id="documents" title="Documents" description="JPEG or PNG for the National ID and selfie. A liveness capture adds six frames, then the selfie, and those are what Smile ID compares.">
        <ul className="flex flex-col gap-3">
          {slots.map((slot) => (
            <li key={slot.key} className="grid gap-2 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-center">
              <label className="min-w-0">
                <span className="sr-only">Document type</span>
                <select
                  className={acqFieldClass}
                  value={slot.type}
                  onChange={(event) => setSlots((current) => current.map((item) => item.key === slot.key ? { ...item, type: event.target.value as DocumentType } : item))}
                >
                  {Object.entries(DOCUMENT_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <input
                type="file"
                accept={slot.type === "selfie" ? "image/*" : "application/pdf,image/jpeg,image/png,image/webp"}
                capture={slot.type === "selfie" ? "user" : undefined}
                className="re-focus block min-h-11 w-full text-[13px] text-sales-text-secondary file:mr-3 file:min-h-11 file:rounded-[8px] file:border file:border-sales-border file:bg-sales-surface file:px-3 file:text-[13px] file:font-medium file:text-sales-text-primary"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSlots((current) => current.map((item) => item.key === slot.key ? { ...item, file } : item));
                }}
              />
            </li>
          ))}
        </ul>
        <LivenessCapture
          disabled={busy}
          onFrames={(files) => {
            setSlots((current) => [
              ...current.filter((slot) => !slot.file || !/^liveness[-_]/i.test(slot.file.name)),
              ...files.map((file, index) => ({ key: `live-${Date.now()}-${index}`, type: "selfie" as const, file })),
            ]);
          }}
        />
        <button
          type="button"
          className="re-focus mt-3 min-h-11 text-[13px] font-medium text-sales-text-secondary"
          onClick={() => setSlots((current) => [...current, { key: `extra-${current.length}-${Date.now()}`, type: "other", file: null }])}
        >
          Add another document
        </button>
      </ReSection>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={busy}>Run due diligence</Button>
        {progress ? <p role="status" className="text-[13px] text-sales-text-secondary">{progress}</p> : null}
      </div>
    </form>
  );
}

function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className={acqLabelClass}>{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[12px] text-sales-danger-fg">{error}</span> : null}
    </label>
  );
}

function LivenessCapture({ disabled, onFrames }: { disabled: boolean; onFrames: (files: File[]) => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      const stream = video?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function start() {
    setMessage("");
    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setMessage("This browser cannot use the camera. Upload a JPEG selfie instead.");
      return;
    }
    setRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      video.srcObject = stream;
      await video.play();
      const frames: File[] = [];
      for (let index = 0; index < 6; index += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        const shot = await grabFrame(video, `liveness-${index + 1}.jpg`);
        if (shot) frames.push(shot);
      }
      const selfie = await grabFrame(video, "selfie.jpg");
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      if (!selfie || frames.length < 6) {
        setMessage("The camera did not capture a full liveness sequence. Try again, or upload a JPEG selfie.");
        return;
      }
      onFrames([...frames, selfie]);
      setMessage("Six liveness frames and a selfie are ready to upload.");
      setOpen(false);
    } catch {
      setMessage("The camera could not be started. Upload a JPEG selfie instead.");
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={disabled || recording} onClick={() => setOpen((current) => !current)}>
          {open ? "Hide camera" : "Capture selfie"}
        </Button>
      </div>
      {open ? (
        <div className="flex flex-col gap-2">
          <video ref={videoRef} className="max-h-64 w-full max-w-sm rounded-[8px] border border-sales-border-subtle bg-sales-surface" playsInline muted />
          <Button type="button" variant="secondary" loading={recording} disabled={disabled || recording} onClick={() => void start()}>
            {recording ? "Capturing" : "Start liveness capture"}
          </Button>
        </div>
      ) : null}
      {message ? <p role="status" className="text-[13px] text-sales-text-secondary">{message}</p> : null}
    </div>
  );
}

async function grabFrame(video: HTMLVideoElement, name: string): Promise<File | null> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) return null;
  return new File([blob], name, { type: "image/jpeg" });
}
