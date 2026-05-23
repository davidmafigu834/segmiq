"use client";

import { useCallback, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import type { FormField } from "@/types";
import { FormRenderer } from "@/components/FormRenderer";

const PALETTE: { type: FormField["type"]; label: string }[] = [
  { type: "short_text", label: "Short text" },
  { type: "long_text", label: "Long text" },
  { type: "phone", label: "Phone" },
  { type: "email", label: "Email" },
  { type: "number", label: "Number" },
  { type: "dropdown", label: "Dropdown" },
  { type: "radio", label: "Radio" },
  { type: "checkboxes", label: "Checkboxes" },
  { type: "date", label: "Date" },
  { type: "file", label: "File" },
];

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `f_${Math.random().toString(36).slice(2)}`;
}

type GeneratedQuestion = {
  label: string;
  field_type: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  maps_to?: string;
};

export function FormBuilder({
  clientId,
  clientIndustry,
  initial,
}: {
  clientId: string;
  clientIndustry: string;
  initial: { fields: FormField[]; form_title: string | null; submit_button_text: string | null; thank_you_message: string | null; opening_message: string | null };
}) {
  const [fields, setFields] = useState<FormField[]>(initial.fields ?? []);
  const [formTitle, setFormTitle] = useState(initial.form_title ?? "Contact");
  const [submitText, setSubmitText] = useState(initial.submit_button_text ?? "Submit");
  const [thanks, setThanks] = useState(initial.thank_you_message ?? "Thank you!");
  const [openingMessage, setOpeningMessage] = useState(initial.opening_message ?? "");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<FormField | null>(null);
  const [generating, setGenerating] = useState(false);
  const [additionalContext, setAdditionalContext] = useState("");

  async function handleGenerateQuestions() {
    if (!clientIndustry) return;
    if (
      fields.length > 0 &&
      !confirm("This will replace your current questions with AI-generated ones. Continue?")
    ) {
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/form/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: clientIndustry, additionalContext }),
      });
      const data = (await res.json()) as { questions?: GeneratedQuestion[] };
      if (res.ok && Array.isArray(data.questions)) {
        setFields(
          data.questions.map((q) => ({
            id: newId(),
            type: q.field_type,
            label: q.label,
            placeholder: q.placeholder ?? "",
            required: q.required ?? false,
            options:
              q.options && q.options.length > 0 ? q.options : undefined,
          }))
        );
      }
    } catch {
      // fails silently
    } finally {
      setGenerating(false);
    }
  }

  const onDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(fields);
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    setFields(items);
  }, [fields]);

  async function save() {
    setSaving(true);
    await fetch(`/api/clients/${clientId}/form`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields,
        form_title: formTitle,
        submit_button_text: submitText,
        thank_you_message: thanks,
        opening_message: openingMessage,
      }),
    });
    setSaving(false);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="sticky top-20 flex items-center justify-between border-b border-border pb-4">
          <h3 className="font-display text-xl text-ink-primary">Form builder</h3>
          <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <div className="rounded-lg border border-border bg-surface-card p-4">
          <div className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">Field types</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PALETTE.map((p) => (
              <button
                type="button"
                key={p.type}
                className="btn-ghost h-9 text-xs"
                onClick={() =>
                  setFields((f) => [
                    ...f,
                    {
                      id: newId(),
                      type: p.type,
                      label: p.label,
                      placeholder: "",
                      required: false,
                      options: p.type === "dropdown" || p.type === "radio" || p.type === "checkboxes" ? ["Option A", "Option B"] : undefined,
                    },
                  ])
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {/* AI generation section */}
        <div
          style={{
            padding: 16,
            background: "rgba(212,255,79,0.04)",
            border: "0.5px solid rgba(212,255,79,0.15)",
            borderRadius: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <i className="ti ti-sparkles" style={{ fontSize: 14, color: "#D4FF4F" }} />
            <p className="text-[13px] font-semibold text-ink-primary" style={{ margin: 0 }}>
              Generate questions with AI
            </p>
          </div>
          <p className="text-[12px] text-ink-tertiary" style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
            AI will generate smart lead capture questions based on the{" "}
            {clientIndustry || "client"} industry. You can edit them after.
          </p>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder={`Optional: describe anything specific — e.g. "residential solar only, minimum 5kW systems"`}
            rows={2}
            className="input-base w-full resize-none text-[12px]"
            style={{ marginBottom: 10 }}
          />
          <button
            type="button"
            onClick={() => void handleGenerateQuestions()}
            disabled={generating || !clientIndustry}
            className="btn-primary h-9 text-xs"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <i className="ti ti-sparkles" style={{ fontSize: 12 }} />
            {generating ? "Generating…" : "Generate questions"}
          </button>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="canvas">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[200px] rounded-lg border border-border bg-surface-card p-4">
                <div className="font-display text-lg text-ink-primary">Canvas</div>
                {fields.map((field, index) => (
                  <Draggable key={field.id} draggableId={field.id} index={index}>
                    {(p) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        {...p.dragHandleProps}
                        className="mt-3 rounded-lg border border-border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <input
                            className="input-base flex-1 font-medium"
                            value={field.label}
                            onChange={(e) =>
                              setFields((fs) => fs.map((x) => (x.id === field.id ? { ...x, label: e.target.value } : x)))
                            }
                          />
                          <button
                            type="button"
                            className="text-xs text-[var(--info)] underline-offset-2 hover:underline"
                            onClick={() => setModal(field)}
                          >
                            + Logic
                          </button>
                          <button
                            type="button"
                            className="text-xs text-[var(--danger)]"
                            onClick={() => setFields((fs) => fs.filter((x) => x.id !== field.id))}
                          >
                            Delete
                          </button>
                        </div>
                        <input
                          className="input-base mt-2 text-ink-secondary"
                          placeholder="Placeholder"
                          value={field.placeholder ?? ""}
                          onChange={(e) =>
                            setFields((fs) => fs.map((x) => (x.id === field.id ? { ...x, placeholder: e.target.value } : x)))
                          }
                        />
                        <label className="mt-2 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={!!field.required}
                            onChange={(e) =>
                              setFields((fs) => fs.map((x) => (x.id === field.id ? { ...x, required: e.target.checked } : x)))
                            }
                          />
                          Required
                        </label>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <div className="rounded-lg border border-border bg-surface-card-alt p-4">
          <div className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">Form-level</div>
          <label className="mt-3 block text-sm text-ink-secondary">
            Title
            <input className="input-base mt-1" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          </label>
          <label className="mt-3 block text-sm text-ink-secondary">
            Submit text
            <input className="input-base mt-1" value={submitText} onChange={(e) => setSubmitText(e.target.value)} />
          </label>
          <label className="mt-3 block text-sm text-ink-secondary">
            Thank you message
            <input className="input-base mt-1" value={thanks} onChange={(e) => setThanks(e.target.value)} />
          </label>
          <label className="mt-3 block text-sm text-ink-secondary">
            Opening message
            <span className="ml-1 text-[10px] text-ink-tertiary">(shown at the start of the conversation)</span>
            <textarea
              className="input-base mt-1 h-24 resize-none"
              value={openingMessage}
              onChange={(e) => setOpeningMessage(e.target.value)}
              placeholder="Hello! Thank you for considering us…"
            />
          </label>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-surface-card-alt p-6">
        <div className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">Preview</div>
        <div className="mt-3">
          <FormRenderer
            schema={{ fields, form_title: formTitle, submit_button_text: submitText, thank_you_message: thanks }}
            onSubmit={async () => {}}
          />
        </div>
      </div>
      {modal ? (
        <LogicModal
          field={modal}
          allFields={fields}
          onClose={() => setModal(null)}
          onSave={(updated) => {
            setFields((fs) => fs.map((x) => (x.id === updated.id ? updated : x)));
            setModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

function LogicModal({
  field,
  allFields,
  onClose,
  onSave,
}: {
  field: FormField;
  allFields: FormField[];
  onClose: () => void;
  onSave: (f: FormField) => void;
}) {
  const [target, setTarget] = useState(field.conditionalLogic?.fieldId ?? allFields[0]?.id ?? "");
  const [op, setOp] = useState<"equals" | "not_equals">(field.conditionalLogic?.operator ?? "equals");
  const [val, setVal] = useState(field.conditionalLogic?.value ?? "");
  const [mode, setMode] = useState<"show" | "block">(field.conditionalLogic?.action === "block" ? "block" : "show");
  const [blockMsg, setBlockMsg] = useState(field.conditionalLogic?.blockMessage ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay p-4">
      <div className="w-full max-w-lg border border-border bg-surface-card p-6">
        <div className="font-display text-xl text-ink-primary">Conditional logic</div>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            Mode
            <select className="input-base mt-1" value={mode} onChange={(e) => setMode(e.target.value as "show" | "block")}>
              <option value="show">Show field only if…</option>
              <option value="block">Block submit if…</option>
            </select>
          </label>
          <label className="block">
            Field
            <select className="input-base mt-1" value={target} onChange={(e) => setTarget(e.target.value)}>
              {allFields.filter((f) => f.id !== field.id).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Operator
            <select className="input-base mt-1" value={op} onChange={(e) => setOp(e.target.value as "equals" | "not_equals")}>
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
            </select>
          </label>
          <label className="block">
            Value
            <input className="input-base mt-1" value={val} onChange={(e) => setVal(e.target.value)} />
          </label>
          {mode === "block" ? (
            <label className="block">
              Block message
              <input className="input-base mt-1" value={blockMsg} onChange={(e) => setBlockMsg(e.target.value)} />
            </label>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost px-4" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary px-4"
            onClick={() =>
              onSave({
                ...field,
                conditionalLogic: {
                  action: mode === "block" ? "block" : "show",
                  fieldId: target,
                  operator: op,
                  value: val,
                  blockMessage: mode === "block" ? blockMsg : undefined,
                },
              })
            }
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
