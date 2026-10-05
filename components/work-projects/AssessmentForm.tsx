"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { uploadCompanyDocument } from "@/lib/documents/client-upload";
import { SOLAR_PHOTO_CATEGORIES, SOLAR_PHOTO_CATEGORY_LABEL } from "@/lib/work-projects/constants";
import {
  solarLoadSummary,
  solarOutcomeLabel,
  type SolarAssessmentData,
  type SolarLoadItem,
} from "@/lib/work-projects/field-rules";

const SECTIONS = ["Site", "Power", "Loads", "Roof", "Equipment", "Photos", "Outcome"] as const;

export function AssessmentForm({
  projectId,
  visitId,
  clientId,
  basePath,
  initial,
  canEdit,
  documentsEnabled,
  projectStatus,
}: {
  projectId: string;
  visitId: string;
  clientId: string;
  basePath: string;
  initial: SolarAssessmentData;
  canEdit: boolean;
  documentsEnabled: boolean;
  projectStatus: string;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Site");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<(typeof SOLAR_PHOTO_CATEGORIES)[number]>("ROOF");
  const [completed, setCompleted] = useState(initial.outcome != null && !canEdit);

  function patch<K extends keyof SolarAssessmentData>(key: K, value: SolarAssessmentData[K]) {
    setData((current) => ({ ...current, [key]: value }));
  }

  async function save(complete: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/work-projects/${projectId}/visits/${visitId}/assessment`, {
      method: complete ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not save the assessment.");
      return;
    }
    setSaved(complete ? "Assessment completed." : "Draft saved.");
    if (complete) setCompleted(true);
    router.refresh();
  }

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const uploaded = await uploadCompanyDocument(clientId, file);
    if (!uploaded.ok) {
      setBusy(false);
      setError(uploaded.error);
      return;
    }
    const res = await fetch(`/api/work-projects/${projectId}/visits/${visitId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: uploaded.documentId, category }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error || "Could not attach the photo.");
      return;
    }
    setData((current) => ({
      ...current,
      photos: [...current.photos, { documentId: uploaded.documentId, category, note: null }],
    }));
  }

  if (!canEdit) {
    return (
      <div className="space-y-3">
        <Link href={`${basePath}/${projectId}`} className="text-[13px] font-medium text-sales-text-secondary">Back to project</Link>
        <h1 className="text-[22px] font-semibold">Site assessment</h1>
        <Summary data={data} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href={`${basePath}/${projectId}`} className="inline-flex min-h-11 items-center text-[14px] font-medium text-sales-text-secondary">Back to project</Link>
      <div>
        <p className="text-[13px] text-sales-text-secondary">Site assessment</p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-tight">Record the site</h1>
      </div>
      <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
        <nav className="flex gap-2 overflow-x-auto border-b border-sales-border lg:flex-col lg:gap-0 lg:overflow-visible lg:border-0" aria-label="Assessment sections">
          {SECTIONS.map((item, index) => (
            <button key={item} type="button" onClick={() => setSection(item)} className={`min-h-11 shrink-0 whitespace-nowrap px-1 text-left text-[14px] font-semibold lg:px-0 ${section === item ? "text-sales-text-primary" : "text-sales-text-secondary"}`}>
              <span className="mr-2 tabular-nums text-sales-text-muted">{index + 1}</span>{item}
            </button>
          ))}
        </nav>
        <div className="mt-5 space-y-4 lg:mt-0">
      {section === "Site" ? (
        <div className="space-y-3">
          <Field label="Installation address" value={data.site.address ?? ""} onChange={(value) => patch("site", { ...data.site, address: value })} />
          <Field label="Property type" value={data.site.propertyType ?? ""} onChange={(value) => patch("site", { ...data.site, propertyType: value })} />
          <Field label="Site contact" value={data.site.siteContact ?? ""} onChange={(value) => patch("site", { ...data.site, siteContact: value })} />
          <Area label="Access notes" value={data.site.accessNotes ?? ""} onChange={(value) => patch("site", { ...data.site, accessNotes: value })} />
        </div>
      ) : null}
      {section === "Power" ? (
        <div className="space-y-3">
          <Choice label="Grid available" value={data.power.gridAvailable} onChange={(value) => patch("power", { ...data.power, gridAvailable: value })} />
          <Field label="Supply type" value={data.power.supplyType ?? ""} onChange={(value) => patch("power", { ...data.power, supplyType: value })} />
          <Choice label="Generator" value={data.power.generatorPresent} onChange={(value) => patch("power", { ...data.power, generatorPresent: value })} />
          <Choice label="Existing solar" value={data.power.existingSolar} onChange={(value) => patch("power", { ...data.power, existingSolar: value })} />
          <Field label="DB board" value={data.power.dbBoardCondition ?? ""} onChange={(value) => patch("power", { ...data.power, dbBoardCondition: value })} />
          <Field label="Earthing" value={data.power.earthing ?? ""} onChange={(value) => patch("power", { ...data.power, earthing: value })} />
        </div>
      ) : null}
      {section === "Loads" ? <Loads data={data} onChange={(loads) => patch("loads", loads)} notes={data.loadNotes ?? ""} onNotes={(value) => patch("loadNotes", value)} /> : null}
      {section === "Roof" ? (
        <div className="space-y-3">
          <Field label="Roof type" value={data.roof.roofType ?? ""} onChange={(value) => patch("roof", { ...data.roof, roofType: value })} />
          <Field label="Usable area" value={data.roof.usableArea ?? ""} onChange={(value) => patch("roof", { ...data.roof, usableArea: value })} />
          <Field label="Orientation" value={data.roof.orientation ?? ""} onChange={(value) => patch("roof", { ...data.roof, orientation: value })} />
          <Field label="Shading" value={data.roof.shading ?? ""} onChange={(value) => patch("roof", { ...data.roof, shading: value })} />
          <Field label="Condition" value={data.roof.condition ?? ""} onChange={(value) => patch("roof", { ...data.roof, condition: value })} />
          <Choice label="Ground mount option" value={data.roof.groundMount} onChange={(value) => patch("roof", { ...data.roof, groundMount: value })} />
          <Area label="Observations" value={data.roof.observations ?? ""} onChange={(value) => patch("roof", { ...data.roof, observations: value })} />
        </div>
      ) : null}
      {section === "Equipment" ? (
        <div className="space-y-3">
          <Field label="Proposed inverter location" value={data.equipment.inverterLocation ?? ""} onChange={(value) => patch("equipment", { ...data.equipment, inverterLocation: value })} />
          <Field label="Proposed battery location" value={data.equipment.batteryLocation ?? ""} onChange={(value) => patch("equipment", { ...data.equipment, batteryLocation: value })} />
          <Field label="Ventilation" value={data.equipment.ventilation ?? ""} onChange={(value) => patch("equipment", { ...data.equipment, ventilation: value })} />
          <Field label="Weather protection" value={data.equipment.weatherProtection ?? ""} onChange={(value) => patch("equipment", { ...data.equipment, weatherProtection: value })} />
          <Area label="Cable-run notes" value={data.equipment.cableNotes ?? ""} onChange={(value) => patch("equipment", { ...data.equipment, cableNotes: value })} />
        </div>
      ) : null}
      {section === "Photos" ? (
        <div className="space-y-3">
          {documentsEnabled ? (
            <>
              <label className="block text-[12px] font-medium">Category
                <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[13px]">
                  {SOLAR_PHOTO_CATEGORIES.map((item) => <option key={item} value={item}>{SOLAR_PHOTO_CATEGORY_LABEL[item]}</option>)}
                </select>
              </label>
              <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-sales-md border border-dashed border-sales-border text-[16px] font-semibold">
                Add photo
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }} />
              </label>
              <ul className="space-y-1 text-[15px]">
                {SOLAR_PHOTO_CATEGORIES.map((item) => {
                  const count = data.photos.filter((photo) => photo.category === item).length;
                  return count ? <li key={item}>{SOLAR_PHOTO_CATEGORY_LABEL[item]} · {count}</li> : null;
                })}
              </ul>
            </>
          ) : <p className="text-[13px] text-sales-text-secondary">Documents are not enabled, so photos cannot be stored for this company.</p>}
          <p className="text-[13px] text-sales-text-secondary">{data.photos.length} photo{data.photos.length === 1 ? "" : "s"} attached</p>
        </div>
      ) : null}
      {section === "Outcome" ? (
        <div className="space-y-4">
          <Summary data={data} />
          {(["suitable", "technical_review", "another_visit", "site_issue", "other"] as const).map((item) => (
            <label key={item} className="flex min-h-11 items-center gap-2 text-[15px]">
              <input type="radio" name="outcome" checked={data.outcome === item} onChange={() => patch("outcome", item)} />
              {solarOutcomeLabel(item)}
            </label>
          ))}
          <Area label="Notes" value={data.outcomeNotes ?? ""} onChange={(value) => patch("outcomeNotes", value)} />
        </div>
      ) : null}
      {error ? <p className="text-[14px] text-sales-danger-fg" role="alert">{error}</p> : null}
      {saved ? <p className="text-[14px] text-sales-text-secondary">{saved}</p> : null}
        </div>
      </div>
      <div className="sticky bottom-0 z-20 border-t border-sales-border bg-sales-surface py-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <button type="button" disabled={busy} onClick={() => void save(false)} className="min-h-11 flex-1 rounded-sales-md border border-sales-border px-4 text-[14px] font-semibold">Save draft</button>
          {section === "Outcome" ? (
            <button type="button" disabled={busy} onClick={() => void save(true)} className="min-h-11 flex-1 rounded-sales-md bg-segmiq-lime px-4 text-[14px] font-semibold text-sales-text-primary">Complete assessment</button>
          ) : (
            <button type="button" onClick={() => setSection(SECTIONS[SECTIONS.indexOf(section) + 1])} className="min-h-11 flex-1 rounded-sales-md bg-segmiq-lime px-4 text-[14px] font-semibold text-sales-text-primary">Continue</button>
          )}
        </div>
      </div>
      {completed && projectStatus === "SITE_ASSESSMENT" ? (
        <div className="rounded-sales-lg border border-sales-border p-4">
          <p className="text-[14px] font-medium">Site assessment completed. Move project to Ready to Schedule?</p>
          <button
            type="button"
            className="mt-3 min-h-11 rounded-sales-md bg-sales-text-primary px-4 text-[13px] font-semibold text-white"
            onClick={() => {
              void fetch(`/api/work-projects/${projectId}/status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "READY_TO_SCHEDULE" }),
              }).then(() => router.push(`${basePath}/${projectId}`));
            }}
          >
            Move to Ready to Schedule
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ data }: { data: SolarAssessmentData }) {
  const rows = [
    ["Site", data.site.address],
    ["Grid", data.power.gridAvailable],
    ["Generator", data.power.generatorPresent],
    ["Roof", data.roof.roofType],
    ["Shade", data.roof.shading],
    ["Outcome", solarOutcomeLabel(data.outcome)],
    ["Loads", solarLoadSummary(data)],
    ["Photos", String(data.photos.length)],
  ].filter((row) => row[1]);
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[12px] text-sales-text-muted">{label}</dt>
          <dd className="text-[14px]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[12px] font-medium">{label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block min-h-11 w-full rounded-sales-md border border-sales-border px-3 text-[14px]" />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[12px] font-medium">{label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-1 w-full rounded-sales-md border border-sales-border px-3 py-2 text-[14px]" />
    </label>
  );
}

function Choice({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "yes" | "no" | "unknown" | null;
  onChange: (value: "yes" | "no" | "unknown") => void;
}) {
  return (
    <fieldset>
      <legend className="text-[12px] font-medium">{label}</legend>
      <div className="mt-1 flex gap-2">
        {(["yes", "no", "unknown"] as const).map((item) => (
          <button key={item} type="button" onClick={() => onChange(item)} className={`min-h-11 flex-1 rounded-sales-md border px-3 text-[13px] font-semibold ${value === item ? "border-sales-text-primary bg-sales-text-primary text-white" : "border-sales-border"}`}>
            {item === "unknown" ? "Unknown" : item === "yes" ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Loads({
  data,
  onChange,
  notes,
  onNotes,
}: {
  data: SolarAssessmentData;
  onChange: (loads: SolarLoadItem[]) => void;
  notes: string;
  onNotes: (value: string) => void;
}) {
  const presets = ["Lights", "Fridge", "Wi-Fi", "TV", "Borehole", "Air conditioning", "Geyser"];
  const [name, setName] = useState("");
  const [watts, setWatts] = useState("");
  function find(label: string) {
    return data.loads.find((load) => load.name.toLowerCase() === label.toLowerCase());
  }
  function toggle(label: string) {
    const current = find(label);
    if (current) onChange(data.loads.filter((load) => load !== current));
    else onChange([...data.loads, { name: label, quantity: 1, watts: null, essential: true, notes: null }]);
  }
  function setWattsFor(label: string, value: string) {
    onChange(data.loads.map((load) => load.name.toLowerCase() === label.toLowerCase() ? { ...load, watts: value.trim() ? Number(value) : null } : load));
  }
  const custom = data.loads.filter((load) => !presets.some((label) => label.toLowerCase() === load.name.toLowerCase()));
  return (
    <div className="space-y-4">
      <p className="text-[16px] font-semibold">What needs to stay powered?</p>
      <ul className="space-y-1">
        {presets.map((label) => {
          const selected = Boolean(find(label));
          return (
            <li key={label}>
              <label className="flex min-h-11 items-center gap-3 text-[15px]">
                <input type="checkbox" checked={selected} onChange={() => toggle(label)} />
                {label}
              </label>
              {selected ? (
                <label className="mb-2 ml-7 block text-[13px] text-sales-text-secondary">
                  Watts, if known
                  <input inputMode="numeric" value={find(label)?.watts ?? ""} onChange={(event) => setWattsFor(label, event.target.value)} className="mt-1 block min-h-11 w-full max-w-xs rounded-sales-md border border-sales-border px-3 text-[15px] text-sales-text-primary" />
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
      {custom.map((load, index) => (
        <div key={`${load.name}-${index}`} className="flex items-center justify-between gap-3 text-[15px]">
          <span>{load.name}{load.watts != null ? ` · ${load.watts}W` : ""}</span>
          <button type="button" className="min-h-11 px-2 text-[14px]" onClick={() => onChange(data.loads.filter((item) => item !== load))}>Remove</button>
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Another load" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[15px]" />
        <input value={watts} onChange={(event) => setWatts(event.target.value)} placeholder="Watts" inputMode="numeric" className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[15px]" />
        <button
          type="button"
          className="min-h-11 rounded-sales-md border border-sales-border px-3 text-[14px] font-semibold"
          onClick={() => {
            if (!name.trim()) return;
            onChange([...data.loads, { name: name.trim(), quantity: 1, watts: watts.trim() ? Number(watts) : null, essential: true, notes: null }]);
            setName("");
            setWatts("");
          }}
        >
          Add
        </button>
      </div>
      <Area label="Other load notes" value={notes} onChange={onNotes} />
    </div>
  );
}
