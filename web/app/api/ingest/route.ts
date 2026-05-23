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
  if (!boroughs?.length && body.criteria) {
    const api = await loadListingsApi();
    boroughs = api.boroughIdsFromCriteria(body.criteria);
  }
  if (!boroughs?.length) boroughs = ["brooklyn"];
  const maxResults = body.maxResults ?? 3;
  const args = [
    "--boroughs",
    boroughs.join(" "),
    "--max-results",
    String(maxResults),
    "--depth",
    "deep",
  ];

  try {
    const result = await runIngest(args);
    const ok = result.code === 0;
    return NextResponse.json(
      {
        ok,
        boroughs,
        maxResults,
        stdout: result.stdout.slice(-4000),
        stderr: result.stderr.slice(-2000),
      },
      { status: ok ? 200 : 500 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
