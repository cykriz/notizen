import fs from "fs/promises";
import { TEST_NOTES_ROOT } from "./playwright.config";

export default async function globalSetup(): Promise<void> {
  await fs.mkdir(TEST_NOTES_ROOT, { recursive: true });
}
