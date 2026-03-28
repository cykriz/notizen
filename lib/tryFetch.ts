/**
 * Attempts a fetch and returns null on network failure (should enqueue for retry).
 * Returns the Response if the server responded (even with an error status).
 */
export async function tryFetch(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
}
