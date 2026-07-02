export const dynamic = "force-dynamic";

/** Public magic-link route: constrain width and clip horizontal overflow on small viewports. */
export default function LeadTokenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full min-w-0 max-w-[100vw] overflow-x-hidden bg-surface-canvas">{children}</div>
  );
}
