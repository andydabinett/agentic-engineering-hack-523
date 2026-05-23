import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './env.js';

const CRITERIA_PATH = path.join(DATA_DIR, 'criteria.json');

const DEFAULT_CRITERIA = {
  bedrooms: 1,
  maxPrice: 3800,
  neighborhood: 'East Village',
  amenities: ['laundry-in-unit', 'dishwasher', 'pet-friendly', 'elevator'],
  dealBreakers: ['no-elevator', 'broker-fee'],
  readyToSearch: true,
};

/**
 * Load the latest user criteria from criteria.json.
 * @returns {Record<string, any>}
 */
export function loadCriteria() {
  try {
    if (fs.existsSync(CRITERIA_PATH)) {
      const content = fs.readFileSync(CRITERIA_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[criteria] load error:', err.message);
  }
  return DEFAULT_CRITERIA;
}

/**
 * Save updated user criteria to criteria.json.
 * @param {Record<string, any>} criteria
 */
export function saveCriteria(criteria) {
  if (!criteria) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CRITERIA_PATH, JSON.stringify(criteria, null, 2), 'utf8');
    console.log(`[criteria] saved to ${CRITERIA_PATH}`);
  } catch (err) {
    console.error('[criteria] save error:', err.message);
  }
}
