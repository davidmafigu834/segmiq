import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Pricing package";

type ClientRow = {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
};

type PackageRow = {
  name: string;
  tagline: string | null;
  currency: string;
  price_from: number | null;
  price_label: string | null;
};

function formatMainPrice(pkg: PackageRow): string | null {
  if (pkg.price_label) return pkg.price_label;
  if (pkg.price_from != null) {
    return `${pkg.currency} ${Number(pkg.price_from).toLocaleString()}`;
  }
  return null;
}

function hasAbsoluteLogo(logoUrl: string | null | undefined): logoUrl is string {
  return typeof logoUrl === "string" && /^https?:\/\//.test(logoUrl);
}

function PoweredByMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 8, height: 8, background: "#D4FF4F" }} />
      <span style={{ fontSize: 18, color: "#8C7B6B" }}>Powered by Segmiq</span>
    </div>
  );
}

function FallbackCard() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#F7F4EF",
      }}
    >
      <div style={{ width: 14, background: "#0F7A4F", flexShrink: 0 }} />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 56px",
        }}
      >
        <span style={{ fontSize: 40, fontWeight: 700, color: "#1C1410" }}>Pricing package</span>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <PoweredByMark />
        </div>
      </div>
    </div>
  );
}

export default async function PackageOpenGraphImage({
  params,
}: {
  params: { slug: string; packageSlug: string };
}) {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from("client_profiles")
    .select("client_id, clients(name, logo_url, primary_color)")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!profile) {
    return new ImageResponse(<FallbackCard />, { ...size });
  }

  const clientId = profile.client_id as string;
  const client = profile.clients as unknown as ClientRow | null;
  if (!client) {
    return new ImageResponse(<FallbackCard />, { ...size });
  }

  const { data: pkg } = await supabase
    .from("pricing_packages")
    .select("name, tagline, currency, price_from, price_label")
    .eq("client_id", clientId)
    .eq("slug", params.packageSlug)
    .eq("is_public", true)
    .maybeSingle();

  if (!pkg) {
    return new ImageResponse(<FallbackCard />, { ...size });
  }

  const typedPkg = pkg as PackageRow;
  const brandColor = client.primary_color ?? "#0F7A4F";
  const mainPrice = formatMainPrice(typedPkg);
  const showLogo = hasAbsoluteLogo(client.logo_url);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#F7F4EF",
        }}
      >
        <div style={{ width: 14, background: brandColor, flexShrink: 0 }} />
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            padding: "48px 56px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={client.logo_url!} height={56} alt="" />
            ) : (
              <span style={{ fontSize: 36, fontWeight: 700, color: "#1C1410" }}>{client.name}</span>
            )}
          </div>

          <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                color: "#1C1410",
                lineHeight: 1.1,
                marginBottom: 20,
                maxWidth: 1000,
              }}
            >
              {typedPkg.name}
            </div>
            {mainPrice && (
              <div style={{ fontSize: 40, fontWeight: 700, color: brandColor }}>{mainPrice}</div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 24,
            }}
          >
            {typedPkg.tagline ? (
              <div
                style={{
                  fontSize: 22,
                  color: "#8C7B6B",
                  maxWidth: 720,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {typedPkg.tagline}
              </div>
            ) : (
              <div />
            )}
            <PoweredByMark />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
