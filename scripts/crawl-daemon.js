#!/usr/bin/env node
/**
 * Always-on listing crawler: periodic Nimble ingest + verification + ClickHouse sync.
 *
 *   npm run crawler
 *   npm run crawler -- --once
 *   npm run crawler -- --boroughs brooklyn --ingest-interval 15m
 */
import { NimbleClient } from '../src/nimble/client.js';
import { getCrawlerConfig } from '../src/crawler/config.js';
import { getAgentScrapeStatus } from '../src/crawler/agentScrape.js';
import { runCrawlerCycle, summarizeCycle } from '../src/crawler/cycle.js';

function sleep(ms, shouldStop) {
  const step = Math.min(ms, 5_000);
  let remaining = ms;
  return new Promise((resolve) => {
    const tick = () => {
      if (shouldStop()) {
        resolve('stopped');
        return;
      }
      if (remaining <= 0) {
        resolve('done');
        return;
      }
      const wait = Math.min(step, remaining);
      remaining -= wait;
      setTimeout(tick, wait);
    };
    tick();
  });
}

async function main() {
  const config = getCrawlerConfig();
  let stopping = false;

  const stop = (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`\n[crawler] ${signal} — finishing current work, then exit…`);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  try {
    new NimbleClient();
  } catch (err) {
    console.error(`[crawler] Config error: ${err.message}`);
    process.exit(1);
  }

  console.log(
    `[crawler] starting` +
      (config.runOnce ? ' (once)' : '') +
      `\n  boroughs=${config.boroughs.join(',')}` +
      `\n  sources=${config.sources.join(',')}` +
      `\n  maxResults=${config.maxResults}/source enrich=${config.enrich} playwright=${config.usePlaywrightFallback}` +
      `\n  ingest every ${config.ingestIntervalMs}ms` +
      (config.runVerify ? `, verify every ${config.verifyIntervalMs}ms` : '') +
      `\n  clickhouse sync=${config.syncClickHouse}`,
  );

  if (config.initialDelayMs > 0) {
    console.log(`[crawler] initial delay ${config.initialDelayMs}ms`);
    await sleep(config.initialDelayMs, () => stopping);
  }

  let lastIngestAt = 0;
  let lastVerifyAt = 0;
  let cycle = 0;

  do {
    cycle += 1;
    const now = Date.now();
    const dueIngest = config.runOnce || now - lastIngestAt >= config.ingestIntervalMs;
    const dueVerify =
      config.runVerify &&
      (config.runOnce || now - lastVerifyAt >= config.verifyIntervalMs);

    try {
      if (dueIngest && getAgentScrapeStatus().running) {
        console.log('[crawler] skipping ingest — agent on-demand scrape in progress');
        lastIngestAt = Date.now();
        if (dueVerify) {
          const result = await runCrawlerCycle(config, 'verify');
          console.log(summarizeCycle(result));
          lastVerifyAt = Date.now();
        }
      } else if (dueIngest && dueVerify) {
        const result = await runCrawlerCycle(config, 'all');
        console.log(summarizeCycle(result));
        lastIngestAt = Date.now();
        lastVerifyAt = Date.now();
      } else if (dueIngest && !getAgentScrapeStatus().running) {
        const result = await runCrawlerCycle(config, 'ingest');
        console.log(summarizeCycle(result));
        lastIngestAt = Date.now();
      } else if (dueVerify) {
        const result = await runCrawlerCycle(config, 'verify');
        console.log(summarizeCycle(result));
        lastVerifyAt = Date.now();
      } else if (!config.runOnce) {
        const nextIngest = Math.max(0, config.ingestIntervalMs - (now - lastIngestAt));
        const nextVerify = config.runVerify
          ? Math.max(0, config.verifyIntervalMs - (now - lastVerifyAt))
          : Infinity;
        const wait = Math.min(nextIngest, nextVerify, config.pollMs);
        if (cycle === 1 || wait > 0) {
          console.log(`[crawler] idle ${Math.round(wait / 1000)}s until next job`);
        }
        await sleep(wait || config.pollMs, () => stopping);
        continue;
      }
    } catch (err) {
      console.error(`[crawler] cycle ${cycle} failed: ${err.message}`);
      if (err.stack) console.error(err.stack);
    }

    if (config.runOnce || stopping) break;

    const after = Date.now();
    const nextIngest = Math.max(0, config.ingestIntervalMs - (after - lastIngestAt));
    const nextVerify = config.runVerify
      ? Math.max(0, config.verifyIntervalMs - (after - lastVerifyAt))
      : Infinity;
    const wait = Math.max(config.pollMs, Math.min(nextIngest, nextVerify));
    console.log(`[crawler] sleeping ${Math.round(wait / 1000)}s`);
    await sleep(wait, () => stopping);
  } while (!stopping);

  console.log('[crawler] stopped');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
