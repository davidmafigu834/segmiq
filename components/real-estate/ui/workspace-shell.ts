/** Padding the company canvas and sales shell already provide. */
export const reEmbeddedShell =
  "flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch gap-[var(--re-section-gap,16px)] overflow-x-clip text-left";

/**
 * Salesperson pages that are not inside the company canvas.
 * Below 1100px the sales page owns the single 16px gutter, matching the manager canvas.
 */
export const reSalesShell =
  "flex min-h-0 w-full min-w-0 max-w-none flex-1 flex-col items-stretch self-stretch gap-[var(--re-section-gap,16px)] overflow-x-clip px-4 py-4 pb-[calc(var(--sales-mobile-nav-height,64px)+28px)] text-left max-[1099px]:px-0 md:pb-6";
