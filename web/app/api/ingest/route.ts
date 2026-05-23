import path from "path";
import { spawn } from "child_process";
import { NextResponse } from "next/server";
import { requireApiSecret } from "@/lib/server/apiAuth";
import { requireNode22 } from "@/lib/server/nodeRuntime";
import { loadListingsApi, REPO_ROOT } from "@/lib/server/repo";

export const runtime = "nodejs";
export const maxDuration = 300;

function ingestPreflight(): { ok: true } | { ok: false; error: string; status: number } {
  const nodeError = requireNode22("Ingest");
  if (nodeError) {
    return { ok: false, status: 503, error: nodeError };
  }
  if (!process.env.NIMBLE_API_KEY?.trim()) {
    return {
      ok: false,
      status: 503,
      error: "NIMBLE_API_KEY is missing. Add it to the repo root .env (see .env.example).",
    };
  }
  return { ok: true };
}

function runIngest(args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const script = path.join(REPO_ROOT, "scripts/ingest-boroughs.js");
    const tsxCli = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");
    const child = spawn(process.execPath, [tsxCli, script, ...args], {
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
  const unauthorized = requireApiSecret(request);
  if (unauthorized) return unauthorized;

  const preflight = ingestPreflight();
  if (!preflight.ok) {
    return NextResponse.json({ ok: false, error: preflight.error }, { status: preflight.status });
  }

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
  const maxResults = body.maxResults ?? 8;
  const neighborhood =
    typeof body.criteria?.neighborhood === "string"
      ? body.criteria.neighborhood.trim()
      : "";
  const fakeOrDev =
    process.env.CORRESPONDENCE_FAKE_DEMO === "1" ||
    process.env.CORRESPONDENCE_DEV === "1";
  const args = [
    "--boroughs",
    boroughs.join(" "),
    "--max-results",
    String(maxResults),
    "--depth",
    fakeOrDev ? "lite" : "deep",
  ];
  if (neighborhood) {
    args.push("--neighborhood", neighborhood);
  }
  if (fakeOrDev) {
    // Fake/demo: Nimble search only (~2–5s); demo phones filled in at read time.
    args.push("--allow-no-phone", "--no-playwright", "--no-enrich");
  }
  if (process.env.CLOUD_INGEST === "1") {
    args.push("--no-playwright");
  }

  try {
    const result = await runIngest(args);
    const ok = result.code === 0;
    const storedTotal = [...result.stdout.matchAll(/stored=(\d+)/g)].reduce(
      (sum, match) => sum + Number(match[1]),
      0,
    );
    return NextResponse.json(
      {
        ok,
        boroughs,
        maxResults,
        storedTotal,
        neighborhood: neighborhood || undefined,
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
