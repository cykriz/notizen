// Last-ditch HTML fallback served when even /offline isn't in the cache.
// Hex colors (vs. design tokens) are unavoidable here: the SW context has no
// access to Tailwind or CSS variables. Keep copy aligned with the canonical
// themed page at app/offline/page.tsx.
const OFFLINE_HTML = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Keine Verbindung</title>
<style>
:root{color-scheme:light dark}
html,body{margin:0;height:100%;background:#fff;color:#111;font-family:system-ui,-apple-system,sans-serif}
@media (prefers-color-scheme:dark){html,body{background:#111;color:#eee}}
.wrap{display:flex;min-height:100vh;align-items:center;justify-content:center;padding:1rem}
.card{max-width:24rem;text-align:center}
h1{font-size:1.125rem;font-weight:600;margin:0 0 .5rem}
p{font-size:.875rem;opacity:.7;margin:0 0 1rem}
button{padding:.5rem 1rem;border:1px solid currentColor;background:transparent;color:inherit;border-radius:.375rem;font:inherit;cursor:pointer}
</style>
</head>
<body><div class="wrap"><div class="card">
<h1>Keine Verbindung</h1>
<p>Diese Seite wurde noch nicht für die Offline-Nutzung zwischengespeichert.</p>
<button onclick="location.reload()">Erneut versuchen</button>
</div></div></body>
</html>`;

export const offlineHtmlResponse = (): Response =>
  new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

export const offlineDataResponse = (): Response =>
  new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
