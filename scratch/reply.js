import '../src/env.ts';
import { loadConfig } from '../src/config.ts';
import { createAppDeps } from '../src/app.ts';

async function main() {
  const body = process.argv.slice(2).join(' ') || 'Yes, Sunday at 2pm works.';
  const config = loadConfig();
  const deps = createAppDeps(config);
  
  const threads = await deps.store.listThreads({});
  const active = threads.find(t => t.status !== 'completed' && t.status !== 'failed');
  
  if (!active) {
    console.error('No active thread found to reply to!');
    return;
  }
  
  console.log(`Simulating reply: "${body}" for active thread ${active.threadId} (listing ${active.listingId})...`);
  
  const view = await deps.orchestrator.simulateInboundReply(active.threadId, body);
  console.log('Reply processed successfully! Current status:', view.thread.status);
  
  const lastMsg = view.messages[view.messages.length - 1];
  if (lastMsg && lastMsg.direction === 'outbound') {
    console.log(`Javier responded: "${lastMsg.body}"`);
  }
}

main().catch(console.error);
