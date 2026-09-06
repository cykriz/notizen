import type { Locator } from '@playwright/test';

/** The element's rendered box, or a hard failure. An absent box must never read as a
 *  passing position — which is what any `?? fallback` on `boundingBox()` would do. */
export async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('element is not laid out — it has no bounding box');
  }

  return box;
}
