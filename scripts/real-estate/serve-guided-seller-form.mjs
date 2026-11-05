import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, normalize } from "node:path";

const root = join(process.cwd(), "docs", "verification", "samples", "guided-form");
const allowed = new Set(["/open-individual.html", "/open-company.html", "/open-review.html", "/sole-individual.html"]);

createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
  if (!allowed.has(path)) {
    res.writeHead(404);
    res.end("missing");
    return;
  }
  const file = normalize(join(root, path));
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(readFileSync(file));
}).listen(8766, "127.0.0.1");
