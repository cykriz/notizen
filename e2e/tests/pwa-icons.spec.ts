import { test, expect, type APIRequestContext } from '@playwright/test';

// "Add to Home Screen" happens before login: iOS fetches the touch icon and the
// manifest icons without a session cookie. Any icon the proxy does not let through
// comes back as a redirect to /login, and iOS falls back to a page screenshot.
// Paths are read from the manifest and the rendered <link> tags, not duplicated
// here, so a new icon outside a public prefix fails this spec.

interface WebManifest {
  icons: { src: string }[];
}

async function expectPublicPng(request: APIRequestContext, src: string): Promise<void> {
  const response = await request.get(src, { maxRedirects: 0 });
  expect(response.status(), `${src} must be reachable without a session`).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
}

test.describe('PWA icons without a session', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('every manifest icon is served as PNG', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as WebManifest;
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const { src } of manifest.icons) {
      await expectPublicPng(request, src);
    }
  });

  test('icon links on the login page are served as PNG', async ({ page, request }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    const hrefs = await page
      .locator('link[rel="apple-touch-icon"], link[rel="icon"][type="image/png"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      await expectPublicPng(request, href);
    }
  });
});
