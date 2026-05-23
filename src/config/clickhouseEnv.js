/**
 * Resolve ClickHouse connection settings from .env.
 *
 * Supported patterns:
 *   CLICKHOUSE_URL=https://default:secret@host:8443/default
 *   CLICKHOUSE_HOST + CLICKHOUSE_PASSWORD
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

  const host = process.env.CLICKHOUSE_HOST?.trim();

  if (!password) {
    throw new Error(
      'Set CLICKHOUSE_PASSWORD or CLICKHOUSE_API_KEY in the repo root .env (see .env.example).',
    );
  }
  if (!host) {
    throw new Error(
      'Set CLICKHOUSE_HOST in .env (your cluster hostname from ClickHouse Cloud, e.g. abc123.us-east-1.aws.clickhouse.cloud). ' +
        'CLICKHOUSE_API_KEY is used as the password for user default.',
    );
  }

  const secure = ['1', 'true', 'yes'].includes(
    (process.env.CLICKHOUSE_SECURE || 'true').toLowerCase(),
  );

  return {
    host,
    port: process.env.CLICKHOUSE_PORT || (secure ? '8443' : '8123'),
    secure,
    username: process.env.CLICKHOUSE_USER || 'default',
    password,
    database: process.env.CLICKHOUSE_DATABASE || 'default',
  };
}
