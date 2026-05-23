import { parseArgs, flagList } from '../cli/parseArgs.js';
import { parseDurationMs } from './parseDuration.js';

const DEFAULT_INGEST_INTERVAL_MS = 2 * 60_000;
const DEFAULT_VERIFY_INTERVAL_MS = 60 * 60_000;
const DEFAULT_POLL_MS = 60_000;

function envBool(name, fallback) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(v).toLowerCase());
}

function envInt(name, fallback) {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** @param {ReturnType<typeof parseArgs>} [cli] */
export function getCrawlerConfig(cli = parseArgs()) {
  const cloudIngest = process.env.CLOUD_INGEST === '1';

  const boroughs = flagList(cli.boroughs).length
    ? flagList(cli.boroughs)
    : flagList(process.env.CRAWLER_BOROUGHS || 'all');

  const sources = flagList(cli.sources).length
    ? flagList(cli.sources)
    : flagList(process.env.CRAWLER_SOURCES || 'craigslist,streeteasy');

  return {
    dbPath: cli.db || process.env.CRAWLER_DB || undefined,
    boroughs,
    sources,
    maxResults: Number(cli['max-results'] || process.env.CRAWLER_MAX_RESULTS || 5),
    searchDepth: cli.depth || process.env.CRAWLER_DEPTH || 'deep',
    enrich: !cli['no-enrich'] && envBool('CRAWLER_ENRICH', true),
    requireCraigslistPhone:
      !cli['allow-no-phone'] && envBool('CRAWLER_REQUIRE_CRAIGSLIST_PHONE', true),
    usePlaywrightFallback:
      !cli['no-playwright'] &&
      !cloudIngest &&
      envBool('CRAWLER_USE_PLAYWRIGHT', true),
    neighborhood: cli.neighborhood || process.env.CRAWLER_NEIGHBORHOOD || undefined,
    ingestIntervalMs: parseDurationMs(
      cli['ingest-interval'] || process.env.CRAWLER_INGEST_INTERVAL,
      parseDurationMs(process.env.CRAWLER_INGEST_INTERVAL_MS, DEFAULT_INGEST_INTERVAL_MS),
    ),
    verifyIntervalMs: parseDurationMs(
      cli['verify-interval'] || process.env.CRAWLER_VERIFY_INTERVAL,
      parseDurationMs(process.env.CRAWLER_VERIFY_INTERVAL_MS, DEFAULT_VERIFY_INTERVAL_MS),
    ),
    pollMs: parseDurationMs(cli.poll || process.env.CRAWLER_POLL_MS, DEFAULT_POLL_MS),
    verifyLimit: envInt('CRAWLER_VERIFY_LIMIT', 25),
    runVerify: !cli['no-verify'] && envBool('CRAWLER_RUN_VERIFY', true),
    syncClickHouse: !cli['no-clickhouse'] && envBool('CRAWLER_SYNC_CLICKHOUSE', true),
    runOnce: Boolean(cli.once),
    initialDelayMs: parseDurationMs(cli['initial-delay'] || process.env.CRAWLER_INITIAL_DELAY, 0),
  };
}
