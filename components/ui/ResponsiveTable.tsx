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
}: {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  emptyState?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
}) {
  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <>
      <table className="hidden w-full lg:table">
        <thead>
          <tr className="border-b border-border-strong">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={`py-3 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-ink-tertiary ${
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
                "border-b border-border",
                onRowClick ? "cursor-pointer hover:bg-surface-card-alt" : "",
                rowClassName?.(row) ?? "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {columns.map((col) => (
                <td key={col.key} style={col.width ? { width: col.width } : undefined} className={`py-3 ${col.align === "right" ? "text-right" : ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

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
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
                  {secondary.map((col) => (
                    <div key={col.key}>
                      <dt className="mb-0.5 font-mono text-[10px] uppercase tracking-wide text-ink-tertiary">
                        {col.label}
                      </dt>
                      <dd className="text-sm text-ink-primary">{col.render(row)}</dd>
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
                  "w-full rounded-lg border border-border bg-surface-card p-4 text-left active:bg-surface-card-alt",
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
              className={["w-full rounded-lg border border-border bg-surface-card p-4", extra ?? ""].filter(Boolean).join(" ")}
            >
              {inner}
            </div>
          );
        })}
      </div>
    </>
  );
}
