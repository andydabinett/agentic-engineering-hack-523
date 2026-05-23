import { boroughIdsFromCriteria } from '../bridge/listingsApi.js';
import { getCrawlerConfig } from './config.js';
import { runCrawlerCycle, summarizeCycle } from './cycle.js';

/** @type {{ running: boolean, startedAt: string | null, finishedAt: string | null, lastError: string | null, lastSummary: string | null, lastBoroughs: string[] }} */
const state = {
  running: false,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  lastSummary: null,
  lastBoroughs: [],
};

export function getAgentScrapeStatus() {
  return {
    running: state.running,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    lastError: state.lastError,
    lastSummary: state.lastSummary,
    lastBoroughs: state.lastBoroughs,
  };
}

/**
 * Start an on-demand ingest (non-blocking). Safe to call from chat tools / API.
 * @returns {{ ok: boolean, status: string, message?: string, boroughs?: string[], maxResults?: number }}
 */
export function startAgentScrape({
  boroughs,
  maxResults,
  neighborhood,
  criteria,
} = {}) {
  if (state.running) {
    return {
      ok: false,
      status: 'busy',
      message: 'A scrape is already running. New listings will appear when it finishes.',
      boroughs: state.lastBoroughs,
    };
  }

  let resolvedBoroughs = boroughs?.length ? boroughs : null;
  if (!resolvedBoroughs?.length && criteria) {
    resolvedBoroughs = boroughIdsFromCriteria(criteria);
  }
  if (!resolvedBoroughs?.length || resolvedBoroughs.includes('all')) {
    resolvedBoroughs = ['all'];
  }

  const base = getCrawlerConfig({ _: [] });
  const config = {
    ...base,
    boroughs: resolvedBoroughs,
    maxResults: maxResults ?? base.maxResults,
    neighborhood: neighborhood || criteria?.neighborhood || base.neighborhood,
    runVerify: false,
    syncClickHouse: base.syncClickHouse,
  };

  state.running = true;
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.lastError = null;
  state.lastSummary = null;
  state.lastBoroughs = resolvedBoroughs;

  runCrawlerCycle(config, 'ingest')
    .then((result) => {
      state.lastSummary = summarizeCycle(result);
      console.log(state.lastSummary);
    })
    .catch((err) => {
      state.lastError = err instanceof Error ? err.message : String(err);
      console.error(`[agent-scrape] failed: ${state.lastError}`);
    })
    .finally(() => {
      state.running = false;
      state.finishedAt = new Date().toISOString();
    });

  return {
    ok: true,
    status: 'started',
    message: `Scraping Craigslist and StreetEasy for ${resolvedBoroughs.join(', ')}.`,
    boroughs: resolvedBoroughs,
    maxResults: config.maxResults,
  };
}
