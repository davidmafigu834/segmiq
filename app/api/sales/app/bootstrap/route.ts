import { handleSalesAppBootstrap } from "@/lib/mobile/sales-app/bootstrap";

export const dynamic = "force-dynamic";

/**
 * Sales app bootstrap (schemaVersion 1). Everything is derived from the
 * authenticated session; query parameters are ignored.
 * Contract: docs/android-integration/01-auth-and-bootstrap.md
 */
export async function GET(req: Request) {
  return handleSalesAppBootstrap(req);
}
