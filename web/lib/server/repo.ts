import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { config as loadEnv } from "dotenv";

const webRoot = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(webRoot, "../../..");

/** Next.js runs from web/ — load repo root .env so API routes see the same keys as CLI. */
loadEnv({ path: path.join(REPO_ROOT, ".env") });

function repoImport(rel: string) {
  const abs = path.join(REPO_ROOT, rel);
  return import(pathToFileURL(abs).href);
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
