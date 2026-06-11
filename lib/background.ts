import { waitUntil } from "@vercel/functions";

/**
 * Fire a promise without blocking the caller. Errors are logged, never thrown.
 * On Vercel, uses `waitUntil` so the serverless invocation stays alive until the task finishes.
 */
export function background(taskName: string, task: () => Promise<void>): void {
  const run = task().catch((err: unknown) => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        event: "background.task.failed",
        taskName,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    );
  });

  try {
    if (typeof waitUntil === "function") {
      waitUntil(run);
      return;
    }
  } catch {
    /* not on Vercel */
  }

  void run;
}
