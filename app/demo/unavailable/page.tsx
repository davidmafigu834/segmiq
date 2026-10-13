export const dynamic = "force-dynamic";

export default function DemoUnavailablePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">SegmiQ demonstration</p>
      <h1 className="mt-3 text-2xl font-semibold text-neutral-950">This part of the demonstration is not available</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        The link may have expired, or this screen is outside the current demonstration. Nothing here is a live customer
        workspace, and no message has been sent.
      </p>
    </main>
  );
}
