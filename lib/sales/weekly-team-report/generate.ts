import { collectWeeklyTeamSnapshot } from "./collect";
import { generateWeeklyReportAi } from "./ai";
import { buildFallbackAi } from "./fallback";
import { mergeAiIntoPayload } from "./analyse";
import { renderWeeklyTeamReportPdf } from "./pdf";
import { notifyWeeklyReportReady } from "./notify";
import {
  claimOrCreateReport,
  findReportById,
  persistPayloadPatch,
  tryStartGeneration,
  updateReport,
  listDueClientIds,
  resolveClientTimezone,
} from "./store";
import { MAX_GENERATIONS_PER_CRON } from "./config";
import { immediatelyPreviousWeek, isPeriodComplete, previousCompletedWeek } from "./period";
import { generateWeeklyTeamReportKey, isR2Configured, putObject } from "@/lib/storage/r2";
import { resolveSalesTimezone } from "@/lib/sales/intelligence/timezone";
import type { WeekPeriod } from "./types";

function logEvent(event: string, extra: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...extra,
    })
  );
}

export async function generateWeeklyTeamReport(opts: {
  clientId: string;
  period: WeekPeriod;
  generatedByKind: "system" | "user";
  generatedByUserId?: string | null;
  force?: boolean;
}): Promise<{ reportId: string; status: string; duplicate: boolean }> {
  if (!isPeriodComplete(opts.period, new Date()) && opts.generatedByKind === "system" && !opts.force) {
    return { reportId: "", status: "skipped_incomplete_period", duplicate: false };
  }

  const claimed = await claimOrCreateReport(opts);
  if (claimed.duplicate && claimed.row.generation_status === "ready" && !opts.force) {
    logEvent("weekly_report.generation.skipped_duplicate", {
      clientId: opts.clientId,
      reportId: claimed.row.id,
      periodStart: opts.period.startDate,
    });
    return { reportId: claimed.row.id, status: "ready", duplicate: true };
  }
  if (claimed.duplicate && !opts.force) {
    return { reportId: claimed.row.id, status: claimed.row.generation_status, duplicate: true };
  }

  const reportId = claimed.row.id;
  const started = await tryStartGeneration(opts.clientId, reportId);
  if (!started && !opts.force) {
    const latest = await findReportById(opts.clientId, reportId);
    return {
      reportId,
      status: latest?.generation_status ?? claimed.row.generation_status,
      duplicate: true,
    };
  }
  if (opts.force && !started) {
    await updateReport(opts.clientId, reportId, {
      generation_status: "collecting_data",
      started_at: new Date().toISOString(),
      generation_error: null,
    });
  }

  logEvent("weekly_report.generation.started", {
    clientId: opts.clientId,
    reportId,
    periodStart: opts.period.startDate,
    periodEnd: opts.period.endDate,
    version: claimed.row.report_version,
  });

  try {
    await updateReport(opts.clientId, reportId, {
      generation_error: null,
    });

    const previousPeriod = immediatelyPreviousWeek(opts.period);
    const snapshot = await collectWeeklyTeamSnapshot({
      clientId: opts.clientId,
      period: opts.period,
      previousPeriod,
    });

    await updateReport(opts.clientId, reportId, { generation_status: "analysing" });

    let aiStatus: "ok" | "fallback" | "failed" = "fallback";
    let model: string | null = null;
    let ai = buildFallbackAi(snapshot);
    try {
      const generated = await generateWeeklyReportAi(snapshot);
      if (generated.output) {
        ai = { ...ai, ...generated.output, salespersonNarratives: generated.output.salespersonNarratives };
        aiStatus = "ok";
        model = generated.model;
      } else {
        aiStatus = "fallback";
      }
    } catch (err) {
      aiStatus = "failed";
      logEvent("weekly_report.ai.failed", {
        clientId: opts.clientId,
        reportId,
        error: err instanceof Error ? err.message : "ai_failed",
      });
    }

    const payload = mergeAiIntoPayload(snapshot, ai);
    await updateReport(opts.clientId, reportId, {
      generation_status: "generating",
      ai_status: aiStatus,
      ai_model_reference: model,
      ...persistPayloadPatch(payload),
    });

    let pdfStatus: "ok" | "failed" | "skipped" = "skipped";
    let fileKey: string | null = null;
    try {
      const buffer = await renderWeeklyTeamReportPdf(payload);
      if (isR2Configured()) {
        fileKey = generateWeeklyTeamReportKey(opts.clientId, reportId);
        await putObject(fileKey, buffer, "application/pdf", {
          contentDisposition: `attachment; filename="weekly-sales-report-${opts.period.startDate}.pdf"`,
          cacheControl: "private, max-age=0",
        });
        pdfStatus = "ok";
      } else if (process.env.NODE_ENV === "development") {
        fileKey = `memory:${reportId}`;
        pdfStatus = "ok";
      } else {
        throw new Error("Private file storage is not configured");
      }
    } catch (err) {
      pdfStatus = "failed";
      logEvent("weekly_report.pdf.failed", {
        clientId: opts.clientId,
        reportId,
        error: err instanceof Error ? err.message : "pdf_failed",
      });
      await updateReport(opts.clientId, reportId, {
        pdf_status: "failed",
        generation_status: "failed",
        generation_error: err instanceof Error ? err.message : "pdf_failed",
        completed_at: new Date().toISOString(),
      });
      return { reportId, status: "failed", duplicate: false };
    }

    const completedAt = new Date().toISOString();
    await updateReport(opts.clientId, reportId, {
      generation_status: "ready",
      pdf_status: pdfStatus,
      file_key: fileKey,
      generated_at: completedAt,
      completed_at: completedAt,
    });

    const latest = await findReportById(opts.clientId, reportId);
    if (!latest?.notified_at) {
      await notifyWeeklyReportReady({
        clientId: opts.clientId,
        reportId,
        period: opts.period,
      });
      await updateReport(opts.clientId, reportId, { notified_at: completedAt });
    }

    logEvent("weekly_report.generation.completed", {
      clientId: opts.clientId,
      reportId,
      periodStart: opts.period.startDate,
      aiStatus,
      pdfStatus,
    });
    return { reportId, status: "ready", duplicate: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation_failed";
    logEvent("weekly_report.generation.failed", {
      clientId: opts.clientId,
      reportId,
      error: message,
    });
    await updateReport(opts.clientId, reportId, {
      generation_status: "failed",
      generation_error: message.slice(0, 500),
      completed_at: new Date().toISOString(),
    });
    return { reportId, status: "failed", duplicate: false };
  }
}

export async function runWeeklyTeamReportCron(now = new Date()): Promise<{
  scanned: number;
  generated: number;
  skipped: number;
  failed: number;
}> {
  const clientIds = await listDueClientIds();
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  for (const clientId of clientIds) {
    if (generated >= MAX_GENERATIONS_PER_CRON) break;
    const timezone = resolveSalesTimezone(await resolveClientTimezone(clientId));
    const period = previousCompletedWeek(now, timezone);
    if (!isPeriodComplete(period, now)) {
      skipped += 1;
      continue;
    }
    const result = await generateWeeklyTeamReport({
      clientId,
      period: { ...period, timezone },
      generatedByKind: "system",
    });
    if (result.duplicate || result.status === "skipped_incomplete_period") skipped += 1;
    else if (result.status === "ready") generated += 1;
    else if (result.status === "failed") failed += 1;
    else skipped += 1;
  }
  return { scanned: clientIds.length, generated, skipped, failed };
}
