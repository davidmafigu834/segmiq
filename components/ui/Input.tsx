import { forwardRef } from "react";
import { cn } from "@/lib/ui/cn";

const inputBase =
  "h-10 px-3 text-sm rounded-md bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--border-hover)] focus:ring-1 focus:ring-[var(--accent)]/40 transition-colors";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(inputBase, "w-full", className)} {...props} />;
});

/** Wrapper that fuses a prefix/suffix addon to an input (the `vercel.com/` pattern). */
export function InputGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex w-full items-stretch", className)} {...props} />;
}

/** Recessed addon segment fused to an input. `side` controls the rounded corners. */
export function InputAddon({
  side = "left",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { side?: "left" | "right" }) {
  return (
    <span
      className={cn(
        "inline-flex h-10 items-center px-3 text-sm bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] border border-[var(--border)]",
        side === "left" ? "rounded-l-md border-r-0" : "rounded-r-md border-l-0",
        className
      )}
      {...props}
    />
  );
}

/** Input variant pre-styled to fuse with an InputAddon on the given side. */
export const GroupedInput = forwardRef<
  HTMLInputElement,
  InputProps & { addonSide?: "left" | "right" }
>(function GroupedInput({ className, addonSide = "left", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        inputBase,
        "w-full",
        addonSide === "left" ? "rounded-l-none" : "rounded-r-none",
        className
      )}
      {...props}
    />
  );
});
