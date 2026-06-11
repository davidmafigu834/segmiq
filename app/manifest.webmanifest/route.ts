import { NextResponse } from "next/server";
import { buildCloudManifest } from "@/lib/cloud/manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  const manifest = buildCloudManifest();
  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
