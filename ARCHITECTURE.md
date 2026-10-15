# felt-dashboard — architecture

The Felt app (WP-42). The WP-38 audit of the old single-view chat window is in
git history (before WP-42.2); its three gaps — no routing, browser calls to the
desktop-only felt-animation, a hard-coded session — are what WP-42.2 closed.

## Runtime

- Static build (`dist/`, base `/app/`) in the `felt-app` image: node build
  stage → `caddy:2.11.4-alpine` serving `/srv/app` on :8080 (`deploy/Caddyfile`).
- clockmost's Caddy routes `felt.clockmost.com/app*` here and `/v1/app/*` to
  felt-core, both behind SSO forward-auth.
- Outbound from the browser: only same-origin `/v1/app/*` (`src/lib/appApi.ts`).
  In the tray window, `src/lib/bridge.ts` hands sends to the tray instead.

## Modules

| file | what |
|---|---|
| `src/App.tsx` | picks the page for the current flag |
| `src/components/Page.tsx` | the notebook page: rings, margin line, sticky flags, `Gutter` |
| `src/components/Mark.tsx` | one of her marks, drawn with Rough Notation |
| `src/pages/Talk.tsx` | the conversation as a transcript, paging back, sending |
| `src/pages/Soon.tsx` | flags whose page isn't built yet (WP-42.3–42.5) |
| `src/lib/appApi.ts` | `/v1/app/*` client + response validation |
| `src/lib/bridge.ts` | the tray bridge (`window.feltTray`, felt-tray-rust) |
| `src/lib/ink.ts` | seeded randomness, plays-once memory, pen speed, quote splitting |
| `src/lib/route.ts` | hash routing for the five flags |
| `src/styles/notebook.css` | paper, rings, flags, keyframes, theme tokens |

## Tests

`src/lib/*.test.ts`, `src/pages/Talk.test.tsx` (Testing Library, mocked fetch
and Rough Notation).
