"use client";

import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/ui/cn";
import { Button } from "./Button";
import { FieldError, FieldHint, FieldLabel } from "./Input";

const fieldText = "text-[16px] font-normal sm:text-[13px] placeholder:font-normal";
const fieldHeight = "h-11 min-h-11 sm:h-10 sm:min-h-10";
const fieldHeightCompact = "h-10 min-h-10 sm:h-8 sm:min-h-8";
const fieldMotion =
  "transition-[border-color,box-shadow,background-color,color] duration-[140ms] ease motion-reduce:transition-none";

const groupShell = cn(
  "sales-input-group flex w-full items-stretch overflow-hidden rounded-[8px]",
  "border border-[var(--sales-field-border)] bg-[var(--sales-field-bg)] shadow-[var(--sales-field-shadow)]",
  fieldMotion,
  "hover:border-[var(--sales-field-border-hover)]",
  "focus-within:border-[var(--sales-field-focus-border)] focus-within:shadow-[var(--sales-field-focus-ring)]"
);

const groupInvalid = cn(
  "border-[var(--sales-field-danger-border)]",
  "hover:border-[var(--sales-field-danger-border)]",
  "focus-within:border-[var(--sales-field-danger-border)] focus-within:shadow-[var(--sales-field-danger-ring)]"
);

const groupSuccess = cn(
  "border-[var(--sales-field-success-border)]",
  "hover:border-[var(--sales-field-success-border)]",
  "focus-within:border-[var(--sales-field-success-border)] focus-within:shadow-[var(--sales-field-success-ring)]"
);

const groupWarning = cn(
  "border-[var(--sales-field-warning-border)]",
  "hover:border-[var(--sales-field-warning-border)]",
  "focus-within:border-[var(--sales-field-warning-border)] focus-within:shadow-[var(--sales-field-warning-ring)]"
);

export type FieldTone = "default" | "success" | "warning";

export function Field({
  label,
  htmlFor,
  required,
  optional,
  hint,
  error,
  warning,
  success,
  children,
  className,
}: {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  warning?: ReactNode;
  success?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const baseId = useId().replace(/:/g, "");
  const controlId = htmlFor ?? `field-${baseId}`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const warningId = `${controlId}-warning`;
  const successId = `${controlId}-success`;

  const describedBy = error
    ? errorId
    : warning
      ? warningId
      : success
        ? successId
        : hint
          ? hintId
          : undefined;

  const tone: FieldTone | undefined = error
    ? undefined
    : success
      ? "success"
      : warning
        ? "warning"
        : undefined;

  let control = children;
  if (isValidElement(children)) {
    const el = children as ReactElement<Record<string, unknown>>;
    control = cloneElement(el, {
      id: (el.props.id as string | undefined) ?? controlId,
      "aria-describedby": describedBy,
      "aria-invalid": error ? true : (el.props["aria-invalid"] as boolean | undefined),
      invalid: error ? true : (el.props.invalid as boolean | undefined),
      tone: tone ?? (el.props.tone as FieldTone | undefined),
    });
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {label ? (
        <FieldLabel htmlFor={controlId} required={required} optional={optional}>
          {label}
        </FieldLabel>
      ) : null}
      {control}
      {error ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : warning ? (
        <FieldWarning id={warningId}>{warning}</FieldWarning>
      ) : success ? (
        <FieldSuccess id={successId}>{success}</FieldSuccess>
      ) : hint ? (
        <FieldHint id={hintId}>{hint}</FieldHint>
      ) : null}
    </div>
  );
}

export function FieldSuccess({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-[12px] font-normal text-sales-success">
      {children}
    </p>
  );
}

export function FieldWarning({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-[12px] font-normal text-sales-warning">
      {children}
    </p>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {title || description ? (
        <div className="space-y-1">
          {title ? (
            <h3 className="text-[16px] font-semibold text-sales-text-primary">{title}</h3>
          ) : null}
          {description ? (
            <p className="text-[12px] text-sales-text-secondary sm:text-[13px]">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FormFields({
  children,
  columns = 1,
  className,
}: {
  children: ReactNode;
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <div
      className={cn(
        columns === 2
          ? "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5"
          : "flex flex-col gap-4 sm:gap-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FormActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3",
        className
      )}
    >
      {children}
    </div>
  );
}

export function InputGroup({
  className,
  invalid,
  tone,
  compact,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  invalid?: boolean;
  tone?: FieldTone;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        groupShell,
        invalid && groupInvalid,
        !invalid && tone === "success" && groupSuccess,
        !invalid && tone === "warning" && groupWarning,
        compact && "[&_input]:h-10 [&_input]:min-h-10 sm:[&_input]:h-8 sm:[&_input]:min-h-8",
        className
      )}
      {...props}
    />
  );
}

export function InputAddon({
  side = "left",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { side?: "left" | "right" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center bg-[var(--sales-surface-subtle)] px-3 text-[12px] font-medium text-sales-text-secondary sm:text-[13px]",
        fieldHeight,
        side === "left" ? "border-r border-[var(--sales-field-border)]" : "border-l border-[var(--sales-field-border)]",
        className
      )}
      {...props}
    />
  );
}

export const GroupedInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { addonSide?: "left" | "right"; compact?: boolean }
>(function GroupedInput({ className, addonSide = "left", compact, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        fieldText,
        compact ? fieldHeightCompact : fieldHeight,
        "min-w-0 flex-1 border-0 bg-transparent px-3 shadow-none outline-none",
        "placeholder:text-[var(--sales-field-placeholder)]",
        "focus:shadow-none focus-visible:shadow-none",
        "disabled:cursor-not-allowed disabled:text-sales-text-disabled",
        "read-only:bg-transparent",
        addonSide === "left" ? "rounded-l-none" : "rounded-r-none",
        className
      )}
      {...props}
    />
  );
});

export function InputGroupAction({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-stretch border-l border-[var(--sales-field-border)] bg-[var(--sales-surface-subtle)] p-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Attached compact action for grouped inputs — documentation / existing workflows only. */
export function InputGroupButton({
  children,
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      size="sm"
      variant="secondary"
      className={cn("h-full min-h-0 rounded-[6px] border-0 shadow-none", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
