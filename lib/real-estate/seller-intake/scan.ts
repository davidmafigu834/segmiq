import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPrivateDocument } from "@/lib/real-estate/private-document-storage";
import { scanWithClamAv, scannerConfigured, storedScanStatus, verdictFromScan } from "@/lib/real-estate/compliance-management/scanner";

const FINISHED = new Set(["clean", "infected", "quarantined"]);
const RETRYABLE = new Set(["unscanned", "pending", "scanning", "scan_failed"]);

export function rejectClientScanStatus(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  return "scanStatus" in body || "scan_status" in body;
}

export function sellerScanTransition(input: {
  scannerConfigured: boolean;
  currentStatus: string;
  storedHash: string;
  actualHash: string | null;
  claimedStatus?: string | null;
  scannerResponse: string | null;
}): { status: string; changed: boolean; reason: "client_status" | "finished" | "scanner_missing" | "checksum" | "verdict" } {
  if (input.claimedStatus) return { status: input.currentStatus, changed: false, reason: "client_status" };
  if (FINISHED.has(input.currentStatus)) return { status: input.currentStatus, changed: false, reason: "finished" };
  if (!input.scannerConfigured) return { status: input.currentStatus === "scanning" ? "scan_failed" : input.currentStatus, changed: input.currentStatus === "scanning", reason: "scanner_missing" };
  if (!input.actualHash || input.actualHash !== input.storedHash) return { status: "scan_failed", changed: true, reason: "checksum" };
  const verdict = verdictFromScan({ response: input.scannerResponse, checksumMatches: true });
  const status = storedScanStatus(verdict) === "infected" ? "infected" : storedScanStatus(verdict);
  return { status, changed: status !== input.currentStatus, reason: "verdict" };
}

type Row = Record<string, unknown>;

function fail(status: number, error: string, code: string) {
  return { ok: false as const, status, error, code };
}

export async function scanSellerDocument(input: {
  clientId: string;
  documentId: string;
  claimedStatus?: string | null;
  readBytes?: (key: string) => Promise<Buffer>;
  exchange?: (bytes: Buffer) => Promise<string>;
}) {
  if (input.claimedStatus) return fail(400, "Scan status cannot be set by a request.", "SCAN_STATUS_REJECTED");
  const supabase = createAdminClient();
  const { data } = await supabase.from("re_seller_intake_documents").select("*").eq("id", input.documentId).eq("client_id", input.clientId).maybeSingle();
  if (!data) return fail(404, "File not found.", "NOT_FOUND");
  const row = data as Row;
  const current = String(row.scan_status ?? "unscanned");
  const storedHash = String(row.content_sha256 ?? "");
  const key = String(row.storage_key ?? "");
  if (FINISHED.has(current)) {
    return { ok: true as const, scanStatus: current, unchanged: true };
  }
  if (!RETRYABLE.has(current)) return fail(409, "This file cannot be scanned again.", "SCAN_CLOSED");
  const configured = scannerConfigured() || Boolean(input.exchange);
  if (!configured) return fail(503, "The compliance scanner is not configured. The file stays blocked.", "SCANNER_NOT_CONFIGURED");
  if (!key.startsWith(`clients/${input.clientId}/seller-intake/`) || key.includes("..")) {
    return fail(403, "File not found.", "NOT_FOUND");
  }
  await supabase.from("re_seller_intake_documents").update({ scan_status: "scanning" }).eq("id", input.documentId).eq("client_id", input.clientId).in("scan_status", ["unscanned", "pending", "scan_failed", "scanning"]);
  let bytes: Buffer;
  try {
    bytes = input.readBytes ? await input.readBytes(key) : await readPrivateDocument(key);
  } catch {
    await supabase.from("re_seller_intake_documents").update({ scan_status: "scan_failed" }).eq("id", input.documentId).eq("client_id", input.clientId);
    return fail(503, "The stored file could not be read. It stays blocked.", "SCAN_FAILED");
  }
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  let response: string | null = null;
  if (actualHash === storedHash) {
    const verdict = input.exchange ? await scanWithClamAv(bytes, input.exchange) : await scanWithClamAv(bytes);
    response = verdict.outcome === "clean" ? "stream: OK" : verdict.outcome === "infected" ? `stream: ${verdict.signature ?? "infected"} FOUND` : "";
  }
  const decision = sellerScanTransition({
    scannerConfigured: true,
    currentStatus: "scanning",
    storedHash,
    actualHash,
    scannerResponse: response,
  });
  const { error } = await supabase.from("re_seller_intake_documents").update({ scan_status: decision.status }).eq("id", input.documentId).eq("client_id", input.clientId);
  if (error) return fail(503, "The scan result could not be stored. The file stays blocked.", "SCAN_FAILED");
  return { ok: true as const, scanStatus: decision.status, unchanged: false };
}

export async function scanPendingSellerDocuments(limit = 5, exchange?: (bytes: Buffer) => Promise<string>, readBytes?: (key: string) => Promise<Buffer>) {
  if (!scannerConfigured() && !exchange) return { ok: false as const, code: "SCANNER_NOT_CONFIGURED", scanned: 0 };
  const supabase = createAdminClient();
  const pending = await supabase
    .from("re_seller_intake_documents")
    .select("id, client_id, scan_status")
    .in("scan_status", ["unscanned", "pending", "scanning", "scan_failed"])
    .limit(Math.min(limit, 10));
  const results = [];
  for (const row of pending.data ?? []) {
    results.push(await scanSellerDocument({
      clientId: String(row.client_id),
      documentId: String(row.id),
      exchange,
      readBytes,
    }));
  }
  return { ok: true as const, scanned: results.filter((item) => item.ok).length, results };
}
