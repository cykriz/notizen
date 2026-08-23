# Design sources

Editable sources for the app's visual assets. Nothing here is served or bundled —
the runtime image only receives `public/`, so these files exist for whoever wants
to regenerate the assets, not for the app.

- `icons.icon/` — Apple Icon Composer source for the PWA icons. The rendered
  output lives in `public/` as `icon-{light,dark}-{192,512,1024}.png`,
  `apple-touch-icon.png`, and is referenced from `public/manifest.webmanifest`.

Not in this repo: the LibreOffice Draw source of the splash screen. It is ignored
via `*.odg` in `.gitignore` because the file carries editor and OS metadata
(generator version, editing duration) that has no business in a public repo. If
you need it, the icons above are the better starting point anyway.
