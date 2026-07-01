"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { InstantForm, type InstantFormConfig } from "@/components/instant-form/InstantForm";
import {
  CONTACT_FIELD_PRESETS,
  newQuestionId,
} from "@/lib/instant-form-helpers";
import { getPublicInstantFormUrl } from "@/lib/public-url";
import type {
  InstantFormCompletion,
  InstantFormConsent,
  InstantFormIntro,
  InstantFormPrivacy,
  InstantFormQuestion,
  InstantFormRow,
  InstantFormType,
} from "@/types";

type Section = "intro" | "questions" | "privacy" | "completion" | "settings";

function newConsentId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c_${Math.random().toString(36).slice(2)}`;
}

export function InstantFormBuilder({
  clientId,
  clientName,
  clientLogo,
  initial,
}: {
  clientId: string;
  clientName: string;
  clientLogo?: string;
  initial: InstantFormRow;
}) {
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [status, setStatus] = useState(initial.status);
  const [formType, setFormType] = useState<InstantFormType>(initial.form_type);
  const [intro, setIntro] = useState<InstantFormIntro>(initial.intro ?? {});
  const [questions, setQuestions] = useState<InstantFormQuestion[]>(initial.questions ?? []);
  const [consents, setConsents] = useState<InstantFormConsent[]>(initial.consents ?? []);
  const [privacy, setPrivacy] = useState<InstantFormPrivacy>(initial.privacy ?? {});
  const [completion, setCompletion] = useState<InstantFormCompletion>(initial.completion ?? {});
  const [section, setSection] = useState<Section>("intro");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logicModal, setLogicModal] = useState<InstantFormQuestion | null>(null);

  const config: InstantFormConfig = useMemo(
    () => ({ formType, intro, questions, consents, privacy, completion }),
    [formType, intro, questions, consents, privacy, completion]
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const items = Array.from(questions);
      const [removed] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, removed);
      setQuestions(items.map((q, i) => ({ ...q, sort_order: i })));
    },
    [questions]
  );

  async function save(overrides?: Partial<{ status: typeof status }>) {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/clients/${clientId}/instant-forms/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          status: overrides?.status ?? status,
          form_type: formType,
          intro,
          questions,
          consents,
          privacy,
          completion,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { form: InstantFormRow };
        if (data.form) {
          setStatus(data.form.status);
          setSlug(data.form.slug);
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  function addContactField(fieldType: string) {
    const preset = CONTACT_FIELD_PRESETS.find((p) => p.field_type === fieldType);
    if (!preset) return;
    setQuestions((qs) => [
      ...qs,
      {
        id: newQuestionId(),
        kind: "contact",
        field_type: preset.field_type,
        label: preset.label,
        placeholder: preset.placeholder,
        is_required: ["full_name", "email", "phone"].includes(preset.field_type),
        maps_to: preset.maps_to,
        sort_order: qs.length,
      },
    ]);
  }

  function addCustomQuestion(type: "short_answer" | "multiple_choice") {
    setQuestions((qs) => [
      ...qs,
      {
        id: newQuestionId(),
        kind: "custom",
        field_type: type,
        label: type === "multiple_choice" ? "Multiple choice question" : "Short answer question",
        placeholder: type === "short_answer" ? "Your answer" : undefined,
        options: type === "multiple_choice" ? ["Option A", "Option B"] : undefined,
        is_required: false,
        sort_order: qs.length,
      },
    ]);
  }

  const sections: { id: Section; label: string }[] = [
    { id: "intro", label: "Intro" },
    { id: "questions", label: "Questions" },
    { id: "privacy", label: "Privacy & consent" },
    { id: "completion", label: "Completion" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/clients/${clientId}/instant-forms`}
            className="text-sm text-ink-tertiary hover:text-ink-primary"
          >
            ← Back
          </Link>
          <h3 className="font-display text-xl text-ink-primary">{name}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              status === "published"
                ? "bg-[rgba(46,125,94,0.12)] text-[var(--success)]"
                : "bg-surface-card-alt text-ink-tertiary"
            }`}
          >
            {status === "published" ? "Published" : "Draft"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saved ? <span className="text-xs text-[var(--success)]">Saved</span> : null}
          <button type="button" className="btn-ghost h-9 text-xs" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          {status === "published" ? (
            <button
              type="button"
              className="btn-ghost h-9 text-xs"
              onClick={() => {
                setStatus("draft");
                void save({ status: "draft" });
              }}
              disabled={saving}
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary h-9 text-xs"
              onClick={() => {
                setStatus("published");
                void save({ status: "published" });
              }}
              disabled={saving}
            >
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1 border-b border-border pb-2">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  section === s.id
                    ? "bg-surface-card-alt text-ink-primary"
                    : "text-ink-tertiary hover:text-ink-primary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {section === "intro" && (
            <div className="space-y-3 rounded-lg border border-border bg-surface-card p-4">
              <label className="block text-sm text-ink-secondary">
                Headline
                <input
                  className="input-base mt-1"
                  value={intro.headline ?? ""}
                  onChange={(e) => setIntro((i) => ({ ...i, headline: e.target.value }))}
                />
              </label>
              <label className="block text-sm text-ink-secondary">
                Layout
                <select
                  className="input-base mt-1"
                  value={intro.layout ?? "paragraph"}
                  onChange={(e) =>
                    setIntro((i) => ({ ...i, layout: e.target.value as "paragraph" | "list" }))
                  }
                >
                  <option value="paragraph">Paragraph</option>
                  <option value="list">Bullet list (one item per line)</option>
                </select>
              </label>
              <label className="block text-sm text-ink-secondary">
                Body
                <textarea
                  className="textarea-base mt-1 min-h-[6rem]"
                  value={intro.body ?? ""}
                  onChange={(e) => setIntro((i) => ({ ...i, body: e.target.value }))}
                  placeholder={
                    intro.layout === "list"
                      ? "Fast response\nFree quote\nNo obligation"
                      : "Tell people what to expect…"
                  }
                />
              </label>
              <label className="block text-sm text-ink-secondary">
                Background image URL
                <input
                  className="input-base mt-1"
                  value={intro.image_url ?? ""}
                  onChange={(e) => setIntro((i) => ({ ...i, image_url: e.target.value }))}
                  placeholder="https://…"
                />
              </label>
              <label className="block text-sm text-ink-secondary">
                Continue button text
                <input
                  className="input-base mt-1"
                  value={intro.button_text ?? ""}
                  onChange={(e) => setIntro((i) => ({ ...i, button_text: e.target.value }))}
                  placeholder="Get started"
                />
              </label>
            </div>
          )}

          {section === "questions" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface-card p-4">
                <div className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                  Add contact fields
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CONTACT_FIELD_PRESETS.map((p) => (
                    <button
                      key={p.field_type}
                      type="button"
                      className="btn-ghost h-8 text-xs"
                      onClick={() => addContactField(p.field_type)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ghost h-8 text-xs"
                    onClick={() => addCustomQuestion("short_answer")}
                  >
                    + Short answer
                  </button>
                  <button
                    type="button"
                    className="btn-ghost h-8 text-xs"
                    onClick={() => addCustomQuestion("multiple_choice")}
                  >
                    + Multiple choice
                  </button>
                </div>
              </div>

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="questions">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                      {questions.map((q, index) => (
                        <Draggable key={q.id} draggableId={q.id} index={index}>
                          {(p) => (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              {...p.dragHandleProps}
                              className="rounded-lg border border-border bg-surface-card p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-mono text-[10px] uppercase text-ink-tertiary">
                                  {q.kind === "contact" ? "Contact" : "Custom"} · {q.field_type}
                                </span>
                                <div className="flex gap-2">
                                  {q.kind === "custom" && questions.some((x) => x.field_type === "multiple_choice") ? (
                                    <button
                                      type="button"
                                      className="text-xs text-[var(--info)]"
                                      onClick={() => setLogicModal(q)}
                                    >
                                      Logic
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="text-xs text-[var(--danger)]"
                                    onClick={() =>
                                      setQuestions((qs) =>
                                        qs.filter((x) => x.id !== q.id).map((x, i) => ({ ...x, sort_order: i }))
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <input
                                className="input-base mt-2 font-medium"
                                value={q.label}
                                onChange={(e) =>
                                  setQuestions((qs) =>
                                    qs.map((x) => (x.id === q.id ? { ...x, label: e.target.value } : x))
                                  )
                                }
                              />
                              {q.field_type === "short_answer" || q.kind === "contact" ? (
                                <input
                                  className="input-base mt-2 text-sm"
                                  placeholder="Placeholder"
                                  value={q.placeholder ?? ""}
                                  onChange={(e) =>
                                    setQuestions((qs) =>
                                      qs.map((x) =>
                                        x.id === q.id ? { ...x, placeholder: e.target.value } : x
                                      )
                                    )
                                  }
                                />
                              ) : null}
                              {q.field_type === "multiple_choice" ? (
                                <textarea
                                  className="textarea-base mt-2 min-h-[4rem] text-sm"
                                  value={(q.options ?? []).join("\n")}
                                  onChange={(e) =>
                                    setQuestions((qs) =>
                                      qs.map((x) =>
                                        x.id === q.id
                                          ? {
                                              ...x,
                                              options: e.target.value.split("\n").filter(Boolean),
                                            }
                                          : x
                                      )
                                    )
                                  }
                                  placeholder="One option per line"
                                />
                              ) : null}
                              <label className="mt-2 flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={q.is_required}
                                  onChange={(e) =>
                                    setQuestions((qs) =>
                                      qs.map((x) =>
                                        x.id === q.id ? { ...x, is_required: e.target.checked } : x
                                      )
                                    )
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
            </div>
          )}

          {section === "privacy" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface-card p-4">
                <div className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                  Privacy policy
                </div>
                <label className="mt-3 block text-sm text-ink-secondary">
                  Disclaimer text
                  <textarea
                    className="textarea-base mt-1 min-h-[4rem]"
                    value={privacy.disclaimer ?? ""}
                    onChange={(e) => setPrivacy((p) => ({ ...p, disclaimer: e.target.value }))}
                    placeholder="By submitting this form, you agree to our"
                  />
                </label>
                <label className="mt-3 block text-sm text-ink-secondary">
                  Policy URL
                  <input
                    className="input-base mt-1"
                    value={privacy.policy_url ?? ""}
                    onChange={(e) => setPrivacy((p) => ({ ...p, policy_url: e.target.value }))}
                    placeholder="https://yoursite.com/privacy"
                  />
                </label>
                <label className="mt-3 block text-sm text-ink-secondary">
                  Link text
                  <input
                    className="input-base mt-1"
                    value={privacy.link_text ?? ""}
                    onChange={(e) => setPrivacy((p) => ({ ...p, link_text: e.target.value }))}
                    placeholder="Privacy Policy"
                  />
                </label>
              </div>
              <div className="rounded-lg border border-border bg-surface-card p-4">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">
                    Consent checkboxes
                  </div>
                  <button
                    type="button"
                    className="text-xs text-[var(--info)]"
                    onClick={() =>
                      setConsents((cs) => [
                        ...cs,
                        { id: newConsentId(), label: "I agree to be contacted.", is_required: true },
                      ])
                    }
                  >
                    + Add consent
                  </button>
                </div>
                {consents.map((c) => (
                  <div key={c.id} className="mt-3 rounded border border-border p-3">
                    <input
                      className="input-base text-sm"
                      value={c.label}
                      onChange={(e) =>
                        setConsents((cs) =>
                          cs.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x))
                        )
                      }
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={c.is_required}
                          onChange={(e) =>
                            setConsents((cs) =>
                              cs.map((x) =>
                                x.id === c.id ? { ...x, is_required: e.target.checked } : x
                              )
                            )
                          }
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        className="text-xs text-[var(--danger)]"
                        onClick={() => setConsents((cs) => cs.filter((x) => x.id !== c.id))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === "completion" && (
            <div className="space-y-3 rounded-lg border border-border bg-surface-card p-4">
              <label className="block text-sm text-ink-secondary">
                Headline
                <input
                  className="input-base mt-1"
                  value={completion.headline ?? ""}
                  onChange={(e) => setCompletion((c) => ({ ...c, headline: e.target.value }))}
                />
              </label>
              <label className="block text-sm text-ink-secondary">
                Body
                <textarea
                  className="textarea-base mt-1 min-h-[4rem]"
                  value={completion.body ?? ""}
                  onChange={(e) => setCompletion((c) => ({ ...c, body: e.target.value }))}
                />
              </label>
              <label className="block text-sm text-ink-secondary">
                CTA type
                <select
                  className="input-base mt-1"
                  value={completion.cta_type ?? "none"}
                  onChange={(e) =>
                    setCompletion((c) => ({
                      ...c,
                      cta_type: e.target.value as InstantFormCompletion["cta_type"],
                    }))
                  }
                >
                  <option value="none">None</option>
                  <option value="view_website">View website</option>
                  <option value="call">Call business</option>
                  <option value="download">Download</option>
                </select>
              </label>
              {completion.cta_type && completion.cta_type !== "none" ? (
                <>
                  <label className="block text-sm text-ink-secondary">
                    CTA button text
                    <input
                      className="input-base mt-1"
                      value={completion.cta_text ?? ""}
                      onChange={(e) => setCompletion((c) => ({ ...c, cta_text: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm text-ink-secondary">
                    {completion.cta_type === "call" ? "Phone number" : "Link URL"}
                    <input
                      className="input-base mt-1"
                      value={completion.cta_link ?? ""}
                      onChange={(e) => setCompletion((c) => ({ ...c, cta_link: e.target.value }))}
                    />
                  </label>
                </>
              ) : null}
            </div>
          )}

          {section === "settings" && (
            <div className="space-y-3 rounded-lg border border-border bg-surface-card p-4">
              <label className="block text-sm text-ink-secondary">
                Form name (internal)
                <input className="input-base mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block text-sm text-ink-secondary">
                Public URL slug
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-ink-tertiary">/f/</span>
                  <input className="input-base flex-1" value={slug} onChange={(e) => setSlug(e.target.value)} />
                </div>
              </label>
              {status === "published" ? (
                <p className="text-xs text-ink-tertiary">
                  Public URL:{" "}
                  <a
                    href={getPublicInstantFormUrl(slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--info)]"
                  >
                    {getPublicInstantFormUrl(slug)}
                  </a>
                </p>
              ) : null}
              <label className="block text-sm text-ink-secondary">
                Form type
                <select
                  className="input-base mt-1"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as InstantFormType)}
                >
                  <option value="more_volume">More volume (skip review step)</option>
                  <option value="higher_intent">Higher intent (review answers before submit)</option>
                </select>
              </label>
              <p className="text-xs text-ink-tertiary">
                Higher intent forms show a review screen where users confirm their answers before
                submitting — like Facebook&apos;s higher-intent instant forms.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-border bg-surface-card-alt p-4">
          <div className="font-mono text-[11px] uppercase tracking-wide text-ink-tertiary">Live preview</div>
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <InstantForm
              clientId={clientId}
              clientName={clientName}
              clientLogo={clientLogo}
              formName={name}
              config={config}
              onSubmit={async () => {}}
              preview
            />
          </div>
        </div>
      </div>

      {logicModal ? (
        <LogicModal
          question={logicModal}
          allQuestions={questions}
          onClose={() => setLogicModal(null)}
          onSave={(updated) => {
            setQuestions((qs) => qs.map((x) => (x.id === updated.id ? updated : x)));
            setLogicModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

function LogicModal({
  question,
  allQuestions,
  onClose,
  onSave,
}: {
  question: InstantFormQuestion;
  allQuestions: InstantFormQuestion[];
  onClose: () => void;
  onSave: (q: InstantFormQuestion) => void;
}) {
  const mcQuestions = allQuestions.filter(
    (q) => q.id !== question.id && q.field_type === "multiple_choice"
  );
  const [targetId, setTargetId] = useState(question.conditional_logic?.question_id ?? mcQuestions[0]?.id ?? "");
  const [operator, setOperator] = useState<"equals" | "not_equals">(
    question.conditional_logic?.operator ?? "equals"
  );
  const [value, setValue] = useState(question.conditional_logic?.value ?? "");

  const targetOptions =
    allQuestions.find((q) => q.id === targetId)?.options ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay p-4">
      <div className="w-full max-w-lg border border-border bg-surface-card p-6">
        <div className="font-display text-xl text-ink-primary">Conditional logic</div>
        <p className="mt-1 text-sm text-ink-tertiary">Show this question only when…</p>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            Question
            <select className="input-base mt-1" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {mcQuestions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Operator
            <select
              className="input-base mt-1"
              value={operator}
              onChange={(e) => setOperator(e.target.value as "equals" | "not_equals")}
            >
              <option value="equals">equals</option>
              <option value="not_equals">does not equal</option>
            </select>
          </label>
          <label className="block">
            Value
            <select className="input-base mt-1" value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Select…</option>
              {targetOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
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
                ...question,
                conditional_logic: targetId && value ? { question_id: targetId, operator, value } : undefined,
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
