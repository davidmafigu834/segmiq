export function OfflineBanner() {
  return (
    <div className="border-b border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-2 text-center text-[13px] font-medium text-[var(--warning)]">
      You&apos;re offline — call logs will sync when you&apos;re back online
    </div>
  );
}
