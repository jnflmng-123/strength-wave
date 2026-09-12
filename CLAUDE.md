# `Desktop\Strength App` = the Strength Wave phone app

A home-screen web app (PWA) for the author's own training log. Built 11 Sep 2026. Deployed from the
`main` branch root by GitHub Pages; the repo is on the `jnflmng-123` account.

## Rules

- All user data lives in the phone's localStorage under the key `wave.v1`. Nothing here is a server.
  Never add a backend, analytics or an account without being asked.
- The default program in `app.js` mirrors the published program page "Five-Day Strength Wave"
  (a Claude artifact). Change one, change the other.
- A deploy needs `APP_VERSION` in `app.js` and `VERSION` in `sw.js` bumped, or the service worker
  keeps serving the old shell to an offline phone.
- The author tests on the phone. A change is not done until it has been seen on the phone.
- Personal and health details (doses, weights) never go into the shared memory store; this project
  is personal.

## Layout

Flat: `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `icons/`, `README.md`.
