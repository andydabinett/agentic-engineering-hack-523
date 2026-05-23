import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

dotenv.config({ path: path.join(root, '.env') });

export const ROOT = root;
export const DATA_DIR = path.join(root, 'data');
export const DEFAULT_DB = path.join(DATA_DIR, 'listings.db');
