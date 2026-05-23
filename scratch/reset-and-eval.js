import '../src/env.ts';
import { ListingRepository } from '../src/listings/repository.js';
import { evaluateListings } from '../src/crawler/evaluation.js';

async function main() {
  const repo = new ListingRepository();
  try {
    console.log('Resetting seeded listings that match budget/beds/neighborhood to active/pending...');
    
    // IDs: 1, 4, 7, 10, 11, 26
    const matchingIds = [1, 4, 7, 10, 11, 26];
    repo.db.prepare(`
      UPDATE listings 
      SET status = 'active', evaluation_status = 'pending' 
      WHERE id IN (${matchingIds.join(',')})
    `).run();

    console.log('Database updated. Running evaluation agent...');
    await evaluateListings(repo);
    console.log('Evaluation and automated SMS outreach complete!');
  } catch (err) {
    console.error('Error running reset and evaluation:', err);
  } finally {
    repo.close();
  }
}

main();
