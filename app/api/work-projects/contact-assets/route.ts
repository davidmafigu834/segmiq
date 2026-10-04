import { NextResponse } from "next/server";
import { workProjectActor } from "@/lib/work-projects/http";
import { listContactAssets } from "@/lib/work-projects/installation-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await workProjectActor(req);
  if (!actor?.clientId) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const contactId = new URL(req.url).searchParams.get("contactId");
  if (!contactId) return NextResponse.json({ assets: [] });
  const assets = await listContactAssets(actor.clientId, contactId);
  return NextResponse.json({
    assets: assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      assetType: asset.asset_type,
      status: asset.status,
      quantity: asset.quantity,
      unit: asset.unit,
      serialNumber: asset.serial_number,
      siteName: asset.site_name,
      siteAddress: asset.site_address,
      installedAt: asset.installed_at,
      parentAssetId: asset.parent_asset_id,
    })),
  });
}
