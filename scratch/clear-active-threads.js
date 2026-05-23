import '../src/env.ts';
import { loadConfig } from '../src/config.ts';
import { ClickHouseCorrespondenceStore, createClickHouseClient } from '../src/services/clickhouse/client.ts';

async function main() {
  const config = loadConfig();
  const store = new ClickHouseCorrespondenceStore(
    createClickHouseClient(config),
    config.clickhouseDatabase
  );

  console.log('Clearing active threads in ClickHouse...');
  
  // We can fetch threads and mark active ones as completed
  const threads = await store.listThreads({});
  const active = threads.filter(t => t.status !== 'completed' && t.status !== 'failed');
  
  for (const t of active) {
    console.log(`Updating thread ${t.threadId} status to completed...`);
    await store.updateThread(t.threadId, { status: 'completed' });
  }
  
  console.log('All active threads cleared.');
}

main().catch(console.error);
