import net from "node:net";

export type ScanOutcome = "clean" | "infected" | "scan_failed";

export type ScanVerdict = {
  outcome: ScanOutcome;
  engine: "clamav";
  signature: string | null;
};

export function scannerConfigured(): boolean {
  return Boolean(process.env.COMPLIANCE_CLAMAV_HOST?.trim());
}

/** A file type, a client field, or a missing engine cannot produce a clean verdict. */
export function verdictFromScan(input: {
  response: string | null;
  claimedStatus?: string | null;
  checksumMatches: boolean;
}): ScanVerdict {
  if (input.claimedStatus) return { outcome: "scan_failed", engine: "clamav", signature: null };
  if (!input.checksumMatches) return { outcome: "scan_failed", engine: "clamav", signature: null };
  return parseClamAvResponse(input.response);
}

export function parseClamAvResponse(response: string | null | undefined): ScanVerdict {
  const line = (response ?? "").trim();
  if (!line) return { outcome: "scan_failed", engine: "clamav", signature: null };
  if (/^stream:\s+OK\s*$/i.test(line)) return { outcome: "clean", engine: "clamav", signature: null };
  const found = line.match(/^stream:\s+(.+?)\s+FOUND\s*$/i);
  if (found) return { outcome: "infected", engine: "clamav", signature: found[1]?.trim() || "unknown" };
  return { outcome: "scan_failed", engine: "clamav", signature: null };
}

export function storedScanStatus(verdict: ScanVerdict): "clean" | "infected" | "scan_failed" {
  if (verdict.outcome === "clean") return "clean";
  if (verdict.outcome === "infected") return "infected";
  return "scan_failed";
}

export async function scanWithClamAv(bytes: Buffer, exchange?: (payload: Buffer) => Promise<string>): Promise<ScanVerdict> {
  const host = process.env.COMPLIANCE_CLAMAV_HOST?.trim();
  if (!host && !exchange) return { outcome: "scan_failed", engine: "clamav", signature: null };
  try {
    const response = exchange ? await exchange(bytes) : await clamAvInstream(bytes, host!, Number(process.env.COMPLIANCE_CLAMAV_PORT || 3310));
    return parseClamAvResponse(response);
  } catch {
    return { outcome: "scan_failed", engine: "clamav", signature: null };
  }
}

function clamAvInstream(bytes: Buffer, host: string, port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("scan timed out"));
    }, 20_000);
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.on("close", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    socket.write("zINSTREAM\0");
    const size = Buffer.alloc(4);
    const chunkSize = 1024 * 64;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const slice = bytes.subarray(offset, offset + chunkSize);
      size.writeUInt32BE(slice.length, 0);
      socket.write(size);
      socket.write(slice);
    }
    size.writeUInt32BE(0, 0);
    socket.write(size);
    socket.end();
  });
}
