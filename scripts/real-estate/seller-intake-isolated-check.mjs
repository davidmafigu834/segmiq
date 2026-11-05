import { spawnSync } from "node:child_process";

const tools = ["docker", "supabase", "psql"];
for (const tool of tools) {
  const found = spawnSync("where.exe", [tool], { encoding: "utf8" });
  console.log(`${tool}: ${found.status === 0 ? "present" : "absent"}`);
}

if (!process.env.SELLER_INTAKE_ISOLATED_DATABASE_URL) {
  console.log("No isolated database URL was provided. This check does not read or write a configured application database.");
  console.log("When an empty local Postgres is available, apply only these files, in order, to that database:");
  console.log("supabase/migrations/20261105140000_real_estate_seller_intake.sql");
  console.log("supabase/migrations/20261105160000_real_estate_seller_intake_access.sql");
  console.log("Do not apply them to the live project. Do not set RE_SELLER_INTAKE there.");
  process.exit(2);
}

console.log("An isolated URL is set. This script still does not apply SQL. Use psql against that URL only after confirming the host is not the live project.");
process.exit(0);
