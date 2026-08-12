import type { PrecacheEntry } from 'serwist';

declare global {
  interface ServiceWorkerGlobalScope {
    // Optional because it is an esbuild `define` injected at build time, not a
    // real global: in any build where serwist did not substitute it (and in the
    // dev worker) it is simply absent. Declaring it non-nullable made the `??`
    // guard in swPrecache.ts read as dead code while the runtime still needed it.
    __SW_MANIFEST?: (PrecacheEntry | string)[];
  }
}
