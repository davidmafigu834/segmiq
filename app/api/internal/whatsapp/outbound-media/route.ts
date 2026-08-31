import { NextResponse } from "next/server";
import { getObjectWithMeta, isR2Configured } from "@/lib/storage/r2";
import { verifyGatewayOutboundMediaToken } from "@/lib/whatsapp/gateway-media-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key")?.trim() ?? "";
  const exp = url.searchParams.get("exp")?.trim() ?? "";
  const sig = url.searchParams.get("sig")?.trim() ?? "";

  if (!verifyGatewayOutboundMediaToken(key, exp, sig)) {
    return NextResponse.json({ error: "Invalid or expired media token" }, { status: 401 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "File storage is not configured" }, { status: 503 });
  }

  try {
    const { body, contentType } = await getObjectWithMeta(key);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": contentType?.trim() || "application/octet-stream",
        "content-length": String(body.length),
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
}
