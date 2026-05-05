import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-canvas">
      <header className="border-b border-border bg-surface-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded bg-accent" />
            <span className="font-serif text-xl tracking-tight text-ink-primary">Leadstaq</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/legal/privacy" className="text-ink-secondary hover:text-ink-primary">
              Privacy
            </Link>
            <Link href="/legal/terms" className="text-ink-secondary hover:text-ink-primary">
              Terms
            </Link>
            <Link href="/login" className="text-ink-secondary hover:text-ink-primary">
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">{children}</article>
      </main>

      <footer className="border-t border-border bg-surface-card">
        <div className="mx-auto flex max-w-3xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-ink-tertiary md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} Leadstaq. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/legal/privacy" className="hover:text-ink-primary">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-ink-primary">
              Terms
            </Link>
            <a href="mailto:legal@leadstaq.tech" className="hover:text-ink-primary">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
