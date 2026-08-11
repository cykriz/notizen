import { SW_MSG_WARM_PAGE_CACHE } from '@/lib/constants';
import { postToServiceWorker, runWhenIdle } from '@/lib/swMessage';

export function warmPageCache(url: string): void {
  // Deferred to idle so the warm fetch doesn't contend with the user's own
  // render/data requests right after a note opens. Addressed via
  // serviceWorker.ready, so this also reaches the SW from the page that just
  // installed it (where `controller` is still null).
  runWhenIdle(() => {
    void postToServiceWorker({ type: SW_MSG_WARM_PAGE_CACHE, url });
  });
}
