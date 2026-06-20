import { SW_MSG_WARM_PAGE_CACHE } from '@/lib/constants';

export function warmPageCache(url: string): void {
  if (typeof navigator === 'undefined') {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Defer to idle so the warm fetch doesn't contend with the user's own
  // render/data requests right after a note opens.
  // controller is null on the page that just installed the SW; a subsequent
  // reload makes the page controlled, warming begins from then on.
  const post = () => {
    navigator.serviceWorker.controller?.postMessage({ type: SW_MSG_WARM_PAGE_CACHE, url });
  };

  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(post);
  } else {
    setTimeout(post, 1500);
  }
}
