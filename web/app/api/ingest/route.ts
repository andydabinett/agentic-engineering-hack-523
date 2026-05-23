import { spawn } from "child_process";
import path from "path";
import { NextResponse } from "next/server";
import { loadListingsApi, REPO_ROOT } from "@/lib/server/repo";

export const runtime = "nodejs";
export const maxDuration = 300;

function runIngest(args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const script = path.join(REPO_ROOT, "scripts/ingest-boroughs.js");
    const child = spawn(process.execPath, [script, ...args], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export async function POST(request: Request) {
  let body: { boroughs?: string[]; maxResults?: number; criteria?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body ok */
  }

  let boroughs = body.boroughs;
  if (body.criteria) {
    const api = await loadListingsApi();
    await api.saveCriteria(body.criteria);
    if (!boroughs?.length) {
      boroughs = api.boroughIdsFromCriteria(body.criteria);
    }
  }
  if (!boroughs?.length) boroughs = ["brooklyn"];
  const maxResults = body.maxResults ?? 3;

  try {
    const { loadAgentScrape } = await import("@/lib/server/repo");
    const { startAgentScrape } = await loadAgentScrape();
    const result = startAgentScrape({
      boroughs,
      maxResults,
      criteria: body.criteria,
    });
    return NextResponse.json({
      ok: result.ok,
      boroughs,
      maxResults,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
