"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button, Input, Select, Switch, TextArea } from "@/components/sales/ui";
import { cn } from "@/lib/ui/cn";
import { BRAIN_AREAS, type BrainAreaId } from "@/lib/company-brain/constants";
import { BUSINESS_KIND_LABELS, DEAL_STAGE_LABELS, DEAL_STAGES } from "@/lib/company-brain/constants";
import type { BrainReadiness } from "@/lib/company-brain/readiness";
import type { CompanyBrainSnapshot, CompanyBrainSettings, PlaybookField } from "@/lib/company-brain/types";
import { SettingsSectionCard } from "./SettingsSectionCard";

type ToastFn = (opts: {
  tone?: "success" | "info" | "warning" | "error";
  title: string;
  description?: string;
}) => void;

function statusIcon(status: "complete" | "needs_review" | "empty" | "ready" | "needs_setup") {
  if (status === "complete" || status === "ready") {
    return <CheckCircle2 size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === "needs_review" || status === "needs_setup") {
    return <AlertTriangle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />;
  }
  return <Circle size={14} className="shrink-0 text-sales-text-muted" />;
}

async function brainFetch(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function CompanyBrainSettingsSection({
  clientId,
  toast,
}: {
  clientId: string;
  toast: ToastFn;
}) {
  const [area, setArea] = useState<BrainAreaId>("overview");
  const [snapshot, setSnapshot] = useState<CompanyBrainSnapshot | null>(null);
  const [readiness, setReadiness] = useState<BrainReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const qs = `?clientId=${encodeURIComponent(clientId)}`;

  const reload = useCallback(async () => {
    const data = await brainFetch(`/api/company-brain${qs}`);
    setSnapshot(data.snapshot);
    setReadiness(data.readiness);
  }, [qs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await brainFetch(`/api/company-brain${qs}`);
        if (!cancelled) {
          setSnapshot(data.snapshot);
          setReadiness(data.readiness);
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            tone: "error",
            title: "Could not load Company Brain",
            description: err instanceof Error ? err.message : undefined,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qs, toast]);

  async function saveSettings(patch: Partial<CompanyBrainSettings>) {
    setSaving(true);
    try {
      const data = await brainFetch(`/api/company-brain${qs}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await reload();
      if (data.readiness) setReadiness(data.readiness);
      toast({ tone: "success", title: "Saved" });
    } catch (err) {
      toast({ tone: "error", title: "Could not save", description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function createItem(resource: string, payload: Record<string, unknown>) {
    await brainFetch(`/api/company-brain/${resource}${qs}`, { method: "POST", body: JSON.stringify(payload) });
    await reload();
    toast({ tone: "success", title: "Added" });
  }

  async function updateItem(resource: string, id: string, payload: Record<string, unknown>) {
    await brainFetch(`/api/company-brain/${resource}/${id}${qs}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    await reload();
    toast({ tone: "success", title: "Saved" });
  }

  async function deleteItem(resource: string, id: string) {
    await brainFetch(`/api/company-brain/${resource}/${id}${qs}`, { method: "DELETE" });
    await reload();
    toast({ tone: "success", title: "Removed" });
  }

  if (loading || !snapshot || !readiness) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 size={18} className="animate-spin text-sales-text-muted" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 layout:flex-row layout:items-start">
      <nav className="flex min-w-0 gap-1 overflow-x-auto layout:w-[200px] layout:shrink-0 layout:flex-col layout:overflow-visible">
        {BRAIN_AREAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setArea(item.id)}
            className={cn(
              "shrink-0 rounded-[8px] px-3 py-2 text-left text-[13px] font-medium transition-colors",
              area === item.id
                ? "bg-sales-brand-soft text-sales-text-primary"
                : "text-sales-text-secondary hover:bg-sales-surface-hover hover:text-sales-text-primary"
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        {area === "overview" ? (
          <Overview
            readiness={readiness}
            snapshot={snapshot}
            onOpen={setArea}
          />
        ) : null}
        {area === "profile" ? <ProfileForm snapshot={snapshot} saving={saving} onSave={saveSettings} /> : null}
        {area === "catalogue" ? <CatalogueForm snapshot={snapshot} saving={saving} onSave={saveSettings} /> : null}
        {area === "customers" ? (
          <CustomersEditor snapshot={snapshot} onCreate={createItem} onUpdate={updateItem} onDelete={deleteItem} />
        ) : null}
        {area === "qualification" ? (
          <PlaybooksEditor snapshot={snapshot} onCreate={createItem} onUpdate={updateItem} onDelete={deleteItem} />
        ) : null}
        {area === "sales-process" ? (
          <SalesProcessEditor snapshot={snapshot} saving={saving} onCreate={createItem} onSave={saveSettings} />
        ) : null}
        {area === "service-areas" ? (
          <AreasEditor snapshot={snapshot} onCreate={createItem} onUpdate={updateItem} onDelete={deleteItem} />
        ) : null}
        {area === "hours" ? (
          <HoursSection snapshot={snapshot} onCreate={createItem} onUpdate={updateItem} onDelete={deleteItem} />
        ) : null}
        {area === "pricing" ? <PricingForm snapshot={snapshot} saving={saving} onSave={saveSettings} /> : null}
        {area === "support" ? <SupportForm snapshot={snapshot} saving={saving} onSave={saveSettings} /> : null}
        {area === "voice" ? <VoiceForm snapshot={snapshot} saving={saving} onSave={saveSettings} /> : null}
        {area === "faqs" ? (
          <FaqsEditor snapshot={snapshot} onCreate={createItem} onUpdate={updateItem} onDelete={deleteItem} />
        ) : null}
        {area === "examples" ? (
          <ExamplesEditor snapshot={snapshot} onCreate={createItem} onDelete={deleteItem} />
        ) : null}
        {area === "rules" ? (
          <RulesEditor snapshot={snapshot} onCreate={createItem} onUpdate={updateItem} onDelete={deleteItem} />
        ) : null}
        {area === "escalation" ? (
          <EscalationEditor
            snapshot={snapshot}
            saving={saving}
            onSaveSettings={saveSettings}
            onCreate={createItem}
            onDelete={deleteItem}
          />
        ) : null}
        {area === "knowledge" ? (
          <KnowledgeEditor
            snapshot={snapshot}
            qs={qs}
            onCreate={createItem}
            onDelete={deleteItem}
            onReload={reload}
            toast={toast}
          />
        ) : null}
        {area === "test" ? <TestPanel clientId={clientId} toast={toast} /> : null}
      </div>
    </div>
  );
}

function Overview({
  readiness,
  snapshot,
  onOpen,
}: {
  readiness: BrainReadiness;
  snapshot: CompanyBrainSnapshot;
  onOpen: (id: BrainAreaId) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[20px] font-semibold text-sales-text-primary">Company Brain</h1>
        <p className="mt-1 text-[13px] text-sales-text-secondary">
          Teach SegmiQ Agent how your business sells, serves customers and makes decisions.
        </p>
      </div>

      <SettingsSectionCard
        title="Agent readiness"
        description={`${readiness.configuredAreaCount} of ${readiness.totalAreaCount} areas configured`}
      >
        <p className="text-[13px] text-sales-text-secondary">{readiness.summary}</p>
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => onOpen("test")}>
            Test Agent
          </Button>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title="Agent capabilities">
        <ul className="divide-y divide-sales-border-subtle">
          {readiness.capabilities.filter((c) => c.id !== "auto_quote").map((cap) => (
            <li key={cap.id} className="flex items-start justify-between gap-3 py-2.5">
              <div>
                <p className="text-[13px] font-medium text-sales-text-primary">{cap.label}</p>
                {cap.missing.length ? (
                  <p className="mt-0.5 text-[12px] text-sales-text-secondary">Needs {cap.missing.join(", ")}</p>
                ) : null}
              </div>
              <span className="flex items-center gap-1.5 text-[12px] font-medium">
                {statusIcon(cap.status)}
                {cap.status === "ready" ? "Ready" : "Needs setup"}
              </span>
            </li>
          ))}
        </ul>
        {readiness.quotationAutomationBlocked.length ? (
          <p className="mt-3 rounded-[8px] bg-amber-500/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
            Complete these {readiness.quotationAutomationBlocked.length} items before enabling autonomous
            quotation sending: {readiness.quotationAutomationBlocked.join(", ")}.
          </p>
        ) : null}
      </SettingsSectionCard>

      <SettingsSectionCard title="Business knowledge">
        <ul className="divide-y divide-sales-border-subtle">
          {readiness.areas.map((area) => (
            <li key={area.id}>
              <button
                type="button"
                onClick={() => onOpen(area.id as BrainAreaId)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
              >
                <span className="flex items-center gap-2 text-[13px] text-sales-text-primary">
                  {statusIcon(area.status)}
                  {area.label}
                </span>
                <span className="flex items-center gap-2 text-[12px] text-sales-text-secondary">
                  {area.detail}
                  <ChevronRight size={14} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-sales-text-muted">
          Catalogue, hours, payment terms and deal pipeline stay in their existing SegmiQ records.
          Company Brain adds the operating context the Agent needs on top.
        </p>
        <p className="mt-1 text-[12px] text-sales-text-muted">
          {snapshot.canonical.productCount + snapshot.canonical.serviceCount} catalogue items ·{" "}
          {snapshot.canonical.paymentTerms ? "payment terms on file" : "no payment terms"} ·{" "}
          {snapshot.canonical.hasQualificationFlow ? "existing qualification flow" : "no Instant Form flow"}
        </p>
      </SettingsSectionCard>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-medium text-sales-text-secondary">
      {label}
      {children}
      {hint ? <span className="font-normal text-sales-text-muted">{hint}</span> : null}
    </label>
  );
}

function ProfileForm({
  snapshot,
  saving,
  onSave,
}: {
  snapshot: CompanyBrainSnapshot;
  saving: boolean;
  onSave: (patch: Partial<CompanyBrainSettings>) => Promise<void>;
}) {
  const s = snapshot.settings;
  const c = snapshot.canonical;
  const [explanation, setExplanation] = useState(s.agentBusinessExplanation ?? "");
  const [kind, setKind] = useState(s.businessKind ?? "");
  const [model, setModel] = useState(s.customerModel ?? "");
  const [trading, setTrading] = useState(s.tradingName ?? "");
  const [languages, setLanguages] = useState(s.languages.join(", "));

  return (
    <SettingsSectionCard
      title="Business Profile"
      description="Canonical company name, industry and contact details stay in Company Information. This page is how SegmiQ Agent should understand the business."
    >
      <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          ["Legal name", c.companyName],
          ["Industry", c.industry],
          ["Website", c.website],
          ["Phone", c.phone],
          ["Email", c.email],
          ["Timezone", c.timezone],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] uppercase tracking-[0.04em] text-sales-text-muted">{label}</dt>
            <dd className="mt-0.5 text-[13px] text-sales-text-primary">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Trading name">
          <Input value={trading} onChange={(e) => setTrading(e.target.value)} />
        </Field>
        <Field label="Business type" hint="Stops the Agent offering work you do not do.">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Not set</option>
            {Object.entries(BUSINESS_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sells to">
          <Select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Not set</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
            <option value="BOTH">Both</option>
          </Select>
        </Field>
        <Field label="Languages" hint="Comma-separated. Agent will not switch into unsupported languages.">
          <Input value={languages} onChange={(e) => setLanguages(e.target.value)} />
        </Field>
      </div>
      <Field
        label="How should SegmiQ understand your business?"
        hint="Explain what the company does, who you serve, and anything important the Agent should understand. This guides reasoning — it does not replace the catalogue."
      >
        <TextArea
          rows={5}
          className="mt-1"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
      </Field>
      <div className="mt-4 flex justify-end">
        <Button
          loading={saving}
          onClick={() =>
            onSave({
              tradingName: trading || null,
              businessKind: (kind || null) as CompanyBrainSettings["businessKind"],
              customerModel: (model || null) as CompanyBrainSettings["customerModel"],
              agentBusinessExplanation: explanation || null,
              languages: languages
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        >
          Save changes
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

function CatalogueForm({
  snapshot,
  saving,
  onSave,
}: {
  snapshot: CompanyBrainSnapshot;
  saving: boolean;
  onSave: (patch: Partial<CompanyBrainSettings>) => Promise<void>;
}) {
  const s = snapshot.settings;
  const [primaryOffering, setPrimaryOffering] = useState(s.primaryOffering ?? "");
  const [customerType, setCustomerType] = useState(s.catalogueCustomerType ?? "");
  const [orderType, setOrderType] = useState(s.typicalOrderType ?? "");
  const [notSell, setNotSell] = useState(s.weDoNotNormallySell ?? "");
  const [special, setSpecial] = useState(s.specialSellingConditions ?? "");
  return (
    <SettingsSectionCard
      title="What we sell"
      description={`${snapshot.canonical.productCount} products and ${snapshot.canonical.serviceCount} services are already in the catalogue. Do not copy them here — add how they are sold.`}
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Primary offering">
          <Input value={primaryOffering} onChange={(e) => setPrimaryOffering(e.target.value)} />
        </Field>
        <Field label="Typical customers">
          <Input value={customerType} onChange={(e) => setCustomerType(e.target.value)} />
        </Field>
        <Field label="Typical order type">
          <Input value={orderType} onChange={(e) => setOrderType(e.target.value)} />
        </Field>
        <Field label="We do not normally sell">
          <TextArea rows={3} value={notSell} onChange={(e) => setNotSell(e.target.value)} />
        </Field>
        <Field label="Special conditions">
          <TextArea rows={3} value={special} onChange={(e) => setSpecial(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          loading={saving}
          onClick={() =>
            onSave({
              primaryOffering: primaryOffering || null,
              catalogueCustomerType: customerType || null,
              typicalOrderType: orderType || null,
              weDoNotNormallySell: notSell || null,
              specialSellingConditions: special || null,
            })
          }
        >
          Save changes
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

function CustomersEditor({
  snapshot,
  onCreate,
  onUpdate,
  onDelete,
}: {
  snapshot: CompanyBrainSnapshot;
  onCreate: (resource: string, payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (resource: string, id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (resource: string, id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <SettingsSectionCard
      title="Ideal customers"
      description="Guides qualification and prioritisation. The Agent will not automatically reject a customer from a vague mismatch."
    >
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Profile name, e.g. Mining contractor" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Typical requirements" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Button
          size="sm"
          leftIcon={<Plus size={13} />}
          disabled={!name.trim()}
          onClick={async () => {
            await onCreate("customers", { name: name.trim(), description: description || null });
            setName("");
            setDescription("");
          }}
        >
          Add
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {snapshot.idealCustomers.map((c) => (
          <li key={c.id} className="rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium text-sales-text-primary">{c.name}</p>
                <p className="text-[12px] text-sales-text-secondary">{c.description || "No description"}</p>
              </div>
              <button type="button" onClick={() => onDelete("customers", c.id)} className="text-sales-text-muted hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
            <Input
              className="mt-2"
              placeholder="Good fit indicators"
              defaultValue={c.goodFitIndicators ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (c.goodFitIndicators ?? "")) {
                  void onUpdate("customers", c.id, { good_fit_indicators: e.target.value || null });
                }
              }}
            />
          </li>
        ))}
      </ul>
    </SettingsSectionCard>
  );
}

function emptyField(priority: number): PlaybookField {
  return {
    id: `f-${Date.now()}-${priority}`,
    label: "",
    internalKey: `field_${priority}`,
    type: "TEXT",
    required: true,
    possibleValues: [],
    validation: null,
    agentQuestionGuidance: null,
    crmMapping: null,
    priority,
    conditional: null,
  };
}

function PlaybooksEditor({
  snapshot,
  onCreate,
  onUpdate,
  onDelete,
}: {
  snapshot: CompanyBrainSnapshot;
  onCreate: (resource: string, payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (resource: string, id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (resource: string, id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  return (
    <SettingsSectionCard
      title="Qualification playbooks"
      description="Company-configurable questions. Do not hard-code a single industry script. Existing Instant Forms still count as a qualification source."
    >
      {snapshot.canonical.hasQualificationFlow ? (
        <p className="mb-3 text-[12px] text-sales-text-secondary">
          This company already has a WhatsApp / Instant Form qualification flow. Playbooks add Agent-specific
          conversational guidance on top.
        </p>
      ) : null}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Playbook name, e.g. Crane hire" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Trigger keywords, comma-separated" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        <Button
          size="sm"
          disabled={!name.trim()}
          onClick={async () => {
            await onCreate("playbooks", {
              name: name.trim(),
              trigger_conditions: {
                keywords: keywords
                  .split(",")
                  .map((k) => k.trim())
                  .filter(Boolean),
              },
              fields: [emptyField(1)],
            });
            setName("");
            setKeywords("");
          }}
        >
          Add playbook
        </Button>
      </div>
      <ul className="flex flex-col gap-3">
        {snapshot.playbooks.map((pb) => (
          <li key={pb.id} className="rounded-[10px] border border-sales-border-subtle p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-sales-text-primary">{pb.name}</p>
                <p className="text-[12px] text-sales-text-secondary">
                  {(pb.trigger.keywords ?? []).join(", ") || "No keywords"} · {pb.fields.length} fields
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={pb.enabled} onCheckedChange={(v) => void onUpdate("playbooks", pb.id, { enabled: v })} />
                <button type="button" onClick={() => onDelete("playbooks", pb.id)} className="text-sales-text-muted hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {pb.fields.map((field, idx) => (
              <div key={field.id} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Input
                  defaultValue={field.label}
                  placeholder="Question label"
                  onBlur={(e) => {
                    const fields = pb.fields.map((f, i) => (i === idx ? { ...f, label: e.target.value } : f));
                    void onUpdate("playbooks", pb.id, { fields });
                  }}
                />
                <Input
                  defaultValue={field.agentQuestionGuidance ?? ""}
                  placeholder="How the Agent should ask"
                  onBlur={(e) => {
                    const fields = pb.fields.map((f, i) =>
                      i === idx ? { ...f, agentQuestionGuidance: e.target.value || null } : f
                    );
                    void onUpdate("playbooks", pb.id, { fields });
                  }}
                />
                <Input
                  defaultValue={
                    field.conditional ? `${field.conditional.field}=${field.conditional.value ?? ""}` : ""
                  }
                  placeholder="Show if key=value (optional)"
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const [ck, cv] = raw.split("=");
                    const fields = pb.fields.map((f, i) =>
                      i === idx
                        ? {
                            ...f,
                            conditional: raw
                              ? { field: ck.trim(), op: "equals" as const, value: (cv ?? "").trim() }
                              : null,
                          }
                        : f
                    );
                    void onUpdate("playbooks", pb.id, { fields });
                  }}
                />
              </div>
            ))}
            <Button
              className="mt-2"
              size="sm"
              variant="secondary"
              onClick={() =>
                void onUpdate("playbooks", pb.id, { fields: [...pb.fields, emptyField(pb.fields.length + 1)] })
              }
            >
              Add field
            </Button>
          </li>
        ))}
      </ul>
    </SettingsSectionCard>
  );
}

function SalesProcessEditor({
  snapshot,
  saving,
  onCreate,
  onSave,
}: {
  snapshot: CompanyBrainSnapshot;
  saving: boolean;
  onCreate: (resource: string, payload: Record<string, unknown>) => Promise<void>;
  onSave: (patch: Partial<CompanyBrainSettings>) => Promise<void>;
}) {
  const s = snapshot.settings;
  const [quoteDays, setQuoteDays] = useState(String(s.quoteFollowUpBusinessDays));
  const [secondDays, setSecondDays] = useState(String(s.secondFollowUpBusinessDays));
  const [maxFollowUps, setMaxFollowUps] = useState(String(s.maxAutonomousFollowUps));
  return (
    <SettingsSectionCard
      title="Sales process"
      description="Uses your existing Deal pipeline. Add Agent guidance per stage rather than a second workflow."
    >
      <ol className="mb-4 flex flex-wrap gap-2 text-[12px] text-sales-text-secondary">
        {DEAL_STAGES.map((stage) => (
          <li key={stage} className="rounded-full bg-sales-neutral-100 px-2.5 py-1">
            {DEAL_STAGE_LABELS[stage]}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-3">
        {DEAL_STAGES.filter((st) => st !== "WON" && st !== "LOST").map((stage) => {
          const current = snapshot.stageGuidance.find((g) => g.stage === stage);
          return (
            <Field key={stage} label={DEAL_STAGE_LABELS[stage]}>
              <TextArea
                rows={2}
                defaultValue={current?.guidance ?? ""}
                placeholder="What the Agent should know at this stage"
                onBlur={(e) => {
                  if (e.target.value !== (current?.guidance ?? "")) {
                    void onCreate("stage-guidance", { stage, guidance: e.target.value || null });
                  }
                }}
              />
            </Field>
          );
        })}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Field label="Quote follow-up (business days)">
          <Input value={quoteDays} onChange={(e) => setQuoteDays(e.target.value)} />
        </Field>
        <Field label="Second follow-up (business days)">
          <Input value={secondDays} onChange={(e) => setSecondDays(e.target.value)} />
        </Field>
        <Field label="Max autonomous follow-ups">
          <Input value={maxFollowUps} onChange={(e) => setMaxFollowUps(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3">
        <Button
          size="sm"
          disabled={saving}
          onClick={() =>
            void onSave({
              quoteFollowUpBusinessDays: Number(quoteDays) || 2,
              secondFollowUpBusinessDays: Number(secondDays) || 5,
              maxAutonomousFollowUps: Number(maxFollowUps) || 2,
            })
          }
        >
          Save follow-up rules
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

function AreasEditor({
  snapshot,
  onCreate,
  onUpdate,
  onDelete,
}: {
  snapshot: CompanyBrainSnapshot;
  onCreate: (resource: string, payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (resource: string, id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (resource: string, id: string) => Promise<void>;
}) {
  const [city, setCity] = useState("");
  const [country, setCountry] = useState(snapshot.canonical.country ?? "Zimbabwe");
  return (
    <SettingsSectionCard
      title="Service areas"
      description="If this is unconfigured, the Agent will not guess coverage."
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="City or region" value={city} onChange={(e) => setCity(e.target.value)} />
        <Input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
        <Button
          size="sm"
          disabled={!city.trim()}
          onClick={async () => {
            await onCreate("service-areas", {
              city: city.trim(),
              country: country || null,
              label: city.trim(),
              status: "PRIMARY",
            });
            setCity("");
          }}
        >
          Add area
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {snapshot.serviceAreas.map((area) => (
          <li key={area.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-sales-border-subtle px-3 py-2">
            <div>
              <p className="text-[13px] font-medium text-sales-text-primary">
                {[area.city, area.region, area.province, area.country].filter(Boolean).join(", ") || area.label}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={area.status}
                onChange={(e) => void onUpdate("service-areas", area.id, { status: e.target.value })}
              >
                <option value="PRIMARY">Primary</option>
                <option value="EXTENDED">Extended</option>
                <option value="CONFIRMATION_REQUIRED">Confirmation required</option>
                <option value="NOT_SERVED">Not served</option>
              </Select>
              <button type="button" onClick={() => onDelete("service-areas", area.id)} className="text-sales-text-muted hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </SettingsSectionCard>
  );
}

function HoursSection({
  snapshot,
  onCreate,
  onUpdate,
  onDelete,
}: {
  snapshot: CompanyBrainSnapshot;
  onCreate: (resource: string, payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (resource: string, id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (resource: string, id: string) => Promise<void>;
}) {
  const [name, setName] = useState("Sales call");
  const c = snapshot.canonical;
  return (
    <SettingsSectionCard
      title="Business hours & appointments"
      description="Working hours come from Sales execution settings. Appointment types below tell the Agent what can be booked."
    >
      <p className="mb-3 text-[13px] text-sales-text-secondary">
        {c.workStartTime}–{c.workEndTime} {c.timezone}
        {c.hasOperatingHoursRow ? "" : " (defaults — set hours in Company Information)"}
      </p>
      <div className="mb-3 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          size="sm"
          onClick={() => void onCreate("appointment-types", { name: name.trim() || "Appointment" })}
        >
          Add type
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {snapshot.appointmentTypes.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-sales-border-subtle px-3 py-2">
            <div>
              <p className="text-[13px] font-medium">{t.name}</p>
              <p className="text-[12px] text-sales-text-secondary">
                {t.durationMinutes} min · min notice {t.minNoticeHours}h
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={t.enabled} onCheckedChange={(v) => void onUpdate("appointment-types", t.id, { enabled: v })} />
              <button type="button" onClick={() => onDelete("appointment-types", t.id)}>
                <Trash2 size={14} className="text-sales-text-muted" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </SettingsSectionCard>
  );
}

function PricingForm({
  snapshot,
  saving,
  onSave,
}: {
  snapshot: CompanyBrainSnapshot;
  saving: boolean;
  onSave: (patch: Partial<CompanyBrainSettings>) => Promise<void>;
}) {
  const s = snapshot.settings;
  const c = snapshot.canonical;
  const [pricing, setPricing] = useState(s.pricingGuidance ?? "");
  const [payment, setPayment] = useState(s.paymentGuidance ?? "");
  return (
    <SettingsSectionCard
      title="Pricing & payments"
      description="Commercial policy, discount authority and payment terms live in Quotation settings. Add Agent behaviour here."
    >
      <p className="mb-3 text-[13px] text-sales-text-secondary">
        Canonical terms: {c.paymentTerms || "not set"} · Currency {c.currency} · Discounts{" "}
        {c.allowQuotationDiscount === false ? "not allowed" : "policy-controlled"}
      </p>
      <Field label="Pricing guidance">
        <TextArea rows={4} value={pricing} onChange={(e) => setPricing(e.target.value)} />
      </Field>
      <Field label="Payment guidance">
        <TextArea rows={3} value={payment} onChange={(e) => setPayment(e.target.value)} />
      </Field>
      <div className="mt-3 flex flex-col gap-2">
        <label className="flex items-center justify-between text-[13px]">
          Never estimate prices
          <Switch
            checked={s.neverEstimatePrices}
            onCheckedChange={(v) => void onSave({ neverEstimatePrices: v })}
          />
        </label>
        <label className="flex items-center justify-between text-[13px]">
          Credit offered
          <Switch checked={s.creditOffered} onCheckedChange={(v) => void onSave({ creditOffered: v })} />
        </label>
        <label className="flex items-center justify-between text-[13px]">
          Payment plans offered
          <Switch
            checked={s.paymentPlansOffered}
            onCheckedChange={(v) => void onSave({ paymentPlansOffered: v })}
          />
        </label>
        <label className="flex items-center justify-between text-[13px]">
          Non-standard terms need approval
          <Switch
            checked={s.nonstandardTermsRequireApproval}
            onCheckedChange={(v) => void onSave({ nonstandardTermsRequireApproval: v })}
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <Button loading={saving} onClick={() => onSave({ pricingGuidance: pricing || null, paymentGuidance: payment || null })}>
          Save guidance
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

function SupportForm({
  snapshot,
  saving,
  onSave,
}: {
  snapshot: CompanyBrainSnapshot;
  saving: boolean;
  onSave: (patch: Partial<CompanyBrainSettings>) => Promise<void>;
}) {
  const s = snapshot.settings;
  const [categories, setCategories] = useState(s.supportCategories.join(", "));
  const [hours, setHours] = useState(s.supportHoursNote ?? "");
  const [warranty, setWarranty] = useState(s.warrantyBoundaries ?? "");
  return (
    <SettingsSectionCard
      title="Support"
      description="Routes through the existing Support queue and support cases. Troubleshooting is off unless you explicitly enable it."
    >
      <label className="mb-3 flex items-center justify-between text-[13px]">
        Support is offered
        <Switch checked={s.supportOffered} onCheckedChange={(v) => void onSave({ supportOffered: v })} />
      </label>
      <Field label="Destination">
        <Select
          value={s.supportDestinationType ?? ""}
          onChange={(e) => void onSave({ supportDestinationType: e.target.value || null })}
        >
          <option value="">Not set</option>
          <option value="SUPPORT_QUEUE">Support queue</option>
          <option value="OWNER">Conversation owner</option>
          <option value="ADMIN">Company administrator</option>
        </Select>
      </Field>
      <Field label="Support hours note">
        <Input value={hours} onChange={(e) => setHours(e.target.value)} />
      </Field>
      <Field label="Categories" hint="Comma-separated">
        <Input value={categories} onChange={(e) => setCategories(e.target.value)} />
      </Field>
      <Field label="Warranty / support boundaries">
        <TextArea rows={3} value={warranty} onChange={(e) => setWarranty(e.target.value)} />
      </Field>
      <label className="mt-3 flex items-center justify-between text-[13px]">
        Autonomous troubleshooting
        <Switch
          checked={s.autonomousTroubleshooting}
          onCheckedChange={(v) => void onSave({ autonomousTroubleshooting: v })}
        />
      </label>
      <div className="mt-4 flex justify-end">
        <Button
          loading={saving}
          onClick={() =>
            onSave({
              supportHoursNote: hours || null,
              supportCategories: categories
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
              warrantyBoundaries: warranty || null,
            })
          }
        >
          Save support
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

function VoiceForm({
  snapshot,
  saving,
  onSave,
}: {
  snapshot: CompanyBrainSnapshot;
  saving: boolean;
  onSave: (patch: Partial<CompanyBrainSettings>) => Promise<void>;
}) {
  const s = snapshot.settings;
  const [greeting, setGreeting] = useState(s.greetingStyle ?? "");
  const [claims, setClaims] = useState(s.claimsToAvoid.join("\n"));
  const [prefer, setPrefer] = useState(
    s.preferredTerms.map((t) => `${t.prefer}|${t.avoid}`).join("\n")
  );
  return (
    <SettingsSectionCard title="Brand voice" description="Structured controls. WhatsApp replies stay concise by default.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Primary tone">
          <Select value={s.voicePrimary} onChange={(e) => void onSave({ voicePrimary: e.target.value as CompanyBrainSettings["voicePrimary"] })}>
            {["professional", "warm", "direct", "technical", "premium", "conversational"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Length">
          <Select value={s.responseLength} onChange={(e) => void onSave({ responseLength: e.target.value as CompanyBrainSettings["responseLength"] })}>
            <option value="short">Short</option>
            <option value="balanced">Balanced</option>
            <option value="detailed">Detailed</option>
          </Select>
        </Field>
        <Field label="Emoji">
          <Select value={s.emojiPolicy} onChange={(e) => void onSave({ emojiPolicy: e.target.value as CompanyBrainSettings["emojiPolicy"] })}>
            <option value="none">None</option>
            <option value="minimal">Minimal</option>
            <option value="normal">Normal</option>
          </Select>
        </Field>
      </div>
      <Field label="Greeting style" hint="Adapted naturally — not repeated verbatim every time.">
        <Input value={greeting} onChange={(e) => setGreeting(e.target.value)} />
      </Field>
      <Field label="Preferred terminology" hint="One per line: preferred|avoid">
        <TextArea rows={3} value={prefer} onChange={(e) => setPrefer(e.target.value)} />
      </Field>
      <Field label="Claims to avoid" hint="One per line">
        <TextArea rows={3} value={claims} onChange={(e) => setClaims(e.target.value)} />
      </Field>
      <div className="mt-4 flex justify-end">
        <Button
          loading={saving}
          onClick={() =>
            onSave({
              greetingStyle: greeting || null,
              preferredTerms: prefer
                .split("\n")
                .map((line) => line.split("|"))
                .filter((p) => p[0]?.trim() && p[1]?.trim())
                .map(([a, b]) => ({ prefer: a.trim(), avoid: b.trim() })),
              claimsToAvoid: claims
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        >
          Save voice
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

function FaqsEditor({
  snapshot,
  onCreate,
  onUpdate,
  onDelete,
}: {
  snapshot: CompanyBrainSnapshot;
  onCreate: (resource: string, payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (resource: string, id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (resource: string, id: string) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [aliases, setAliases] = useState("");
  return (
    <SettingsSectionCard title="FAQs" description="Approved answers. The Agent may phrase naturally but must preserve facts.">
      <div className="mb-4 flex flex-col gap-2">
        <Input placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <TextArea rows={3} placeholder="Approved answer" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <Input placeholder="Aliases, comma-separated" value={aliases} onChange={(e) => setAliases(e.target.value)} />
        <Button
          size="sm"
          disabled={!question.trim() || !answer.trim()}
          onClick={async () => {
            await onCreate("faqs", {
              question: question.trim(),
              approved_answer: answer.trim(),
              aliases: aliases
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean),
              last_reviewed_at: new Date().toISOString(),
            });
            setQuestion("");
            setAnswer("");
            setAliases("");
          }}
        >
          Add FAQ
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {snapshot.faqs.map((faq) => (
          <li key={faq.id} className="rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium">{faq.question}</p>
                <p className="text-[12px] text-sales-text-secondary">{faq.approvedAnswer}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={faq.active} onCheckedChange={(v) => void onUpdate("faqs", faq.id, { active: v })} />
                <button type="button" onClick={() => onDelete("faqs", faq.id)}>
                  <Trash2 size={14} className="text-sales-text-muted" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </SettingsSectionCard>
  );
}

function ExamplesEditor({
  snapshot,
  onCreate,
  onDelete,
}: {
  snapshot: CompanyBrainSnapshot;
  onCreate: (resource: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (resource: string, id: string) => Promise<void>;
}) {
  const [situation, setSituation] = useState("");
  const [customer, setCustomer] = useState("");
  const [preferred, setPreferred] = useState("");
  return (
    <SettingsSectionCard title="Response examples" description="Few-shot style examples, not rigid templates. The Agent still uses current customer and deal facts.">
      <div className="mb-4 flex flex-col gap-2">
        <Input placeholder="Situation" value={situation} onChange={(e) => setSituation(e.target.value)} />
        <Input placeholder="Customer message" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        <TextArea rows={3} placeholder="Preferred response" value={preferred} onChange={(e) => setPreferred(e.target.value)} />
        <Button
          size="sm"
          disabled={!situation.trim() || !preferred.trim()}
          onClick={async () => {
            await onCreate("examples", {
              situation: situation.trim(),
              customer_message: customer.trim() || situation.trim(),
              preferred_response: preferred.trim(),
            });
            setSituation("");
            setCustomer("");
            setPreferred("");
          }}
        >
          Add example
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {snapshot.examples.map((ex) => (
          <li key={ex.id} className="rounded-[10px] border border-sales-border-subtle px-3 py-2.5">
            <div className="flex items-start justify-between">
              <p className="text-[13px] font-medium">{ex.situation}</p>
              <button type="button" onClick={() => onDelete("examples", ex.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            <p className="text-[12px] text-sales-text-secondary">{ex.preferredResponse}</p>
          </li>
        ))}
      </ul>
    </SettingsSectionCard>
  );
}

function RulesEditor({
  snapshot,
  onCreate,
  onUpdate,
  onDelete,
}: {
  snapshot: CompanyBrainSnapshot;
  onCreate: (resource: string, payload: Record<string, unknown>) => Promise<void>;
  onUpdate: (resource: string, id: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (resource: string, id: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState<"NEVER_SAY" | "NEVER_DO">("NEVER_SAY");
  const [key, setKey] = useState("");
  return (
    <SettingsSectionCard
      title="Agent rules"
      description="Never Say is communication guidance. Never Do with a structured key is enforced in code."
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={type} onChange={(e) => setType(e.target.value as "NEVER_SAY" | "NEVER_DO")}>
          <option value="NEVER_SAY">Never say</option>
          <option value="NEVER_DO">Never do</option>
        </Select>
        <Input placeholder="Rule" value={text} onChange={(e) => setText(e.target.value)} />
        <Select value={key} onChange={(e) => setKey(e.target.value)}>
          <option value="">No structured key</option>
          <option value="NEVER_APPLY_DISCOUNT">Never apply discount</option>
          <option value="NEVER_SEND_QUOTE">Never send quote</option>
          <option value="NEVER_BOOK_SUNDAY">Never book Sunday</option>
          <option value="NEVER_TROUBLESHOOT">Never troubleshoot</option>
          <option value="NEVER_MARK_DEAL_WON">Never mark deal won</option>
          <option value="NEVER_SHARE_INTERNAL_NOTES">Never share internal notes</option>
        </Select>
        <Button
          size="sm"
          disabled={!text.trim()}
          onClick={async () => {
            await onCreate("rules", {
              rule_type: type,
              text: text.trim(),
              structured_key: key || null,
            });
            setText("");
            setKey("");
          }}
        >
          Add
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {snapshot.rules.map((rule) => (
          <li key={rule.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-sales-border-subtle px-3 py-2">
            <div>
              <p className="text-[11px] uppercase text-sales-text-muted">{rule.ruleType.replace("_", " ")}</p>
              <p className="text-[13px]">{rule.text}</p>
              {rule.structuredKey ? (
                <p className="text-[11px] text-sales-text-muted">{rule.structuredKey}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={rule.enabled} onCheckedChange={(v) => void onUpdate("rules", rule.id, { enabled: v })} />
              <button type="button" onClick={() => onDelete("rules", rule.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </SettingsSectionCard>
  );
}

function EscalationEditor({
  snapshot,
  saving,
  onSaveSettings,
  onCreate,
  onDelete,
}: {
  snapshot: CompanyBrainSnapshot;
  saving: boolean;
  onSaveSettings: (patch: Partial<CompanyBrainSettings>) => Promise<void>;
  onCreate: (resource: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (resource: string, id: string) => Promise<void>;
}) {
  const [name, setName] = useState("Discount request");
  const [condition, setCondition] = useState("DISCOUNT_REQUEST");
  const [message, setMessage] = useState(snapshot.settings.defaultEscalationMessage ?? "");
  return (
    <SettingsSectionCard
      title="Escalation"
      description="System conditions (low confidence, customer asks for a person, tool failure, policy blocked) always apply. Add company conditions below."
    >
      <Field label="Default customer message">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>
      <div className="mb-4 mt-2 flex justify-end">
        <Button size="sm" loading={saving} onClick={() => onSaveSettings({ defaultEscalationMessage: message || null })}>
          Save message
        </Button>
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
          {["DISCOUNT_REQUEST", "COMPLAINT", "PRICING_DISPUTE", "REFUND_REQUEST", "TECHNICAL_SAFETY", "LEGAL_THREAT"].map(
            (k) => (
              <option key={k} value={k}>
                {k.replace(/_/g, " ")}
              </option>
            )
          )}
        </Select>
        <Button
          size="sm"
          onClick={() =>
            void onCreate("escalation-rules", {
              name,
              condition_key: condition,
              destination_type: "SALES_MANAGER",
              priority: "HIGH",
            })
          }
        >
          Add rule
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {snapshot.escalationRules.map((rule) => (
          <li key={rule.id} className="flex items-center justify-between rounded-[10px] border border-sales-border-subtle px-3 py-2">
            <div>
              <p className="text-[13px] font-medium">{rule.name}</p>
              <p className="text-[12px] text-sales-text-secondary">
                {rule.conditionKey} → {rule.destinationType} · {rule.priority}
              </p>
            </div>
            <button type="button" onClick={() => onDelete("escalation-rules", rule.id)}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </SettingsSectionCard>
  );
}

function KnowledgeEditor({
  snapshot,
  qs,
  onCreate,
  onDelete,
  onReload,
  toast,
}: {
  snapshot: CompanyBrainSnapshot;
  qs: string;
  onCreate: (resource: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (resource: string, id: string) => Promise<void>;
  onReload: () => Promise<void>;
  toast: ToastFn;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("COMPANY");
  return (
    <SettingsSectionCard
      title="Knowledge library"
      description="Only approved documents are used by the Agent. Uploaded text is treated as data, never as instructions."
    >
      <div className="mb-4 flex flex-col gap-2">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {["COMPANY", "PRODUCT", "WARRANTY", "PRICING", "SUPPORT", "TERMS", "TECHNICAL"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <TextArea rows={6} placeholder="Paste document text" value={content} onChange={(e) => setContent(e.target.value)} />
        <Button
          size="sm"
          disabled={!title.trim() || !content.trim()}
          onClick={async () => {
            await onCreate("knowledge", {
              title: title.trim(),
              category,
              content_text: content,
              status: "DRAFT",
            });
            setTitle("");
            setContent("");
          }}
        >
          Upload as draft
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {snapshot.knowledgeDocuments.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between rounded-[10px] border border-sales-border-subtle px-3 py-2">
            <div>
              <p className="text-[13px] font-medium">{doc.title}</p>
              <p className="text-[12px] text-sales-text-secondary">
                {doc.category} · {doc.status}
                {doc.lastReviewedAt
                  ? ` · reviewed ${Math.round((Date.now() - new Date(doc.lastReviewedAt).getTime()) / 86400000)}d ago`
                  : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {doc.status !== "APPROVED" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await brainFetch(`/api/company-brain/knowledge/${doc.id}/approve${qs}`, { method: "POST" });
                      await onReload();
                      toast({ tone: "success", title: "Approved" });
                    } catch (err) {
                      toast({
                        tone: "error",
                        title: "Could not approve",
                        description: err instanceof Error ? err.message : undefined,
                      });
                    }
                  }}
                >
                  Approve
                </Button>
              ) : null}
              <button type="button" onClick={() => onDelete("knowledge", doc.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </SettingsSectionCard>
  );
}

function TestPanel({ clientId, toast }: { clientId: string; toast: ToastFn }) {
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    reply: string | null;
    intents: string[];
    sources: Array<{ label: string }>;
    why: string[];
    actions: Array<{ toolName: string; status: string; summary: Record<string, unknown>; blockedReason?: string }>;
    error?: string;
  } | null>(null);

  return (
    <SettingsSectionCard
      title="Test your Agent"
      description="Simulates a customer message using Company Brain. Nothing is sent on WhatsApp and no CRM records are created."
    >
      <TextArea
        rows={4}
        placeholder="Ask your Agent something..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="mt-3 flex justify-end">
        <Button
          disabled={!message.trim() || running}
          loading={running}
          onClick={async () => {
            setRunning(true);
            try {
              const data = await brainFetch(`/api/company-brain/test?clientId=${encodeURIComponent(clientId)}`, {
                method: "POST",
                body: JSON.stringify({ message }),
              });
              setResult(data.result);
            } catch (err) {
              toast({
                tone: "error",
                title: "Test failed",
                description: err instanceof Error ? err.message : undefined,
              });
            } finally {
              setRunning(false);
            }
          }}
        >
          Test response
        </Button>
      </div>
      {result ? (
        <div className="mt-4 flex flex-col gap-3">
          {result.error ? (
            <p className="text-[13px] text-red-600">{result.error}</p>
          ) : null}
          <div>
            <p className="text-[11px] font-semibold uppercase text-sales-text-muted">Agent response</p>
            <p className="mt-1 whitespace-pre-wrap rounded-[10px] border border-sales-border-subtle bg-sales-bg px-3 py-2.5 text-[13px]">
              {result.reply || "(no reply)"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-sales-text-muted">Detected intent</p>
            <p className="mt-1 text-[13px]">{result.intents.join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-sales-text-muted">Sources used</p>
            <ul className="mt-1 text-[13px] text-sales-text-secondary">
              {result.sources.length
                ? result.sources.map((s, i) => <li key={i}>{s.label}</li>)
                : <li>None</li>}
            </ul>
          </div>
          {result.why?.length ? (
            <div>
              <p className="text-[11px] font-semibold uppercase text-sales-text-muted">Why</p>
              <ul className="mt-1 text-[13px] text-sales-text-secondary">
                {result.why.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="text-[11px] font-semibold uppercase text-sales-text-muted">Actions it would take</p>
            {result.actions.length ? (
              <ul className="mt-1 flex flex-col gap-1.5">
                {result.actions.map((a, i) => (
                  <li key={i} className="rounded-[8px] bg-sales-neutral-100 px-2.5 py-1.5 text-[12px]">
                    <span className="font-medium">{a.toolName}</span> · {a.status.toLowerCase()}
                    {a.blockedReason ? ` — ${a.blockedReason}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-sales-text-secondary">No tools would be called.</p>
            )}
          </div>
        </div>
      ) : null}
    </SettingsSectionCard>
  );
}
