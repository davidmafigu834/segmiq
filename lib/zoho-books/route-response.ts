import { NextResponse } from "next/server";
import { ZohoBooksRequestError } from "./http";
import { migrationRequired } from "./store";

export function zohoRouteError(error: unknown) {
  if (migrationRequired(error)) {
    return NextResponse.json(
      { error: "Apply the Zoho Books database migrations before importing.", migrationRequired: true },
      { status: 503 }
    );
  }
  if (error instanceof ZohoBooksRequestError) {
    return NextResponse.json(
      { error: error.message, reconnect: error.revoked, quota: error.quota },
      { status: error.status || 502 }
    );
  }
  return NextResponse.json({ error: "Zoho Books could not be reached." }, { status: 502 });
}
