# felt-dashboard — the Felt app

Felt's notebook: one dark page, spiral rings across the top, a raspberry
margin line, sticky flags for **talk · margins · diary · lists · systems**,
and her ink (circles, underlines, notes) drawn by hand. Designed with Mario
in WP-42 (design canvas and decisions: `Felt/docs/plans/impl/WP-42-felt-app.md`).

## Where it runs

- **Served from clockmost** at `https://felt.clockmost.com/app/` (VPN/LAN only,
  behind SSO), from its own container (`felt-app`). Push to `main` → CI checks,
  builds the image and the deploy loop rolls it out (WP-53).
- **Talks to felt-core** at `/v1/app/*` on the same origin. Caddy's SSO
  forward-auth is the lock; the build holds **no token or address**.
- **Phone and laptop:** Tauri shells that open the hosted app (WP-42.6).
- **Desktop:** the tray's Felt window opens the hosted app. There, sending goes
  through the tray (`window.feltTray.text_chat`, the Linux tray) so she still speaks and
  (lip-syncs once the overlay is back) typed replies; elsewhere replies are text only.

## Stack

React 19 · Vite 8 · TypeScript 7 · Tailwind v4 (layout) + `src/styles/notebook.css`
(paper, page furniture, motion) · Rough Notation (her marks) · self-hosted
fonts (Zen Maru Gothic, Klee One, IBM Plex Mono via @fontsource, Latin subsets)
· oxlint/oxfmt · Vitest. Hash routing (`#talk`, `#diary`…), no router library.

## Her ink

`src/lib/ink.ts`: every mark is seeded from its id (same shape on every
redraw), plays only the first time it's seen, and draws at pen speed. Spike:
WP-42.1.

## Develop

```bash
pnpm install
pnpm check   # fmt:check, lint, typecheck, test
pnpm build   # dist/ (base /app/)
```

`pnpm dev` serves the UI; the API needs felt.clockmost.com's SSO, so test API
flows through the deployed app or the unit tests.
