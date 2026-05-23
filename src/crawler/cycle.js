import { DEFAULT_DB } from '../config/env.js';
import { ingestAll } from '../listings/ingest.js';
import { ListingRepository } from '../listings/repository.js';
import { runVerification } from '../verification/verifier.js';
import { syncSqliteToClickHouse } from '../clickhouse/sync.js';

/**
 * One crawler tick: optional ingest, optional verify, optional ClickHouse sync.
 * @param {'ingest' | 'verify' | 'all'} kind
 */
export async function runCrawlerCycle(config, kind = 'all') {
  const dbPath = config.dbPath || DEFAULT_DB;
  const repo = new ListingRepository(dbPath);
  const startedAt = new Date();
  const result = {
    kind,
    startedAt: startedAt.toISOString(),
    ingest: null,
    verify: null,
    clickhouse: null,
    stats: null,
    error: null,
  };

  try {
    if (kind === 'ingest' || kind === 'all') {
      result.ingest = await ingestAll(repo, {
        boroughs: config.boroughs,
        sources: config.sources,
        maxResults: config.maxResults,
        searchDepth: config.searchDepth,
        enrich: config.enrich,
        requireCraigslistPhone: config.requireCraigslistPhone,
        usePlaywrightFallback: config.usePlaywrightFallback,
        neighborhood: config.neighborhood,
      });
    }

    if (config.runVerify && (kind === 'verify' || kind === 'all')) {
      result.verify = await runVerification(repo, {
        limit: config.verifyLimit,
        statuses: ['active', 'unknown', 'error'],
      });
    }

    if (config.syncClickHouse) {
      try {
        result.clickhouse = await syncSqliteToClickHouse({ dbPath });
      } catch (err) {
        result.clickhouse = { inserted: 0, error: err.message };
      }
    }

    // Trigger LLM listing evaluation & Twilio SMS outreach
    try {
      const { evaluateListings } = await import('./evaluation.js');
      await evaluateListings(repo);
    } catch (evalErr) {
      console.error('[crawler] Listing evaluation failed:', evalErr.message);
    }

    result.stats = repo.stats();
    result.finishedAt = new Date().toISOString();
    return result;
  } catch (err) {
    result.error = err.message;
    result.finishedAt = new Date().toISOString();
    throw err;
  } finally {
    repo.close();
  }
}

export function summarizeCycle(result) {
  const lines = [`[crawler] ${result.kind} @ ${result.startedAt}`];

  if (result.ingest?.length) {
    for (const s of result.ingest) {
      lines.push(
        `  ingest ${s.borough}/${s.source}: stored=${s.stored} skipped=${s.skipped}` +
          (s.noPhone ? ` noPhone=${s.noPhone}` : ''),
      );
    }
  }

  if (result.verify?.length) {
    const live = result.verify.filter((o) => o.result === 'live').length;
    const expired = result.verify.filter((o) => o.result === 'expired').length;
    lines.push(`  verify: checked=${result.verify.length} live=${live} expired=${expired}`);
  }

  if (result.clickhouse) {
    if (result.clickhouse.error) {
      lines.push(`  clickhouse: skipped (${result.clickhouse.error})`);
    } else {
      lines.push(`  clickhouse: inserted=${result.clickhouse.inserted}`);
    }
  }

  if (result.stats) {
    lines.push(
      `  repo: total=${result.stats.total} phone=${result.stats.withPhone} email=${result.stats.withEmail}`,
    );
  }

  if (result.error) {
    lines.push(`  error: ${result.error}`);
  }

  return lines.join('\n');
}
