import { SW_MSG_ENSURE_PRECACHE } from '@/lib/constants';
import { requestFromServiceWorker, runWhenIdle } from '@/lib/swMessage';
import type { PrecacheReport } from '@/lib/types';

// A cold cache (first load after a deploy) means fetching the whole build
// manifest before the report comes back.
const ENSURE_TIMEOUT_MS = 60_000;

/**
 * Ask the SW to verify its precache and refill whatever is missing.
 *
 * Called from the (app) tree, which is the only context guaranteed to carry a
 * valid session — the SW's own install-time fetches get a 307 to /login when
 * the session is missing, which is one of the two ways the caches end up empty
 * and stay empty. Idle-deferred so the repair can't compete with the render it
 * was triggered by.
 *
 * Resolves null when there is no active SW (dev mode, unsupported browser).
 */
export async function ensurePrecache(): Promise<PrecacheReport | null> {
  await new Promise<void>((resolve) => {
    runWhenIdle(resolve);
  });

  const report = await requestFromServiceWorker<PrecacheReport>(
    { type: SW_MSG_ENSURE_PRECACHE },
    ENSURE_TIMEOUT_MS,
  );
  if (report === null) {
    return null;
  }

  // Not silent: a gap that survives a repair attempt is a real offline
  // regression, and the next attempt is only the next mount / online edge.
  if (report.missingPages.length > 0 || report.missingStatic > 0) {
    console.warn(
      '[precache] Offline-Cache unvollständig — fehlende Seiten:',
      report.missingPages,
      '| fehlende Build-Assets:',
      report.missingStatic,
    );
  }

  return report;
}
