import { NextResponse } from "next/server";
import { REPO_ROOT } from "@/lib/server/repo";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  const dbPath = path.join(REPO_ROOT, "data", "listings.db");
  const dbExists = fs.existsSync(dbPath);

  return NextResponse.json({
    ok: true,
    service: "javier-nyc-rent",
    sqlite: dbExists ? "present" : "missing",
    env: {
      nimble: Boolean(process.env.NIMBLE_API_KEY),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      clickhouse:
        Boolean(process.env.CLICKHOUSE_HOST) &&
        Boolean(
          process.env.CLICKHOUSE_API_KEY ||
            process.env.CLICKHOUSE_PASSWORD ||
            process.env.CLICKHOUSE_URL,
        ),
    },
  });
}
