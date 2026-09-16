import { cn } from "@/lib/ui/cn";

/** List-style table primitives. Wrap in a Card shell for the bordered container. */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
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
        "border-b border-[var(--border)] transition-colors duration-150",
        isHeader ? "bg-surface-card-alt" : "last:border-0 hover:bg-surface-card-alt",
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
        "whitespace-nowrap px-[18px] py-3.5 text-[11px] font-medium tracking-[0.01em] text-[var(--text-tertiary)]",
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
        "px-[18px] py-4 leading-5 text-[var(--text-primary)]",
        align === "right" ? "text-right tabular-nums" : "",
        className
      )}
      {...props}
    />
  );
}
