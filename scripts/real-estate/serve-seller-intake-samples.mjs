import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, normalize } from "node:path";

const root = join(process.cwd(), "docs", "verification", "samples");
const allowed = new Set([
  "/mock-previews.html",
  "/pdf-layout.html",
  "/synthetic-individual-open.pdf",
  "/synthetic-company-open.pdf",
  "/synthetic-sole-continuation.pdf",
]);

createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  if (!allowed.has(path)) {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  const file = normalize(join(root, path));
  const body = readFileSync(file);
  res.writeHead(200, { "Content-Type": path.endsWith(".pdf") ? "application/pdf" : "text/html; charset=utf-8" });
  res.end(body);
}).listen(8765, "127.0.0.1");
