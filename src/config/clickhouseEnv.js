/** Strip scheme/port if user pastes a full URL into CLICKHOUSE_HOST. */
function normalizeHostField(raw) {
  const value = raw?.trim();
  if (!value) return { host: '', port: undefined, secure: undefined };

  if (/^https?:\/\//i.test(value)) {
    const parsed = new URL(value);
    return {
      host: parsed.hostname,
      port: parsed.port || undefined,
      secure: parsed.protocol === 'https:',
    };
  }

  if (value.includes(':') && !value.includes('/')) {
    const [host, port] = value.split(':');
    return { host, port: port || undefined, secure: undefined };
  }

  return { host: value.replace(/\/+$/, ''), port: undefined, secure: undefined };
}

/**
 * Resolve ClickHouse connection settings from .env.
 *
 * Supported patterns:
 *   CLICKHOUSE_URL=https://default:secret@host:8443/default
 *   CLICKHOUSE_HOST + CLICKHOUSE_PASSWORD (hostname only, or full https URL)
 *   CLICKHOUSE_HOST + CLICKHOUSE_API_KEY  (API key = password in ClickHouse Cloud)
 */
export function getClickHouseConfig() {
  const rawUrl = process.env.CLICKHOUSE_URL?.trim();
  if (rawUrl) {
    const parsed = new URL(rawUrl);
    const secure = parsed.protocol === 'https:';
    return {
      host: parsed.hostname,
      port: parsed.port || (secure ? '8443' : '8123'),
      secure,
      username: decodeURIComponent(parsed.username || 'default'),
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname.replace(/^\//, '') || 'default',
    };
  }

  const password =
    process.env.CLICKHOUSE_PASSWORD?.trim() ||
    process.env.CLICKHOUSE_API_KEY?.trim() ||
    process.env.CLICKHOUSE_KEY?.trim();

  const normalized = normalizeHostField(process.env.CLICKHOUSE_HOST);
  const host = normalized.host;

  if (!password) {
    throw new Error(
      'Set CLICKHOUSE_PASSWORD or CLICKHOUSE_API_KEY in the repo root .env (see .env.example).',
    );
  }
  if (!host) {
    throw new Error(
      'Set CLICKHOUSE_HOST in .env (hostname only, e.g. abc123.us-central1.gcp.clickhouse.cloud — or paste the full HTTPS URL). ' +
        'CLICKHOUSE_API_KEY is used as the password for user default.',
    );
  }

  const secure =
    normalized.secure ??
    ['1', 'true', 'yes'].includes((process.env.CLICKHOUSE_SECURE || 'true').toLowerCase());

  return {
    host,
    port:
      normalized.port ||
      process.env.CLICKHOUSE_PORT ||
      (secure ? '8443' : '8123'),
    secure,
    username: process.env.CLICKHOUSE_USER || 'default',
    password,
    database: process.env.CLICKHOUSE_DATABASE || 'default',
  };
}
