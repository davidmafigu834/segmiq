export default function CloudShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full scroll-smooth bg-white text-[var(--fw-text-primary)] [font-family:var(--fw-font-body)]">
      {children}
    </div>
  );
}
