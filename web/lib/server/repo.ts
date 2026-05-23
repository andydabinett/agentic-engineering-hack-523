import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import { config as loadEnv } from "dotenv";

/** Next.js cwd is `web/` — repo root is one level up (also set in next.config.mjs). */
export const REPO_ROOT =
  process.env.REPO_ROOT?.trim() || path.resolve(process.cwd(), "..");

export const SQLITE_DB_PATH = path.join(REPO_ROOT, "data", "listings.db");

export function sqliteDatabaseExists(): boolean {
  try {
    return fs.existsSync(SQLITE_DB_PATH);
  } catch {
    return false;
  }
}

/** Next.js runs from web/ — load repo root .env so API routes see the same keys as CLI. */
loadEnv({ path: path.join(REPO_ROOT, ".env") });

function repoImport(rel: string) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    return Promise.reject(
      new Error(`Repo module not found: ${abs} (REPO_ROOT=${REPO_ROOT})`),
    );
  }
  // webpackIgnore: Next must not bundle parent-dir ESM; load at runtime via file URL.
  return import(/* webpackIgnore: true */ pathToFileURL(abs).href);
}

/** Dynamic import of root ESM modules (SQLite ingest pipeline). */
export function loadListingsApi() {
  return repoImport("src/bridge/listingsApi.js");
}

export function loadClickHouseAnalytics() {
  return repoImport("src/clickhouse/sync.js");
}

/** Pi agent chat bridge for /api/chat */
export function loadChatAgent() {
  return repoImport("src/bridge/chatAgent.js");
}

export function loadAgentScrape() {
  return repoImport("src/crawler/agentScrape.js");
}

export function loadCorrespondenceBridge() {
  return repoImport("src/bridge/correspondenceService.js");
}
