/** @type {import('next').NextConfig} */

const _appDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN || "leadstaq.tech")
  .replace(/^https?:\/\//i, "")
  .split("/")[0];
const _cloudHost = `cloud.${_appDomain}`;

function r2PublicPattern() {
  const raw = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return { protocol: "https", hostname: url.hostname, pathname: "/**" };
  } catch {
    return null;
  }
}

function cloudRewrites(host) {
  return [
    { source: "/", has: [{ type: "host", value: host }], destination: "/cloud" },
    { source: "/login", has: [{ type: "host", value: host }], destination: "/cloud/login" },
    { source: "/signup", has: [{ type: "host", value: host }], destination: "/cloud/signup" },
    { source: "/forgot-password", has: [{ type: "host", value: host }], destination: "/cloud/forgot-password" },
    { source: "/dashboard/:path*", has: [{ type: "host", value: host }], destination: "/cloud/dashboard/:path*" },
    { source: "/share/:path*", has: [{ type: "host", value: host }], destination: "/cloud/share/:path*" },
  ];
}

function r2ConnectSrc() {
  const raw = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim();
  if (!raw) return "https://*.r2.dev https://*.r2.cloudflarestorage.com";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://*.r2.dev https://*.r2.cloudflarestorage.com";
  }
}

function supabaseConnectSrc() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return "https://*.supabase.co";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

function buildCsp() {
  const appDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN || "segmiq.com")
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0];
  const connect = [
    "'self'",
    supabaseConnectSrc(),
    r2ConnectSrc(),
    "https://graph.facebook.com",
    "https://www.facebook.com",
    `https://*.${appDomain}`,
    `https://${appDomain}`,
  ].join(" ");
  const img = [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    "https://*.fbcdn.net",
    "https://scontent.xx.fbcdn.net",
    r2ConnectSrc(),
    "https://images.unsplash.com",
  ].join(" ");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img}`,
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "report-uri /api/security/csp-report",
    "upgrade-insecure-requests",
  ].join("; ");
}

function securityHeaders() {
  const isProd = process.env.NODE_ENV === "production";
  const enforceCsp = process.env.CSP_ENFORCE === "true";
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=()",
    },
    {
      key: enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      value: buildCsp(),
    },
  ];
  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }
  return headers;
}

const nextConfig = {
  // Avoid webpack splitting issues with Supabase in Server Components / RSC (missing vendor-chunks).
  experimental: {
    outputFileTracingIncludes: {
      "/api/**/*": ["./lib/quotations/fonts/roboto/**/*"],
      "/dev/**/*": ["./lib/quotations/fonts/roboto/**/*"],
    },
    serverComponentsExternalPackages: [
      "@supabase/supabase-js",
      "@react-pdf/renderer",
      "puppeteer-core",
      "@sparticuz/chromium-min",
      "sharp",
      "archiver",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [...externals, "puppeteer-core", "@sparticuz/chromium-min", "archiver"];
    }
    return config;
  },
  async rewrites() {
    return [
      { source: "/downloads/segmiq-cloud-field.apk", destination: "/api/cloud/app/download" },
      ...cloudRewrites(_cloudHost),
      ...cloudRewrites("cloud.segmiq.com"),
      ...cloudRewrites("cloud.localhost:3000"),
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
      { protocol: "https", hostname: "scontent.xx.fbcdn.net", pathname: "/**" },
      { protocol: "https", hostname: "*.fbcdn.net", pathname: "/**" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com", pathname: "/**" },
      { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      ...(r2PublicPattern() ? [r2PublicPattern()] : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders(),
      },
    ];
  },
};

export default nextConfig;
