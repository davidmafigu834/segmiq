import { ReSkeletonRows } from "@/components/real-estate/ui/primitives";

export function RealEstatePageBones({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="mb-4 space-y-2">
        <span className="re-bone block h-8 w-40 max-w-full rounded-[6px]" />
        <span className="re-bone block h-3.5 w-72 max-w-full rounded-[4px]" />
      </div>
      <section className="overflow-hidden rounded-[12px] border border-sales-border bg-sales-surface">
        <ReSkeletonRows rows={6} label={label} />
      </section>
    </div>
  );
}
