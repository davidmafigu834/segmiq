"use client";

export type ResponsiveTableColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  mobilePrimary?: boolean;
  mobileHidden?: boolean;
  align?: "left" | "right";
  width?: string;
};

export function ResponsiveTable<T>({
  columns,
  rows,
  onRowClick,
  rowKey,
  emptyState,
  rowClassName,
  minWidthClassName,
}: {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  emptyState?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
  /** Tailwind min-width class for the desktop table so it scrolls instead of cramming (e.g. "min-w-[800px]"). */
  minWidthClassName?: string;
}) {
  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
      <table className={["w-full", minWidthClassName ?? ""].filter(Boolean).join(" ")}>
        <thead>
          <tr className="border-b border-[var(--border-strong)]">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] whitespace-nowrap ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={[
                "border-b border-[var(--border)]",
                onRowClick ? "ag-row-hover cursor-pointer" : "",
                rowClassName?.(row) ?? "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {columns.map((col) => (
                <td key={col.key} style={col.width ? { width: col.width } : undefined} className={`px-4 py-3 text-[13px] text-[var(--text-primary)] ${col.align === "right" ? "text-right" : ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="space-y-2 lg:hidden">
        {rows.map((row) => {
          const extra = rowClassName?.(row);
          const primary = columns.filter((c) => c.mobilePrimary);
          const secondary = columns.filter((c) => !c.mobilePrimary && !c.mobileHidden);
          const inner = (
            <>
              {primary.map((col) => (
                <div key={col.key} className="mb-1">
                  {col.render(row)}
                </div>
              ))}
              {secondary.length > 0 ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3">
                  {secondary.map((col) => (
                    <div key={col.key}>
                      <dt className="mb-0.5 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
                        {col.label}
                      </dt>
                      <dd className="text-[13px] text-[var(--text-primary)]">{col.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </>
          );
          if (onRowClick) {
            return (
              <button
                key={rowKey(row)}
                type="button"
                onClick={() => onRowClick(row)}
                className={[
                  "w-full rounded-md border border-[var(--border)] bg-surface-card p-4 text-left hover:bg-surface-card-alt hover:border-[var(--border-hover)] transition-colors",
                  extra ?? "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {inner}
              </button>
            );
          }
          return (
            <div
              key={rowKey(row)}
              className={["w-full rounded-md border border-[var(--border)] bg-surface-card p-4", extra ?? ""].filter(Boolean).join(" ")}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </>
  );
}
