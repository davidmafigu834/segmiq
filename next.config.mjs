/** @type {import('next').NextConfig} */

const _appDomain = (process.env.NEXT_PUBLIC_APP_DOMAIN || "leadstaq.tech")
  .replace(/^https?:\/\//i, "")
  .split("/")[0];
const _cloudHost = `cloud.${_appDomain}`;

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

const nextConfig = {
  // Avoid webpack splitting issues with Supabase in Server Components / RSC (missing vendor-chunks).
  experimental: {
    serverComponentsExternalPackages: ["@supabase/supabase-js"],
  },
  async rewrites() {
    return [
      ...cloudRewrites(_cloudHost),
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
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
