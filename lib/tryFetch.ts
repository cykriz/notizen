/**
 * Attempts a fetch and returns null on network failure (should enqueue for retry).
 * Returns the Response if the server responded (even with an error status).
 * On 401 (session expired), redirects to the login page.
 */
export async function tryFetch(url: string, init: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(url, init);
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
      return null;
    }

    return res;
  } catch {
    return null;
  }
}
