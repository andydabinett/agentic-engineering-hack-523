import { NimbleClient } from '../nimble/client.js';

const DEAD_PHRASES = {
  craigslist: [
    'this posting has been deleted',
    'this posting has expired',
    'this posting has been flagged for removal',
    'no longer available',
    'page not found',
    '404 not found',
  ],
  streeteasy: [
    'listing not found',
    'this listing is no longer available',
    'no longer on the market',
    'off market',
    'page not found',
    "we couldn't find",
  ],
};

const HTTP_GONE_RE = /\b(404|410|451)\b/;

function extractText(response) {
  const data = response.data || {};
  const parts = [
    response.status || '',
    String(response.status_code || ''),
    data.markdown || '',
    data.html || '',
  ];
  if (data.parsing && typeof data.parsing === 'object') {
    parts.push(JSON.stringify(data.parsing));
  }
  return parts.join('\n').toLowerCase();
}

export function classifyListing(source, response, { httpStatus } = {}) {
  const status = (response.status || '').toLowerCase();
  const statusCode = response.status_code || httpStatus;

  if (status && status !== 'success' && status !== 'ok') {
    return { result: 'error', note: `extract status=${status}` };
  }

  if (statusCode && Number(statusCode) >= 400) {
    return { result: 'expired', note: `HTTP ${statusCode}` };
  }

  const text = extractText(response);
  if (!text.trim()) {
    return { result: 'unknown', note: 'empty extract body' };
  }

  for (const phrase of DEAD_PHRASES[source]) {
    if (text.includes(phrase)) {
      return { result: 'expired', note: `matched: ${phrase}` };
    }
  }

  if (HTTP_GONE_RE.test(text) && text.includes('not found')) {
    return { result: 'expired', note: 'not found in page body' };
  }

  return { result: 'live', note: 'page loaded without expiry signals' };
}

export async function verifyListingUrl(url, source, { client } = {}) {
  const nimble = client || new NimbleClient();
  const response = await nimble.extract({
    url,
    render: true,
    country: 'US',
    state: 'NY',
    city: 'new_york',
    locale: 'en-US',
  });
  const { result, note } = classifyListing(source, response);
  return { result, note, response };
}

function toListingStatus(result) {
  if (result === 'live') return 'active';
  if (result === 'expired') return 'expired';
  if (result === 'error') return 'error';
  return 'unknown';
}

export async function runVerification(
  repo,
  { borough, source, limit = 25, statuses, client } = {},
) {
  const resolvedStatuses = statuses ?? ['active', 'unknown', 'error'];
  const rows = repo.listForVerification({
    borough,
    source,
    statuses: resolvedStatuses,
    limit,
  });

  if (!rows.length) return [];

  const runId = repo.startVerificationRun();
  const nimble = client || new NimbleClient();
  const outcomes = [];
  let stillLive = 0;
  let expired = 0;
  let errors = 0;

  for (const row of rows) {
    let result;
    let note;
    try {
      ({ result, note } = await verifyListingUrl(row.url, row.source, { client: nimble }));
    } catch (err) {
      result = 'error';
      note = err.message;
    }

    repo.updateVerification(row.id, {
      status: toListingStatus(result),
      note,
    });

    if (result === 'live') stillLive += 1;
    else if (result === 'expired') expired += 1;
    else errors += 1;

    outcomes.push({
      listingId: row.id,
      url: row.url,
      source: row.source,
      result,
      note,
    });
  }

  repo.finishVerificationRun(runId, {
    checked: outcomes.length,
    stillLive,
    expired,
    errors,
  });

  return outcomes;
}
