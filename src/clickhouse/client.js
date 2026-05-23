import { createClient } from '@clickhouse/client';
import '../config/env.js';

export function getClient() {
  const host = process.env.CLICKHOUSE_HOST;
  const password = process.env.CLICKHOUSE_PASSWORD;

  if (!host || !password) {
    throw new Error(
      'CLICKHOUSE_HOST and CLICKHOUSE_PASSWORD are required in .env (see .env.example).',
    );
  }

  const secure = ['1', 'true', 'yes'].includes(
    (process.env.CLICKHOUSE_SECURE || 'true').toLowerCase(),
  );
  const port = process.env.CLICKHOUSE_PORT || (secure ? '8443' : '8123');
  const protocol = secure ? 'https' : 'http';

  return createClient({
    url: `${protocol}://${host}:${port}`,
    username: process.env.CLICKHOUSE_USER || 'default',
    password,
    database: process.env.CLICKHOUSE_DATABASE || 'default',
  });
}

export async function ping() {
  const client = getClient();
  const result = await client.query({ query: 'SELECT 1', format: 'JSONEachRow' });
  const rows = await result.json();
  return Number(rows[0]['1']);
}

export async function version() {
  const client = getClient();
  const result = await client.query({ query: 'SELECT version()', format: 'JSONEachRow' });
  const rows = await result.json();
  return rows[0]['version()'];
}
