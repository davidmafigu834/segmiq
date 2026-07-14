"use client";

import { useRef, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";

type Props = {
  options: string[];
  onChange: (options: string[]) => void;
  minOptions?: number;
};

export function MultipleChoiceOptionsEditor({
  options,
  onChange,
  minOptions = 2,
}: Props) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const list = options.length >= minOptions ? options : [...options, ...Array(minOptions - options.length).fill("")];

  function updateOption(index: number, value: string) {
    const next = [...list];
    next[index] = value;
    onChange(next);
  }

  function removeOption(index: number) {
    if (list.length <= minOptions) return;
    onChange(list.filter((_, i) => i !== index));
  }

  function addOption(focus = true) {
    const label = String.fromCharCode(65 + list.length);
    onChange([...list, `Option ${label}`]);
    if (focus) {
      window.requestAnimationFrame(() => {
        inputRefs.current[list.length]?.focus();
      });
    }
  }

  function focusOption(index: number) {
    inputRefs.current[index]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (index < list.length - 1) {
        focusOption(index + 1);
      } else {
        addOption();
      }
      return;
    }
    if (e.key === "Backspace" && list[index] === "" && list.length > minOptions) {
      e.preventDefault();
      removeOption(index);
      focusOption(Math.max(0, index - 1));
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
        Options
      </div>
      <div className="space-y-2">
        {list.map((opt, index) => (
          <div key={`option-${index}`} className="flex items-center gap-2">
            <span
              className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--border)] bg-surface-card"
              aria-hidden
            />
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              className="input-base min-w-0 flex-1 text-sm"
              value={opt}
              onChange={(e) => updateOption(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              placeholder={`Option ${index + 1}`}
              aria-label={`Option ${index + 1}`}
            />
            {list.length > minOptions ? (
              <button
                type="button"
                onClick={() => removeOption(index)}
                title="Remove option"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-surface-card-alt hover:text-[var(--danger)]"
              >
                <X size={14} />
              </button>
            ) : (
              <span className="w-8 shrink-0" aria-hidden />
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => addOption()}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--info)] hover:underline"
      >
        <Plus size={14} />
        Add option
      </button>
    </div>
  );
}
