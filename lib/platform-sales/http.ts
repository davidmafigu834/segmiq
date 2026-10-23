export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("Missing Origin header");
  if (new URL(origin).origin !== new URL(request.url).origin)
    throw new Error("Cross-origin request rejected");
}
