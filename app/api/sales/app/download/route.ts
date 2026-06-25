import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const file = await readFile(join(process.cwd(), "public/downloads/segmiq-sales.apk"));
    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="segmiq-sales.apk"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "APK not found" }, { status: 404 });
  }
}
