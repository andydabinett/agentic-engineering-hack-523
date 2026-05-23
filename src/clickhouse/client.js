import { createClient } from '@clickhouse/client';
import '../config/env.js';
import { getClickHouseConfig } from '../config/clickhouseEnv.js';

export function getClient() {
  const cfg = getClickHouseConfig();
  const protocol = cfg.secure ? 'https' : 'http';

  return createClient({
    url: `${protocol}://${cfg.host}:${cfg.port}`,
    username: cfg.username,
    password: cfg.password,
    database: cfg.database,
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
