import fs from 'fs/promises';
import { TEST_NOTES_ROOT } from './playwright.config';

export default async function globalTeardown(): Promise<void> {
  await fs.rm(TEST_NOTES_ROOT, { recursive: true, force: true });
}
