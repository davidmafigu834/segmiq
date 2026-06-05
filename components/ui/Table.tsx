import { cn } from "@/lib/ui/cn";

/** Vercel-style table primitives. Wrap in a Card shell for the bordered container. */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full text-sm", className)} {...props} />;
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />;
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function TableRow({
  className,
  isHeader,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { isHeader?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-[var(--border)]",
        isHeader ? "" : "last:border-0 hover:bg-white/[0.02]",
        className
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  align = "left",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-[var(--text-primary)]",
        align === "right" ? "text-right tabular-nums" : "",
        className
      )}
      {...props}
    />
  );
}
